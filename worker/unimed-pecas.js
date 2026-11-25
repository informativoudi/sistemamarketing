// ============================================================
// Unimed Uberlândia · API do Gerador de Peças (Cloudflare Worker)
// Guarda o registro de cada peça (banco D1) e as fotos dos e-mails (KV).
// Ligações no Worker: DB = banco D1 "unimed-pecas" · IMAGENS = KV "unimed-pecas"
// Segredo:  USUARIOS = logins de administradores em JSON, ex.: {"joander":"senha"}
//           (é a chave reserva: se alguém perder o acesso, edite aqui no Cloudflare)
//
// Segurança
// - Login com usuário e senha → devolve um passe (sessão) que expira em 12 h.
//   A senha nunca fica guardada no navegador; no banco, só o hash PBKDF2.
// - 5 senhas erradas seguidas → usuário bloqueado por 15 min (e o IP também).
// - Pedidos e fotos são gravados uma vez só: ninguém sobrescreve o que já existe.
// - Limite de envios por IP (contra spam e para não estourar a cota gratuita).
// - Não guardamos IP: os limites usam um código (hash) do IP que some em 2 h.
//
// Aprovação (etapa 3)
// - Toda peça entra como "aguardando". O Marketing (com login) aprova ou reprova
//   com uma observação. Quem pediu acompanha por um link com chave própria
//   (?pedido=CÓDIGO&t=CHAVE): a chave é uma assinatura HMAC do código, não dá
//   para adivinhar a de outra peça.
// - Peça ajustada pelo Marketing (nova versão com login) já entra aprovada.
// ============================================================
const ORIGENS = ['https://informativoudi.github.io'];
const TESTE = /^http:\/\/(localhost|127\.0\.0\.\d+)(:\d+)?$/; // computador local, para testes

const SESSAO_HORAS = 12;
const MAX_ERROS = 5, BLOQUEIO_MIN = 15;
const LIMITE_PEDIDOS_HORA = 60;   // por IP
const LIMITE_FOTOS_HORA = 150;    // por IP

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(o) || TESTE.test(o) ? o : ORIGENS[0],
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...cors(req) } });

// ---------- Criptografia ----------
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const aleatorio = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(texto) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))); }
async function gerarHash(senha, salHex) {
  const sal = new Uint8Array(salHex.match(/../g).map((h) => parseInt(h, 16)));
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, chave, 256));
}
function iguais(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// ---------- Banco: cria as tabelas sozinho na primeira chamada ----------
let pronto = false;
async function garantirTabela(env) {
  if (pronto) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pedidos (codigo TEXT PRIMARY KEY, criado_em TEXT NOT NULL, nome TEXT, area TEXT, formato TEXT, titulo TEXT, dados TEXT NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS pedidos_data ON pedidos (criado_em DESC)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, nome TEXT, hash TEXT NOT NULL, sal TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS sessoes (token TEXT PRIMARY KEY, usuario TEXT NOT NULL, nome TEXT, admin INTEGER NOT NULL DEFAULT 0, expira INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS limites (chave TEXT PRIMARY KEY, n INTEGER NOT NULL, ate INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)')
  ]);
  // Colunas da aprovação: acrescenta só as que faltam (banco antigo continua valendo).
  const { results } = await env.DB.prepare('PRAGMA table_info(pedidos)').all();
  const tem = new Set(results.map((c) => c.name));
  for (const col of ['status', 'email', 'observacao', 'decidido_por', 'decidido_em', 'versao_de']) {
    if (!tem.has(col)) await env.DB.prepare('ALTER TABLE pedidos ADD COLUMN ' + col + ' TEXT').run();
  }
  pronto = true;
}

// ---------- Chave dos links de acompanhamento (HMAC do código) ----------
let chaveLink = null;
async function assinar(env, codigo) {
  if (!chaveLink) {
    let r = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'link'").first();
    if (!r) { await env.DB.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES ('link', ?1)").bind(aleatorio(32)).run(); r = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'link'").first(); }
    chaveLink = await crypto.subtle.importKey('raw', new TextEncoder().encode(r.valor), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }
  return hex(await crypto.subtle.sign('HMAC', chaveLink, new TextEncoder().encode('pedido:' + codigo))).slice(0, 32);
}
const CODIGO = /^UNI-[A-Z0-9-]{4,60}$/;
// Peças de antes da aprovação (sem status) contam como aprovadas: já estavam em uso.
const situacao = (r) => ({ status: r.status || 'aprovada', observacao: r.observacao || '', decidido_por: r.decidido_por || '', decidido_em: r.decidido_em || '' });

// ---------- Limites (tentativas de login e envios por IP) ----------
async function ipCodigo(req) { return (await sha256('unimed:' + (req.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 24); }
async function contar(env, chave, janelaMs) {
  const agora = Date.now();
  const r = await env.DB.prepare('SELECT n, ate FROM limites WHERE chave = ?1').bind(chave).first();
  if (!r || r.ate < agora) { await env.DB.prepare('INSERT OR REPLACE INTO limites (chave, n, ate) VALUES (?1, 1, ?2)').bind(chave, agora + janelaMs).run(); return 1; }
  await env.DB.prepare('UPDATE limites SET n = n + 1 WHERE chave = ?1').bind(chave).run();
  return r.n + 1;
}
async function bloqueado(env, chave) {
  const r = await env.DB.prepare('SELECT n, ate FROM limites WHERE chave = ?1').bind(chave).first();
  return !!(r && r.ate > Date.now() && r.n >= MAX_ERROS);
}
async function limpar(env) {
  if (Math.random() > 0.05) return; // de vez em quando, apaga o que já venceu
  const agora = Date.now();
  await env.DB.batch([env.DB.prepare('DELETE FROM limites WHERE ate < ?1').bind(agora), env.DB.prepare('DELETE FROM sessoes WHERE expira < ?1').bind(agora)]);
}

// ---------- Login ----------
async function conferirSenha(env, usuario, senha) {
  const u = String(usuario || '').trim().toLowerCase();
  if (!u || !senha) return null;
  if (env.USUARIOS) {
    let lista = {}; try { lista = JSON.parse(env.USUARIOS); } catch (e) { lista = {}; }
    const chave = Object.keys(lista).find((k) => k.toLowerCase() === u);
    if (chave && iguais(senha, String(lista[chave]))) return { usuario: chave.toLowerCase(), nome: chave, admin: true };
  }
  const r = await env.DB.prepare('SELECT usuario, nome, hash, sal, admin FROM usuarios WHERE usuario = ?1').bind(u).first();
  if (!r) { await gerarHash(senha, '00'.repeat(16)); return null; } // mesmo tempo de resposta, exista ou não
  if (!iguais(await gerarHash(senha, r.sal), r.hash)) return null;
  return { usuario: r.usuario, nome: r.nome || r.usuario, admin: !!r.admin };
}

// Quem está fazendo o pedido (pelo passe "Bearer <token>"): { usuario, nome, admin } ou null.
async function sessao(req, env) {
  const h = req.headers.get('Authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/.test(h)) return null;
  const r = await env.DB.prepare('SELECT usuario, nome, admin, expira FROM sessoes WHERE token = ?1').bind(await sha256(h.slice(7))).first();
  if (!r || r.expira < Date.now()) return null;
  return { usuario: r.usuario, nome: r.nome, admin: !!r.admin };
}

export default {
  async fetch(req, env) {
    try { return await atender(req, env); }
    catch (e) { return json(req, { erro: 'Erro no servidor: ' + (e && e.message ? e.message : e) }, 500); }
  }
};

async function atender(req, env) {
  const url = new URL(req.url);
  const p = url.pathname;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (p === '/') return json(req, { ok: true, servico: 'unimed-pecas' });

  // Fotos públicas dos e-mails: servir não precisa de banco.
  if (p.startsWith('/img/') && req.method === 'GET') {
    const chave = p.slice(5);
    if (!/^[A-Za-z0-9._\/-]{1,200}$/.test(chave) || chave.includes('..')) return new Response('Caminho inválido', { status: 400 });
    const { value, metadata } = await env.IMAGENS.getWithMetadata(chave, { type: 'arrayBuffer' });
    if (!value) return new Response('Imagem não encontrada', { status: 404 });
    return new Response(value, { headers: { 'Content-Type': (metadata && metadata.tipo) || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Access-Control-Allow-Origin': '*' } });
  }

  await garantirTabela(env);
  const ip = await ipCodigo(req);

  // ----- Entrar: usuário + senha no corpo → passe de 12 h -----
  if (p === '/entrar' && req.method === 'POST') {
    let d; try { d = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
    const u = String(d.usuario || '').trim().toLowerCase();
    if (!u) return json(req, { erro: 'Digite seu usuário.' }, 400);
    if (await bloqueado(env, 'erro:u:' + u) || await bloqueado(env, 'erro:ip:' + ip)) return json(req, { erro: 'Muitas tentativas erradas. Espere ' + BLOQUEIO_MIN + ' minutos e tente de novo.' }, 429);
    const quem = await conferirSenha(env, u, String(d.senha || ''));
    if (!quem) {
      await contar(env, 'erro:u:' + u, BLOQUEIO_MIN * 60000);
      await contar(env, 'erro:ip:' + ip, BLOQUEIO_MIN * 60000);
      return json(req, { erro: 'Usuário ou senha incorretos.' }, 401);
    }
    await env.DB.prepare('DELETE FROM limites WHERE chave = ?1').bind('erro:u:' + u).run();
    const token = aleatorio(32);
    const expira = Date.now() + SESSAO_HORAS * 3600000;
    await env.DB.prepare('INSERT INTO sessoes (token, usuario, nome, admin, expira) VALUES (?1, ?2, ?3, ?4, ?5)').bind(await sha256(token), quem.usuario, quem.nome, quem.admin ? 1 : 0, expira).run();
    await limpar(env);
    return json(req, { ok: true, token, expira, ...quem });
  }

  // ----- Sessão: conferir (GET) e sair (DELETE) -----
  if (p === '/sessao') {
    const quem = await sessao(req, env);
    if (!quem) return json(req, { erro: 'Sessão expirada. Entre de novo.' }, 401);
    if (req.method === 'DELETE') { await env.DB.prepare('DELETE FROM sessoes WHERE token = ?1').bind(await sha256((req.headers.get('Authorization') || '').slice(7))).run(); return json(req, { ok: true }); }
    return json(req, { ok: true, ...quem });
  }

  // ----- Acessos: listar, criar/trocar senha e remover (só administradores) -----
  if (p === '/usuarios' || p.startsWith('/usuarios/')) {
    const quem = await sessao(req, env);
    if (!quem) return json(req, { erro: 'Sessão expirada. Entre de novo.' }, 401);
    if (!quem.admin) return json(req, { erro: 'Só administradores podem mexer nos acessos.' }, 403);
    if (p === '/usuarios' && req.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT usuario, nome, admin, criado_em FROM usuarios ORDER BY nome').all();
      return json(req, results.map((r) => ({ ...r, admin: !!r.admin })));
    }
    if (p === '/usuarios' && req.method === 'POST') {
      let d; try { d = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
      const usuario = String(d.usuario || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{2,40}$/.test(usuario)) return json(req, { erro: 'Usuário: use de 2 a 40 letras, números, ponto, hífen ou _ (sem espaço e sem acento).' }, 400);
      const senha = String(d.senha || '');
      const existe = await env.DB.prepare('SELECT usuario FROM usuarios WHERE usuario = ?1').bind(usuario).first();
      if ((!existe || senha) && senha.length < 8) return json(req, { erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
      const nome = String(d.nome || usuario).trim().slice(0, 80);
      const admin = d.admin ? 1 : 0;
      if (senha) {
        const sal = aleatorio(16);
        await env.DB.prepare('INSERT INTO usuarios (usuario, nome, hash, sal, admin, criado_em) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(usuario) DO UPDATE SET nome = ?2, hash = ?3, sal = ?4, admin = ?5')
          .bind(usuario, nome, await gerarHash(senha, sal), sal, admin, new Date().toISOString()).run();
        // Senha trocada: derruba as sessões abertas dessa pessoa.
        if (existe) await env.DB.prepare('DELETE FROM sessoes WHERE usuario = ?1').bind(usuario).run();
      } else {
        await env.DB.prepare('UPDATE usuarios SET nome = ?2, admin = ?3 WHERE usuario = ?1').bind(usuario, nome, admin).run();
      }
      return json(req, { ok: true, usuario }, existe ? 200 : 201);
    }
    if (p.startsWith('/usuarios/') && req.method === 'DELETE') {
      const usuario = decodeURIComponent(p.slice(10)).toLowerCase();
      if (usuario === quem.usuario) return json(req, { erro: 'Você não pode remover o seu próprio acesso.' }, 400);
      await env.DB.batch([env.DB.prepare('DELETE FROM usuarios WHERE usuario = ?1').bind(usuario), env.DB.prepare('DELETE FROM sessoes WHERE usuario = ?1').bind(usuario)]);
      return json(req, { ok: true });
    }
    return json(req, { erro: 'Não encontrado.' }, 404);
  }

  // ----- Registrar uma peça (aberto a quem gera peças, com limite por IP) -----
  if (p === '/pedidos' && req.method === 'POST') {
    if (await contar(env, 'ped:' + ip, 3600000) > LIMITE_PEDIDOS_HORA) return json(req, { erro: 'Muitos envios em pouco tempo. Tente de novo mais tarde.' }, 429);
    const texto = await req.text();
    if (texto.length > 1900000) return json(req, { erro: 'Pedido grande demais.' }, 413);
    let d;
    try { d = JSON.parse(texto); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
    if (!d.codigo || !CODIGO.test(d.codigo)) return json(req, { erro: 'Código inválido.' }, 400);
    // Ajuste do Marketing: com login e ?aprovar=1, a nova versão já entra aprovada.
    const mk = url.searchParams.get('aprovar') === '1' ? await sessao(req, env) : null;
    const agora = new Date().toISOString();
    const email = /^[^\s@<>"',;]{1,80}@[^\s@<>"',;]{1,120}\.[a-z]{2,}$/i.test(String(d.email || '')) ? String(d.email).toLowerCase() : null;
    const versaoDe = d.conteudo && CODIGO.test(String(d.conteudo.versao_de || '')) ? d.conteudo.versao_de : null;
    // Grava uma vez só: um código que já existe não pode ser sobrescrito.
    const r = await env.DB.prepare('INSERT OR IGNORE INTO pedidos (codigo, criado_em, nome, area, formato, titulo, dados, status, email, versao_de, decidido_por, decidido_em) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)')
      .bind(d.codigo, String(d.criado_em || agora).slice(0, 40), String(d.nome || '').slice(0, 120), String(d.area || '').slice(0, 120), String(d.formato || '').slice(0, 60), String(d.titulo || '').slice(0, 300), texto,
        mk ? 'aprovada' : 'aguardando', email, versaoDe, mk ? mk.nome || mk.usuario : null, mk ? agora : null)
      .run();
    await limpar(env);
    const t = await assinar(env, d.codigo);
    if (r && r.meta && r.meta.changes === 0) {
      const atual = await env.DB.prepare('SELECT status, observacao, decidido_por, decidido_em FROM pedidos WHERE codigo = ?1').bind(d.codigo).first();
      return json(req, { erro: 'Esse código já está registrado.', jaExiste: true, t, ...situacao(atual || {}) }, 409);
    }
    // A versão nova substitui a anterior que ainda esperava análise ou tinha sido reprovada.
    if (versaoDe) await env.DB.prepare("UPDATE pedidos SET status = 'substituida' WHERE codigo = ?1 AND (status = 'aguardando' OR status = 'reprovada')").bind(versaoDe).run();
    return json(req, { ok: true, t, status: mk ? 'aprovada' : 'aguardando' }, 201);
  }

  // ----- Decisão do Marketing: aprovar ou reprovar (com observação) -----
  const dec = /^\/pedidos\/(UNI-[A-Z0-9-]{4,60})\/decisao$/.exec(p);
  if (dec && req.method === 'POST') {
    const quem = await sessao(req, env);
    if (!quem) return json(req, { erro: 'Sessão expirada. Entre de novo.' }, 401);
    let d; try { d = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
    const acao = d.acao === 'aprovar' ? 'aprovada' : d.acao === 'reprovar' ? 'reprovada' : null;
    if (!acao) return json(req, { erro: 'Escolha aprovar ou reprovar.' }, 400);
    const obs = String(d.observacao || '').trim().slice(0, 2000);
    if (acao === 'reprovada' && obs.length < 3) return json(req, { erro: 'Escreva o que precisa ser ajustado.' }, 400);
    const agora = new Date().toISOString();
    const r = await env.DB.prepare('UPDATE pedidos SET status = ?2, observacao = ?3, decidido_por = ?4, decidido_em = ?5 WHERE codigo = ?1').bind(dec[1], acao, obs, quem.nome || quem.usuario, agora).run();
    if (!r || !r.meta || r.meta.changes === 0) return json(req, { erro: 'Peça não encontrada.' }, 404);
    return json(req, { ok: true, codigo: dec[1], t: await assinar(env, dec[1]), status: acao, observacao: obs, decidido_por: quem.nome || quem.usuario, decidido_em: agora });
  }

  // ----- Acompanhar uma peça pelo link (quem pediu): precisa da chave do link -----
  const um = /^\/pedido\/(UNI-[A-Z0-9-]{4,60})$/.exec(p);
  if (um && req.method === 'GET') {
    if (!iguais(url.searchParams.get('t') || '', await assinar(env, um[1]))) return json(req, { erro: 'Link inválido ou incompleto.' }, 403);
    const r = await env.DB.prepare('SELECT * FROM pedidos WHERE codigo = ?1').bind(um[1]).first();
    if (!r) return json(req, { erro: 'Peça não encontrada.' }, 404);
    const d = JSON.parse(r.dados);
    const s = situacao(r);
    const nova = await env.DB.prepare('SELECT codigo FROM pedidos WHERE versao_de = ?1 ORDER BY criado_em DESC LIMIT 1').bind(um[1]).first();
    return json(req, {
      codigo: r.codigo, criado_em: r.criado_em, nome: r.nome, area: r.area, email: r.email || d.email || '', formato: r.formato, titulo: r.titulo,
      conteudo: d.conteudo || {}, ...s, versao_nova: nova ? nova.codigo : '',
      // O arquivo oficial só sai depois de aprovado.
      html: s.status === 'aprovada' ? d.html || '' : ''
    });
  }

  // ----- Situação das peças de quem pediu (lista curta, cada uma com a sua chave) -----
  if (p === '/situacao' && req.method === 'POST') {
    let d; try { d = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
    const saida = [];
    for (const it of (Array.isArray(d.itens) ? d.itens : []).slice(0, 20)) {
      if (!CODIGO.test(String(it.codigo || '')) || !iguais(String(it.t || ''), await assinar(env, it.codigo))) continue;
      const r = await env.DB.prepare('SELECT status, observacao, decidido_por, decidido_em FROM pedidos WHERE codigo = ?1').bind(it.codigo).first();
      if (r) saida.push({ codigo: it.codigo, ...situacao(r) });
    }
    return json(req, saida);
  }

  // ----- Ler os pedidos (só com login) -----
  if (p === '/pedidos' && req.method === 'GET') {
    if (!(await sessao(req, env))) return json(req, { erro: 'Sessão expirada. Entre de novo.' }, 401);
    const { results } = await env.DB.prepare('SELECT dados, status, email, observacao, decidido_por, decidido_em FROM pedidos ORDER BY criado_em DESC LIMIT 1000').all();
    const lista = [];
    for (const r of results) {
      const d = JSON.parse(r.dados);
      lista.push({ ...d, email: r.email || d.email || '', ...situacao(r), t: await assinar(env, d.codigo) });
    }
    return json(req, lista);
  }

  // ----- Gravar foto recortada de e-mail (uma vez só, com limite por IP) -----
  if (p.startsWith('/img/') && req.method === 'PUT') {
    const chave = p.slice(5);
    if (!/^UNI-[A-Z0-9-]{4,60}\/imagem-[1-9]\.(jpg|png|webp)$/.test(chave)) return json(req, { erro: 'Caminho inválido.' }, 400);
    if (await contar(env, 'img:' + ip, 3600000) > LIMITE_FOTOS_HORA) return json(req, { erro: 'Muitos envios em pouco tempo. Tente de novo mais tarde.' }, 429);
    const tipo = req.headers.get('Content-Type') || 'image/jpeg';
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return json(req, { erro: 'Tipo de imagem não aceito.' }, 415);
    if (await env.IMAGENS.get(chave, { type: 'stream' })) return json(req, { erro: 'Essa imagem já existe e não pode ser trocada.', url: url.origin + '/img/' + chave }, 409);
    const corpo = await req.arrayBuffer();
    if (corpo.byteLength > 5000000) return json(req, { erro: 'Imagem grande demais.' }, 413);
    // Confere se é mesmo uma imagem (assinatura do arquivo), não só o que o envio diz.
    const b = new Uint8Array(corpo.slice(0, 12));
    const ehImagem = (b[0] === 0xFF && b[1] === 0xD8) || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) || (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45);
    if (!ehImagem) return json(req, { erro: 'O arquivo não é uma imagem válida.' }, 415);
    await env.IMAGENS.put(chave, corpo, { metadata: { tipo } });
    return json(req, { url: url.origin + '/img/' + chave }, 201);
  }

  return json(req, { erro: 'Não encontrado.' }, 404);
}
