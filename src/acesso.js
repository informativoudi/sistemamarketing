/* ============================================================
   Área restrita · senha do Marketing
   Painel, Núcleo da Marca e Radar pedem a senha do Marketing.
   A senha é conferida pela API do Cloudflare (worker/unimed-pecas.js,
   variável secreta SENHA) e fica guardada só neste navegador.
   No computador local (localhost) abre sem senha, para testes.
   ============================================================ */
(function (raiz) {
  'use strict';

  var CHAVE = 'unimed-sessao-painel-v1';
  var sistema = null;

  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  var memoria = ler();
  function gravar(s) { memoria = s; try { if (s) localStorage.setItem(CHAVE, JSON.stringify(s)); else localStorage.removeItem(CHAVE); } catch (e) { /* vale só nesta aba */ } }
  function ehLocal() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }

  async function carregarSistema() {
    if (sistema) return sistema;
    try { sistema = await fetch('config/sistema.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
    catch (e) { sistema = { registro: { modo: 'local' } }; }
    return sistema;
  }
  function api() { var c = (sistema && sistema.registro) || {}; return c.modo === 'cloudflare' ? String(c.api || '').replace(/\/$/, '') : ''; }

  async function conferir(senha) {
    var r = await fetch(api() + '/entrar', { method: 'POST', headers: { Authorization: 'Bearer ' + senha } });
    if (r.status === 401) throw new Error('Senha incorreta.');
    if (!r.ok) throw new Error('Não consegui conferir a senha (' + r.status + ').');
    return { senha: senha, conferido: Date.now() };
  }

  function sair() { gravar(null); location.href = 'index.html'; }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }

  function telaPortao(mensagem, comFormulario, aoEntrar) {
    var caixa = document.getElementById('portao');
    caixa.textContent = '';
    caixa.hidden = false;
    var cartao = el('div', { 'class': 'cartao portao-cartao' }, [
      el('h1', { 'class': 'portao-titulo' }, ['ÁREA ', el('span', { texto: 'restrita' })]),
      el('p', { 'class': 'sub', texto: 'Painel, Núcleo da Marca e Radar de Tendências. Só para o Marketing.' })
    ]);
    if (comFormulario) {
      var campo = el('input', { id: 'senha-painel', type: 'password', autocomplete: 'current-password' });
      var status = el('p', { 'class': 'ajuda', role: 'status' });
      var botao = el('button', { 'class': 'btn primario', type: 'submit' }, ['Entrar']);
      var form = el('form', { 'class': 'portao-form' }, [el('label', { 'for': 'senha-painel', texto: 'Senha do Marketing' }), campo, botao, status]);
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!campo.value) { campo.focus(); return; }
        botao.disabled = true; status.textContent = 'Conferindo…';
        try { gravar(await conferir(campo.value)); status.textContent = ''; aoEntrar(); }
        catch (x) { status.textContent = x.message === 'Failed to fetch' ? 'Sem conexão com o registro.' : x.message; botao.disabled = false; campo.select(); }
      });
      cartao.appendChild(form);
      setTimeout(function () { campo.focus(); }, 50);
    }
    if (mensagem) cartao.appendChild(el('p', { 'class': 'alerta ' + (mensagem.aviso ? 'aviso' : 'erro'), role: 'status', texto: mensagem.texto }));
    caixa.appendChild(cartao);
  }

  function montarMenu(atual) {
    var nav = document.getElementById('menu-restrito');
    if (!nav) return;
    nav.textContent = '';
    nav.appendChild(el('a', { href: 'index.html', texto: 'Criar peça' }));
    [['painel.html', 'Painel'], ['nucleo.html', 'Núcleo da Marca'], ['radar.html', 'Radar']].forEach(function (i) {
      var a = el('a', { href: i[0], texto: i[1] });
      if (i[0] === atual) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    nav.appendChild(el('button', { type: 'button', 'class': 'link sair', onclick: sair, texto: 'Sair' }));
  }

  /* Protege a página: só chama aoLiberar(ctx) com a senha certa. */
  async function proteger(opcoes) {
    var conteudo = document.getElementById('conteudo-restrito');
    conteudo.hidden = true;
    await carregarSistema();
    var liberar = function (local) {
      document.getElementById('portao').hidden = true;
      montarMenu(opcoes.pagina);
      conteudo.hidden = false;
      return opcoes.aoLiberar({ token: memoria && memoria.senha, local: !!local, sistema: sistema });
    };
    if (!api()) {
      if (ehLocal()) return liberar(true);
      return telaPortao({ aviso: true, texto: 'O registro ainda não foi ligado (veja docs/registro-cloudflare.md).' }, false);
    }
    if (memoria && memoria.senha) {
      if (Date.now() - (memoria.conferido || 0) < 12 * 3600 * 1000) return liberar(false);
      try { gravar(await conferir(memoria.senha)); return liberar(false); } catch (e) { gravar(null); }
    }
    return telaPortao(null, true, function () { liberar(false); });
  }

  function sistemaAtual() { return sistema; }

  raiz.UnimedAcesso = { proteger: proteger, carregarSistema: carregarSistema, sair: sair, el: el, sistema: sistemaAtual, ehLocal: ehLocal };
})(window);
