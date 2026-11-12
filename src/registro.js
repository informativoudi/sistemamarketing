/* ============================================================
   Registro de pedidos
   Cada peça gerada vira um registro: quem pediu, área, quando,
   formato, o conteúdo enviado, o HTML final e a "impressão
   digital" (hash) desse HTML, para conferir alterações depois.
   Modo "local": guarda neste navegador. Modo "supabase": banco.
   ============================================================ */
(function (raiz) {
  'use strict';

  var CHAVE_LOCAL = 'unimed-pedidos-v1';

  function lerLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '[]'); } catch (e) { return []; }
  }
  function gravarLocal(lista) {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista)); return true; } catch (e) { return false; }
  }

  async function hash(texto) {
    if (!raiz.crypto || !raiz.crypto.subtle) return '';
    var dados = new TextEncoder().encode(texto);
    var buf = await raiz.crypto.subtle.digest('SHA-256', dados);
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* A chave pública vai só no "apikey"; o "Authorization" leva o login da pessoa, quando houver.
     (Chaves novas "sb_publishable_" não são aceitas no Authorization.) */
  function cabecalhos(cfg, token) {
    var h = { 'apikey': cfg.supabaseChaveAnonima, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  async function salvar(cfg, pedido) {
    var lista = lerLocal();
    lista.unshift(pedido);
    gravarLocal(lista.slice(0, 500));
    if (cfg && cfg.modo === 'supabase' && cfg.supabaseUrl) {
      var r = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + cfg.tabela, {
        method: 'POST',
        headers: Object.assign(cabecalhos(cfg), { 'Prefer': 'return=minimal' }),
        body: JSON.stringify(pedido)
      });
      if (!r.ok) throw new Error('O banco recusou o registro (' + r.status + ').');
    }
    return pedido;
  }

  /* Ler exige login: só quem está na tabela "acessos" enxerga os pedidos. */
  async function listar(cfg, token) {
    if (cfg && cfg.modo === 'supabase' && cfg.supabaseUrl) {
      var r = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + cfg.tabela + '?select=*&order=criado_em.desc&limit=1000', { headers: cabecalhos(cfg, token) });
      if (!r.ok) throw new Error('Não foi possível ler o banco (' + r.status + ').');
      return r.json();
    }
    return lerLocal();
  }

  /* Envia uma imagem recortada ao banco de imagens (Supabase Storage, pasta pública) e devolve o endereço. */
  async function enviarImagem(cfg, caminho, blob) {
    var base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
    var balde = cfg.bucketImagens || 'pecas';
    var r = await fetch(base + '/storage/v1/object/' + balde + '/' + caminho, {
      method: 'POST',
      headers: { 'apikey': cfg.supabaseChaveAnonima, 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true', 'cache-control': '31536000' },
      body: blob
    });
    if (!r.ok) throw new Error('O banco de imagens recusou o envio (' + r.status + ').');
    return base + '/storage/v1/object/public/' + balde + '/' + caminho;
  }

  var api = { salvar: salvar, listar: listar, hash: hash, enviarImagem: enviarImagem };
  raiz.UnimedRegistro = api;
})(window);
