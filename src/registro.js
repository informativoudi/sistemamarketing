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
      var cab = { 'Content-Type': 'application/json' };
      // Ajuste do Marketing: com o passe da sessão, a nova versão já entra aprovada.
      if (opcoes && opcoes.token) cab.Authorization = 'Bearer ' + opcoes.token;
      var r = await fetch(api(cfg) + '/pedidos' + (opcoes && opcoes.token ? '?aprovar=1' : ''), { method: 'POST', headers: cab, body: JSON.stringify(pedido) });
      var d = {}; try { d = await r.json(); } catch (e) { d = {}; }
      // 409 = já estava registrado (ex.: nova tentativa de envio): está tudo certo.
      if (!r.ok && r.status !== 409) throw new Error(d.erro || 'O registro recusou o pedido (' + r.status + ').');
      return { t: d.t || '', status: d.status || 'aguardando' };
    }
    return { t: '', status: '' };
  }

  /* Aprovação ---------------------------------------------------------- */
  async function lerJson(r, padrao) {
    var d = {}; try { d = await r.json(); } catch (e) { d = {}; }
    if (!r.ok) throw new Error(d.erro || padrao + ' (' + r.status + ').');
    return d;
  }
  /* Uma peça pelo link de acompanhamento (código + chave). */
  async function consultar(cfg, codigo, t) {
    var r = await fetch(api(cfg) + '/pedido/' + encodeURIComponent(codigo) + '?t=' + encodeURIComponent(t));
    return lerJson(r, 'Não consegui abrir essa peça');
  }
  /* Situação de várias peças (as que a pessoa pediu neste aparelho). */
  async function situacao(cfg, itens) {
    if (!central(cfg) || !itens.length) return [];
    var r = await fetch(api(cfg) + '/situacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens: itens }) });
    return lerJson(r, 'Não consegui ver a situação');
  }
  /* Marketing: aprovar ou reprovar. */
  async function decidir(cfg, token, codigo, acao, observacao) {
    var r = await fetch(api(cfg) + '/pedidos/' + encodeURIComponent(codigo) + '/decisao', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ acao: acao, observacao: observacao || '' }) });
    if (r.status === 401) throw new Error('Sua sessão expirou. Clique em Sair e entre de novo.');
    return lerJson(r, 'Não consegui registrar a decisão');
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

  raiz.UnimedRegistro = { salvar: salvar, consultar: consultar, situacao: situacao, decidir: decidir, listar: listar, hash: hash, enviarImagem: enviarImagem, central: central };
})(window);
