// ============================================================
// Assistente da marca (IA) · Núcleo da Marca e Radar de Tendências
// Roda no Supabase (Edge Function). A chave da IA fica nos segredos
// do Supabase (ANTHROPIC_API_KEY), nunca no site.
// Só quem tem papel liberado na tabela "acessos" pode usar (padrão: dono).
// A função só PROPÕE mudanças nos arquivos de regras (JSON); quem
// publica é a pessoa, na tela, depois de revisar.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// O que cada área pode alterar.
const EDITAVEIS: Record<string, RegExp[]> = {
  nucleo: [/^config\/marca\.json$/, /^config\/formatos\/[a-z0-9-]+\.json$/],
  radar: [/^config\/tendencias\.json$/],
};

const REGRAS_GERAIS = `Você é o assistente do sistema de marca da Unimed Uberlândia (Brasil). Responda sempre em português do Brasil, de forma curta e clara, para um designer.
O sistema gera peças só com regras (sem IA): tudo o que muda o resultado está nos arquivos JSON que você recebe. Seu trabalho é transformar o pedido em alterações nesses arquivos.

Regras que você nunca quebra:
- Siga os manuais da marca (MS.139 Aplicação, MS.138 Linguagem, Manual do Grupo). Logo nunca sobre laranja; laranja é só do botão/ação; títulos em caixa alta e baixa no e-mail e comunicados.
- Separação de marcas: Grupo Unimed Uberlândia para conteúdo interno, eventos e vagas; Unimed Uberlândia + registro ANS para o público externo. Campanha interna usa o Grupo; campanha externa usa Unimed + ANS.
- E-mail marketing tem só os públicos Interno e Externo.
- Mantenha a estrutura e as chaves existentes. Chaves que começam com "_" são explicações: atualize se a regra mudar.
- Cores sempre em hexadecimal (#rrggbb) ou pelo nome de uma cor que exista em marca.json → cores.
- Não invente arquivos de imagem, ícones ou fontes que não existem: só use caminhos que já aparecem nos arquivos.
- Os desenhos (código) entendem estas tendências pelo id: titulo-contraste, quadrado-laranja, moldura-box, textura-papel, prova-de-processo; e o bloco "campanha" com fundo, destaque e mote. Uma tendência nova com outro id fica registrada, mas só muda as peças quando o desenho for programado: diga isso em "limites".
- Se o pedido for ambíguo, não altere nada: faça a pergunta em "resposta" e devolva "alteracoes": [].

Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, neste formato:
{"resposta": "o que você fez ou a pergunta, em 1 a 4 frases",
 "alteracoes": [{"arquivo": "config/....json", "motivo": "por que mudou, em uma frase", "conteudo": { ...o arquivo COMPLETO já alterado... }}],
 "limites": ["o que não dá para fazer só com regras, se houver"]}`;

const POR_AREA: Record<string, string> = {
  nucleo: `Área: NÚCLEO DA MARCA. Você pode alterar config/marca.json (cores, papéis das cores, tipografia, linguagem, áreas, ícones por área, rodapé, imagens aprovadas que já existem) e os arquivos de formato config/formatos/*.json recebidos (campos, limites de caracteres, temas, públicos, downloads em "exportar", seções). Não altere config/tendencias.json aqui.`,
  radar: `Área: RADAR DE TENDÊNCIAS. Você pode alterar só config/tendencias.json: ciclo, conceito, "principal", status das tendências (ativa, teste, arquivada), criar ou ajustar tendências e o bloco "campanha" (visual das campanhas internas e externas). Para "criar um novo branding", monte um novo conjunto: conceito, campanha (fundo, destaque, mote) e tendências; guarde o ciclo anterior em "ciclosAnteriores" (lista) sem apagar. O ciclo 2027 ("Humano por natureza") é o principal até a pessoa dizer o contrário. config/marca.json vem só como referência (cores existentes).`,
};

function extrairJson(texto: string) {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim < 0) throw new Error('A IA não devolveu JSON.');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);

  // 1. Quem está pedindo (login do GitHub via Supabase) e se pode usar a IA.
  const autorizacao = req.headers.get('Authorization') || '';
  if (!autorizacao.startsWith('Bearer ')) return resposta({ erro: 'Entre com o GitHub na área restrita.' }, 401);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacao } },
  });
  const { data: papel, error: erroPapel } = await sb.rpc('meu_papel');
  if (erroPapel) return resposta({ erro: 'Não consegui conferir seu acesso.' }, 401);
  const papeis = (Deno.env.get('PAPEIS_IA') || 'dono').split(',').map((s) => s.trim());
  if (!papel || !papeis.includes(String(papel))) return resposta({ erro: 'Seu acesso não inclui o assistente.' }, 403);

  // 2. Pedido.
  let corpo: { area?: string; pedido?: string; arquivos?: Record<string, unknown>; historico?: { papel: string; texto: string }[] };
  try { corpo = await req.json(); } catch { return resposta({ erro: 'Pedido inválido.' }, 400); }
  const area = corpo.area === 'radar' ? 'radar' : 'nucleo';
  const pedido = String(corpo.pedido || '').slice(0, 4000).trim();
  if (!pedido) return resposta({ erro: 'Escreva o que você quer mudar.' }, 400);
  const arquivos = corpo.arquivos || {};
  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) return resposta({ erro: 'Falta configurar a chave da IA (ANTHROPIC_API_KEY) nos segredos do Supabase.' }, 500);

  const contexto = Object.entries(arquivos)
    .map(([caminho, conteudo]) => `<arquivo caminho="${caminho}" editavel="${EDITAVEIS[area].some((r) => r.test(caminho)) ? 'sim' : 'não'}">\n${JSON.stringify(conteudo, null, 2)}\n</arquivo>`)
    .join('\n\n');

  const mensagens: { role: 'user' | 'assistant'; content: string }[] = [];
  (corpo.historico || []).slice(-8).forEach((h) => {
    mensagens.push({ role: h.papel === 'assistente' ? 'assistant' : 'user', content: String(h.texto || '').slice(0, 4000) });
  });
  mensagens.push({ role: 'user', content: `Arquivos atuais:\n\n${contexto}\n\nPedido: ${pedido}` });

  // 3. Chama a IA.
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('ASSISTENTE_MODELO') || 'claude-sonnet-5-5',
      max_tokens: 16000,
      system: REGRAS_GERAIS + '\n\n' + POR_AREA[area],
      messages: mensagens,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return resposta({ erro: 'A IA não respondeu (' + r.status + ').', detalhe: t.slice(0, 400) }, 502);
  }
  const j = await r.json();
  const texto = (j.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');

  // 4. Confere o que voltou: só arquivos permitidos nesta área.
  let saida;
  try { saida = extrairJson(texto); } catch (e) { return resposta({ erro: 'Resposta da IA fora do formato. Tente reformular.', detalhe: String(e) }, 502); }
  const alteracoes = (Array.isArray(saida.alteracoes) ? saida.alteracoes : []).filter((a: { arquivo?: string; conteudo?: unknown }) =>
    a && typeof a.arquivo === 'string' && EDITAVEIS[area].some((re) => re.test(a.arquivo!)) && a.conteudo && typeof a.conteudo === 'object');
  return resposta({
    resposta: String(saida.resposta || ''),
    alteracoes,
    limites: Array.isArray(saida.limites) ? saida.limites.map(String) : [],
    uso: j.usage || null,
  });
});
