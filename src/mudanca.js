/* ============================================================
   Pedir mudança (página aberta às áreas)
   O pedido vai para a API (worker/unimed-pecas.js → /mudancas) e
   aparece para o Marketing em "Pedidos de mudança". Quem pediu
   acompanha a resposta aqui (lista guardada neste aparelho).
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CHAVE_QUEM = 'unimed-gerador-quem', CHAVE_MINHAS = 'unimed-minhas-mudancas-v1';
  var TIPOS = ['Regra da marca', 'Layout de um formato', 'Formato novo', 'Campanha', 'Outro'];
  var STATUS = { nova: ['Recebido', 'st-aguardando'], analise: ['Em análise', 'st-aguardando'], feita: ['Feito', 'st-aprovada'], recusada: ['Não vamos fazer', 'st-reprovada'] };
  var sistema = {}, tipo = '';

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }
  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function api() { var r = sistema.registro || {}; return r.modo === 'cloudflare' && r.api ? r.api.replace(/\/$/, '') : ''; }
  function limpar(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function emailOk(v) { return /^[^\s@<>"',;]{1,80}@[^\s@<>"',;]{1,120}\.[a-z]{2,}$/i.test(limpar(v)); }

  async function meus() {
    var lista = ler(CHAVE_MINHAS) || [];
    var ul = $('m-meus-lista'); ul.textContent = '';
    $('m-meus-vazio').hidden = lista.length > 0;
    if (!lista.length) return;
    var sit = {};
    if (api()) {
      try {
        var r = await fetch(api() + '/situacao-mudancas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens: lista.map(function (x) { return { id: x.id, t: x.t }; }) }) });
        if (r.ok) (await r.json()).forEach(function (x) { sit[x.id] = x; });
      } catch (e) { /* mostra sem a situação */ }
    }
    lista.forEach(function (x) {
      var s = sit[x.id] || {}, st = STATUS[s.status] || STATUS.nova;
      ul.appendChild(el('li', {}, [
        el('div', { 'class': 'mud-topo' }, [el('b', { texto: x.tipo || 'Pedido' }), el('span', { 'class': 'selo ' + st[1], texto: st[0] })]),
        el('p', { 'class': 'mud-texto', texto: x.descricao }),
        s.resposta ? el('p', { 'class': 'mud-resposta' }, [el('b', { texto: 'Marketing: ' }), s.resposta]) : null,
        el('span', { 'class': 'mud-info', texto: x.id + ' · ' + new Date(x.criado_em).toLocaleDateString('pt-BR') })
      ]));
    });
  }

  async function enviar(ev) {
    ev.preventDefault();
    var erros = [];
    var d = {
      tipo: tipo, formato: $('m-formato').value, descricao: $('m-descricao').value.trim(), referencia: limpar($('m-referencia').value),
      nome: limpar($('m-nome').value), area: $('m-area').value, email: limpar($('m-email').value).toLowerCase()
    };
    document.querySelectorAll('#form-mudanca .campo').forEach(function (c) { c.classList.remove('com-erro'); var m = c.querySelector('.msg'); if (m) m.remove(); });
    if (!d.tipo) erros.push(['tipo', 'Escolha o tipo de mudança.']);
    if (d.descricao.length < 10) erros.push(['descricao', 'Conte um pouco mais do que precisa mudar.']);
    if (d.referencia && !/^https?:\/\//.test(d.referencia)) erros.push(['referencia', 'O link precisa começar com https://']);
    if (!d.nome) erros.push(['nome', 'Informe seu nome.']);
    if (!d.area) erros.push(['area', 'Selecione seu setor.']);
    if (!emailOk(d.email)) erros.push(['email', 'Informe seu e-mail corporativo para receber a resposta.']);
    erros.forEach(function (e) { var c = document.querySelector('#form-mudanca .campo[data-campo="' + e[0] + '"]'); if (c) { c.classList.add('com-erro'); c.appendChild(el('span', { 'class': 'msg', texto: e[1] })); } });
    if (erros.length) { $('m-quem').hidden = false; return; }
    if (!api()) { $('m-mensagens').textContent = 'O registro central ainda não foi ligado.'; return; }
    var b = $('m-enviar'); b.disabled = true;
    try {
      var r = await fetch(api() + '/mudancas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      var res = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(res.erro || 'O envio foi recusado (' + r.status + ').');
      var quem = ler(CHAVE_QUEM) || {};
      gravar(CHAVE_QUEM, { nome: d.nome, area: d.area, email: d.email || quem.email || '' });
      var lista = ler(CHAVE_MINHAS) || [];
      lista.unshift({ id: res.id, t: res.t, tipo: d.tipo, descricao: d.descricao, criado_em: new Date().toISOString() });
      gravar(CHAVE_MINHAS, lista.slice(0, 20));
      $('m-feito').hidden = false;
      $('m-feito').textContent = 'Pedido ' + res.id + ' enviado. O Marketing responde por e-mail e aqui, em "Seus pedidos".';
      $('m-descricao').value = ''; $('m-referencia').value = '';
      meus();
    } catch (e) {
      $('m-mensagens').textContent = ''; $('m-mensagens').appendChild(el('p', { 'class': 'alerta erro', texto: e.message }));
    } finally { b.disabled = false; }
  }

  async function iniciar() {
    var r = await Promise.all(['config/sistema.json', 'config/marca.json', 'config/formatos/indice.json'].map(function (u) { return fetch(u).then(function (x) { return x.json(); }); }));
    sistema = r[0];
    var marca = r[1], indice = r[2];
    var area = $('m-area'), grupos = {};
    ((marca.setores && marca.setores.lista) || []).forEach(function (st) {
      if (!grupos[st.filial]) { grupos[st.filial] = el('optgroup', { label: st.filial }); area.appendChild(grupos[st.filial]); }
      grupos[st.filial].appendChild(el('option', { value: st.nome, texto: st.nome }));
    });
    indice.formatos.forEach(function (f) { $('m-formato').appendChild(el('option', { value: f.nome, texto: f.nome })); });
    var caixa = $('m-tipos');
    TIPOS.forEach(function (t) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'class': 'chip-tipo', texto: t, onclick: function () {
        tipo = t; caixa.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      } });
      caixa.appendChild(b);
    });
    var q = new URLSearchParams(location.search);
    if (q.get('formato')) $('m-formato').value = q.get('formato');
    var quem = ler(CHAVE_QUEM) || {};
    $('m-nome').value = quem.nome || ''; area.value = quem.area || ''; $('m-email').value = quem.email || '';
    $('form-mudanca').addEventListener('submit', enviar);
    meus();
  }
  iniciar();
})();
