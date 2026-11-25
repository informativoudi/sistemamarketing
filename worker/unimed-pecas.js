// ============================================================
// Unimed Uberlândia · API do Gerador de Peças (Cloudflare Worker)
// Guarda o registro de cada peça (banco D1) e as fotos dos e-mails (KV).
// Ligações no Worker: DB = banco D1 "unimed-pecas" · IMAGENS = KV "unimed-pecas"
// Segredo:  SENHA = senha geral do Marketing (administra os acessos)
// Logins individuais: criados na página "Acessos" do site e guardados no banco D1
// (tabela usuarios, com a senha protegida por hash PBKDF2 — nunca em texto).
// ============================================================
const ORIGENS = ['https://informativoudi.github.io'];
const TESTE = /^http:\/\/(localhost|127\.0\.0\.\d+)(:\d+)?$/; // computador local, para testes

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
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
// ---------- Senhas: hash PBKDF2 (a senha nunca fica gravada em texto) ----------
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function gerarHash(senha, salHex) {
  const sal = new Uint8Array(salHex.match(/../g).map((h) => parseInt(h, 16)));
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, chave, 256));
}
function iguais(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// Quem está fazendo o pedido: { usuario, nome, admin } ou null.
// O site manda "Bearer usuario:senha" (login próprio) ou "Bearer senha" (senha geral, que é administradora).
async function autorizado(req, env) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  if (env.SENHA && iguais(token, env.SENHA)) return { usuario: 'marketing', nome: 'Marketing', admin: true };
  const i = token.indexOf(':');
  if (i <= 0) return null;
  await garantirTabela(env);
  const u = token.slice(0, i).trim().toLowerCase();
  const r = await env.DB.prepare('SELECT usuario, nome, hash, sal, admin FROM usuarios WHERE usuario = ?1').bind(u).first();
  if (!r) return null;
  if (!iguais(await gerarHash(token.slice(i + 1), r.sal), r.hash)) return null;
  return { usuario: r.usuario, nome: r.nome || r.usuario, admin: !!r.admin };
}

// Cria a tabela sozinho na primeira chamada (não depende de rodar o SQL à mão).
let pronto = false;
async function garantirTabela(env) {
  if (pronto) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS pedidos (codigo TEXT PRIMARY KEY, criado_em TEXT NOT NULL, nome TEXT, area TEXT, formato TEXT, titulo TEXT, dados TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS pedidos_data ON pedidos (criado_em DESC)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, nome TEXT, hash TEXT NOT NULL, sal TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL)').run();
  pronto = true;
}

export default {
  async fetch(req, env) {
    try { return await atender(req, env); }
    catch (e) { return json(req, { erro: 'Erro no servidor: ' + (e && e.message ? e.message : e) }, 500); }
  }
};

async function atender(req, env) {
  {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (p === '/') return json(req, { ok: true, servico: 'unimed-pecas' });

    // Painel: confere o login do Marketing.
    if (p === '/entrar' && req.method === 'POST') {
      const quem = await autorizado(req, env);
      return quem ? json(req, { ok: true, ...quem }) : json(req, { erro: 'Usuário ou senha incorretos.' }, 401);
    }

    // Acessos: listar, criar/trocar senha e remover logins (só administradores).
    if (p === '/usuarios' || p.startsWith('/usuarios/')) {
      const quem = await autorizado(req, env);
      if (!quem) return json(req, { erro: 'Usuário ou senha incorretos.' }, 401);
      if (!quem.admin) return json(req, { erro: 'Só administradores podem mexer nos acessos.' }, 403);
      await garantirTabela(env);
      if (p === '/usuarios' && req.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT usuario, nome, admin, criado_em FROM usuarios ORDER BY nome').all();
        return json(req, results.map((r) => ({ ...r, admin: !!r.admin })));
      }
      if (p === '/usuarios' && req.method === 'POST') {
        let d; try { d = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
        const usuario = String(d.usuario || '').trim().toLowerCase();
        if (!/^[a-z0-9._-]{2,40}$/.test(usuario)) return json(req, { erro: 'Usuário: use de 2 a 40 letras, números, ponto, hífen ou _ (sem espaço e sem acento).' }, 400);
        if (usuario === 'marketing') return json(req, { erro: 'Esse nome é reservado.' }, 400);
        const senha = String(d.senha || '');
        const existe = await env.DB.prepare('SELECT usuario FROM usuarios WHERE usuario = ?1').bind(usuario).first();
        if (!existe && senha.length < 8) return json(req, { erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
        if (senha && senha.length < 8) return json(req, { erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
        const nome = String(d.nome || usuario).trim().slice(0, 80);
        const admin = d.admin ? 1 : 0;
        if (senha) {
          const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
          const hash = await gerarHash(senha, sal);
          await env.DB.prepare('INSERT INTO usuarios (usuario, nome, hash, sal, admin, criado_em) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(usuario) DO UPDATE SET nome = ?2, hash = ?3, sal = ?4, admin = ?5')
            .bind(usuario, nome, hash, sal, admin, new Date().toISOString()).run();
        } else {
          await env.DB.prepare('UPDATE usuarios SET nome = ?2, admin = ?3 WHERE usuario = ?1').bind(usuario, nome, admin).run();
        }
        return json(req, { ok: true, usuario }, existe ? 200 : 201);
      }
      if (p.startsWith('/usuarios/') && req.method === 'DELETE') {
        const usuario = decodeURIComponent(p.slice(10)).toLowerCase();
        if (usuario === quem.usuario) return json(req, { erro: 'Você não pode remover o seu próprio acesso.' }, 400);
        await env.DB.prepare('DELETE FROM usuarios WHERE usuario = ?1').bind(usuario).run();
        return json(req, { ok: true });
      }
      return json(req, { erro: 'Não encontrado.' }, 404);
    }

    // Registrar uma peça (qualquer pessoa que gera uma peça).
    if (p === '/pedidos') await garantirTabela(env);
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
      if (!(await autorizado(req, env))) return json(req, { erro: 'Usuário ou senha incorretos.' }, 401);
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
}
