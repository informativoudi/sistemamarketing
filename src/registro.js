/* ============================================================
   Registro de pedidos
   Cada peça gerada vira um registro: quem pediu, área, quando,
   formato, o conteúdo, o HTML final e a "impressão digital"
   (hash) desse HTML, para conferir alterações depois.
   Modo "cloudflare": grava na API do Cloudflare (worker/unimed-pecas.js),
   que o painel lê com a senha do Marketing. Sempre guarda também
   uma cópia neste navegador.
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

  function api(cfg) { return String((cfg && cfg.api) || '').replace(/\/$/, ''); }
  function central(cfg) { return !!(cfg && cfg.modo === 'cloudflare' && api(cfg)); }

  /* opcoes.soBanco: nova tentativa de uma peça que já está na cópia local. */
  async function salvar(cfg, pedido, opcoes) {
    if (!(opcoes && opcoes.soBanco)) {
      var lista = lerLocal();
      lista.unshift(pedido);
      if (!gravarLocal(lista.slice(0, 300))) gravarLocal(lista.slice(0, 50));
    }
    if (central(cfg)) {
      var r = await fetch(api(cfg) + '/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pedido) });
      // 409 = já estava registrado (ex.: nova tentativa de envio): está tudo certo.
      if (!r.ok && r.status !== 409) throw new Error('O registro recusou o pedido (' + r.status + ').');
    }
    return pedido;
  }

  /* Ler todos os pedidos exige o login do Marketing (passe da sessão). */
  async function listar(cfg, token) {
    if (central(cfg)) {
      var r = await fetch(api(cfg) + '/pedidos', { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) throw new Error('Sua sessão expirou. Clique em Sair e entre de novo.');
      if (!r.ok) throw new Error('Não foi possível ler os pedidos (' + r.status + ').');
      return r.json();
    }
    return lerLocal();
  }

  /* Envia uma foto recortada e devolve o endereço público dela (para o e-mail). */
  async function enviarImagem(cfg, caminho, blob) {
    var r = await fetch(api(cfg) + '/img/' + caminho, { method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    var d = {}; try { d = await r.json(); } catch (e) { d = {}; }
    if (r.status === 409 && d.url) return d.url; // já estava enviada
    if (!r.ok) throw new Error(d.erro || ('O envio da imagem foi recusado (' + r.status + ').'));
    return d.url;
  }

  raiz.UnimedRegistro = { salvar: salvar, listar: listar, hash: hash, enviarImagem: enviarImagem, central: central };
})(window);
