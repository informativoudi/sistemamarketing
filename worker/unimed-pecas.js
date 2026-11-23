// ============================================================
// Unimed Uberlândia · API do Gerador de Peças (Cloudflare Worker)
// Guarda o registro de cada peça (banco D1) e as fotos dos e-mails (KV).
// Ligações no Worker: DB = banco D1 "unimed-pecas" · IMAGENS = KV "unimed-pecas"
// Variável secreta: SENHA = senha do painel do Marketing
// ============================================================
const ORIGENS = ['https://informativoudi.github.io'];
const TESTE = /^http:\/\/(localhost|127\.0\.0\.\d+)(:\d+)?$/; // computador local, para testes

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(o) || TESTE.test(o) ? o : ORIGENS[0],
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
const autorizado = (req, env) => !!env.SENHA && (req.headers.get('Authorization') || '') === 'Bearer ' + env.SENHA;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (p === '/') return json(req, { ok: true, servico: 'unimed-pecas' });

    // Painel: confere a senha do Marketing.
    if (p === '/entrar' && req.method === 'POST') return autorizado(req, env) ? json(req, { ok: true }) : json(req, { erro: 'Senha incorreta.' }, 401);

    // Registrar uma peça (qualquer pessoa que gera uma peça).
    if (p === '/pedidos' && req.method === 'POST') {
      const texto = await req.text();
      if (texto.length > 1900000) return json(req, { erro: 'Pedido grande demais.' }, 413);
      let d;
      try { d = JSON.parse(texto); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
      if (!d.codigo || !/^UNI-[A-Z0-9-]{4,60}$/.test(d.codigo)) return json(req, { erro: 'Código inválido.' }, 400);
      await env.DB.prepare('INSERT OR REPLACE INTO pedidos (codigo, criado_em, nome, area, formato, titulo, dados) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
        .bind(d.codigo, String(d.criado_em || new Date().toISOString()), String(d.nome || '').slice(0, 120), String(d.area || '').slice(0, 120), String(d.formato || '').slice(0, 60), String(d.titulo || '').slice(0, 300), texto)
        .run();
      return json(req, { ok: true }, 201);
    }

    // Ler os pedidos (só com a senha do Marketing).
    if (p === '/pedidos' && req.method === 'GET') {
      if (!autorizado(req, env)) return json(req, { erro: 'Senha incorreta.' }, 401);
      const { results } = await env.DB.prepare('SELECT dados FROM pedidos ORDER BY criado_em DESC LIMIT 1000').all();
      return json(req, results.map((r) => JSON.parse(r.dados)));
    }

    // Fotos recortadas dos e-mails: gravar (PUT) e servir (GET) com endereço público.
    if (p.startsWith('/img/')) {
      const chave = p.slice(5);
      if (!/^[A-Za-z0-9._\/-]{1,200}$/.test(chave) || chave.includes('..')) return json(req, { erro: 'Caminho inválido.' }, 400);
      if (req.method === 'PUT') {
        const tipo = req.headers.get('Content-Type') || 'image/jpeg';
        if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return json(req, { erro: 'Tipo de imagem não aceito.' }, 415);
        const corpo = await req.arrayBuffer();
        if (corpo.byteLength > 5000000) return json(req, { erro: 'Imagem grande demais.' }, 413);
        await env.IMAGENS.put(chave, corpo, { metadata: { tipo } });
        return json(req, { url: url.origin + '/img/' + chave }, 201);
      }
      if (req.method === 'GET') {
        const { value, metadata } = await env.IMAGENS.getWithMetadata(chave, { type: 'arrayBuffer' });
        if (!value) return new Response('Imagem não encontrada', { status: 404 });
        return new Response(value, { headers: { 'Content-Type': (metadata && metadata.tipo) || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
      }
    }
    return json(req, { erro: 'Não encontrado.' }, 404);
  }
};
