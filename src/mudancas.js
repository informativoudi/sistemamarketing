/* Pedidos de mudança (área restrita): ler, mudar a situação, responder e levar ao Claude. */
(function () {
  'use strict';
  var Ac = window.UnimedAcesso, Ap = window.UnimedAprovacao, el = Ac.el;
  var $ = function (id) { return document.getElementById(id); };
  var NOMES = { nova: ['Recebido', 'st-aguardando'], analise: ['Em análise', 'st-aguardando'], feita: ['Feito', 'st-aprovada'], recusada: ['Não vamos fazer', 'st-reprovada'] };
  var ctx = null, lista = [];

  function quando(iso) { var d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function base() { return Ac.api(); }

  /* Texto pronto para colar no Claude (o "editor" das regras). */
  function paraClaude(m) {
    return 'Pedido de mudança ' + m.id + ' no Sistema de Marketing (repositório informativoudi/sistemamarketing).\n' +
      'Tipo: ' + (m.tipo || '—') + (m.formato ? '\nFormato: ' + m.formato : '') +
      '\nPedido por: ' + (m.nome || '—') + ' (' + (m.area || '—') + ')' +
      '\n\nO que pediram:\n' + m.descricao +
      (m.referencia ? '\n\nReferência: ' + m.referencia : '') +
      '\n\nAvalie contra as regras da marca (config/marca.json e manuais). Se fizer sentido, altere config/ e os modelos, mostre o que mudou e gere o zip da atualização.';
  }

  function kpis() {
    var c = { nova: 0, analise: 0, feita: 0, recusada: 0 };
    lista.forEach(function (m) { c[m.status] = (c[m.status] || 0) + 1; });
    var caixa = $('m-kpis'); caixa.textContent = '';
    [[c.nova, 'recebidos'], [c.analise, 'em análise'], [c.feita, 'feitos'], [lista.length, 'no total']].forEach(function (k) {
      caixa.appendChild(el('div', { 'class': 'kpi' }, [el('b', { texto: String(k[0]) }), el('span', { texto: k[1] })]));
    });
  }

  function desenhar() {
    var f = $('m-filtro').value, ul = $('m-lista'); ul.textContent = '';
    var vis = lista.filter(function (m) { return f === 'abertos' ? (m.status === 'nova' || m.status === 'analise') : !f || m.status === f; });
    $('m-vazio').hidden = vis.length > 0;
    vis.forEach(function (m) {
      var st = NOMES[m.status] || NOMES.nova;
      var sel = el('select', { 'aria-label': 'Situação de ' + m.id }, Object.keys(NOMES).map(function (k) { var o = el('option', { value: k, texto: NOMES[k][0] }); if (k === m.status) o.selected = true; return o; }));
      var resp = el('textarea', { rows: '2', maxlength: '2000', placeholder: 'Resposta para quem pediu (aparece para a pessoa)', 'aria-label': 'Resposta' }); resp.value = m.resposta || '';
      var aviso = el('span', { 'class': 'ajuda', role: 'status' });
      var salvar = el('button', { type: 'button', 'class': 'btn-mini', texto: 'Salvar' });
      salvar.addEventListener('click', async function () {
        salvar.disabled = true; aviso.textContent = 'Salvando…';
        try {
          var r = await fetch(base() + '/mudancas/' + m.id, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ctx.token }, body: JSON.stringify({ status: sel.value, resposta: resp.value }) });
          var d = await r.json().catch(function () { return {}; });
          if (!r.ok) throw new Error(d.erro || 'Não consegui salvar (' + r.status + ').');
          Object.assign(m, d); kpis();
          aviso.textContent = 'Salvo.';
          desenhar();
        } catch (e) { aviso.textContent = e.message; } finally { salvar.disabled = false; }
      });
      var copiar = el('button', { type: 'button', 'class': 'btn-mini', texto: 'Copiar para o Claude' });
      copiar.addEventListener('click', function () {
        navigator.clipboard.writeText(paraClaude(m)).then(function () { aviso.textContent = 'Copiado. Cole na conversa do Claude do sistema.'; }).catch(function () { aviso.textContent = paraClaude(m); });
      });
      ul.appendChild(el('li', {}, [
        el('div', { 'class': 'mud-topo' }, [el('b', { texto: (m.tipo || 'Pedido') + (m.formato ? ' · ' + m.formato : '') }), el('span', { 'class': 'selo ' + st[1], texto: st[0] })]),
        el('p', { 'class': 'mud-texto', texto: m.descricao }),
        m.referencia ? el('p', { 'class': 'mud-info' }, [el('a', { href: m.referencia, target: '_blank', rel: 'noopener noreferrer', texto: 'Ver referência' })]) : null,
        el('span', { 'class': 'mud-info', texto: m.id + ' · ' + (m.nome || '—') + ' · ' + (m.area || '—') + ' · ' + quando(m.criado_em) + (m.atualizado_por ? ' · atualizado por ' + m.atualizado_por : '') }),
        el('div', { 'class': 'mud-acoes' }, [sel, resp, el('div', { 'class': 'acoes' }, [salvar, copiar, aviso])])
      ]));
    });
  }

  /* Novo pedido (só o Marketing, com login). */
  var TIPOS = ['Regra da marca', 'Layout de um formato', 'Formato novo', 'Campanha', 'Outro'], tipo = '';
  async function montarForm() {
    var indice = await fetch('config/formatos/indice.json').then(function (r) { return r.json(); }).catch(function () { return { formatos: [] }; });
    indice.formatos.filter(function (f) { return f.ativo; }).forEach(function (f) { $('m-formato').appendChild(el('option', { value: f.nome, texto: f.nome })); });
    var caixa = $('m-tipos');
    TIPOS.forEach(function (t) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'class': 'chip-tipo', texto: t, onclick: function () {
        tipo = t; caixa.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      } });
      caixa.appendChild(b);
    });
    $('form-mudanca').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var d = { tipo: tipo, formato: $('m-formato').value, descricao: $('m-descricao').value.trim(), referencia: $('m-referencia').value.trim() };
      var msg = $('m-mensagens'); msg.textContent = '';
      var erro = !d.tipo ? 'Escolha o tipo de mudança.' : d.descricao.length < 10 ? 'Conte um pouco mais do que precisa mudar.' : d.referencia && !/^https?:\/\//.test(d.referencia) ? 'O link precisa começar com https://' : '';
      if (erro) { msg.appendChild(el('p', { 'class': 'alerta erro', texto: erro })); return; }
      var b = $('m-enviar'); b.disabled = true;
      try {
        var r = await fetch(base() + '/mudancas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ctx.token }, body: JSON.stringify(d) });
        var res = await r.json().catch(function () { return {}; });
        if (r.status === 401) throw new Error('Sua sessão expirou. Clique em Sair e entre de novo.');
        if (!r.ok) throw new Error(res.erro || 'Não consegui registrar (' + r.status + ').');
        lista.unshift(res.pedido);
        $('m-descricao').value = ''; $('m-referencia').value = '';
        $('novo-pedido').open = false;
        $('m-filtro').value = 'abertos'; kpis(); desenhar();
      } catch (e) { msg.appendChild(el('p', { 'class': 'alerta erro', texto: e.message })); }
      finally { b.disabled = false; }
    });
  }

  async function iniciar(c) {
    ctx = c;
    montarForm();
    if (!base()) { $('origem').hidden = false; $('origem').textContent = 'O registro central ainda não foi ligado.'; return; }
    try {
      var r = await fetch(base() + '/mudancas', { headers: { Authorization: 'Bearer ' + c.token } });
      if (r.status === 401) throw new Error('Sua sessão expirou. Clique em Sair e entre de novo.');
      if (!r.ok) throw new Error('Não consegui ler os pedidos (' + r.status + ').');
      lista = await r.json();
    } catch (e) { $('origem').hidden = false; $('origem').textContent = e.message; lista = []; }
    kpis(); desenhar();
    $('m-filtro').addEventListener('change', desenhar);
  }
  Ac.proteger({ pagina: 'mudancas.html', aoLiberar: iniciar });
})();
