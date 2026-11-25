/* ============================================================
   Área restrita · senha do Marketing
   Painel, Núcleo da Marca e Radar pedem a senha do Marketing.
   Cada pessoa entra com usuário e senha, conferidos pela API do
   Cloudflare (worker/unimed-pecas.js). O acesso fica guardado só neste navegador.
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

  /* token = "usuario:senha". */
  async function conferir(token) {
    var r = await fetch(api() + '/entrar', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) throw new Error('Usuário ou senha incorretos.');
    if (!r.ok) throw new Error('Não consegui conferir o acesso (' + r.status + ').');
    var d = {}; try { d = await r.json(); } catch (e) { d = {}; }
    return { senha: token, usuario: d.usuario || '', nome: d.nome || d.usuario || '', admin: !!d.admin, conferido: Date.now() };
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

  var OLHO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OLHO_FECHADO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  function lado(titulo, texto) {
    return el('li', null, [el('b', { texto: titulo }), el('span', { texto: texto })]);
  }

  function telaPortao(mensagem, comFormulario, aoEntrar) {
    var caixa = document.getElementById('portao');
    caixa.textContent = '';
    caixa.hidden = false;

    var marca = el('aside', { 'class': 'portao-marca', 'aria-hidden': 'false' }, [
      el('p', { 'class': 'portao-meta' }, [el('span', { texto: 'KV 2027' }), el('span', { texto: 'Marketing · Unimed Uberlândia' })]),
      el('h1', { 'class': 'portao-titulo' }, [
        el('span', { 'class': 'pt-black', texto: 'Área' }),
        el('span', { 'class': 'pt-light' }, ['restrita', el('span', { 'class': 'pt-ponto', 'aria-hidden': 'true' })])
      ]),
      el('ul', { 'class': 'portao-lista' }, [
        lado('Painel', 'Todos os pedidos de peças, por área e data.'),
        lado('Núcleo da Marca', 'Cores, fontes, logos e regras.'),
        lado('Radar', 'As tendências e o Key Art do ano.')
      ]),
      el('img', { 'class': 'portao-mosaico', src: 'assets/mosaico-2027.svg', alt: '' })
    ]);

    var lado2 = el('div', { 'class': 'portao-acesso' }, [
      el('p', { 'class': 'portao-olho', texto: 'Só para o Marketing' }),
      el('h2', { 'class': 'portao-h2', texto: 'Entrar' })
    ]);

    if (comFormulario) {
      var usuario = el('input', { id: 'usuario-painel', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Seu usuário' });
      try { usuario.value = localStorage.getItem('unimed-usuario-painel') || ''; } catch (e) { /* sem memória */ }
      var campo = el('input', { id: 'senha-painel', type: 'password', autocomplete: 'current-password', placeholder: 'Digite a senha', 'aria-describedby': 'senha-dica' });
      var ver = el('button', { type: 'button', 'class': 'portao-ver', 'aria-label': 'Mostrar senha', 'aria-pressed': 'false' });
      ver.innerHTML = OLHO;
      ver.addEventListener('click', function () {
        var mostrar = campo.type === 'password';
        campo.type = mostrar ? 'text' : 'password';
        ver.innerHTML = mostrar ? OLHO_FECHADO : OLHO;
        ver.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
        ver.setAttribute('aria-pressed', String(mostrar));
        campo.focus();
      });
      var dica = el('p', { id: 'senha-dica', 'class': 'portao-dica', texto: 'A senha fica salva só neste navegador.' });
      var status = el('p', { 'class': 'portao-status', role: 'status', 'aria-live': 'polite' });
      var botao = el('button', { 'class': 'btn primario portao-entrar', type: 'submit' }, ['Entrar', el('span', { 'aria-hidden': 'true', texto: '→' })]);
      var form = el('form', { 'class': 'portao-form', novalidate: true }, [
        el('label', { 'for': 'usuario-painel', texto: 'Usuário' }),
        el('div', { 'class': 'portao-campo' }, [usuario]),
        el('label', { 'for': 'senha-painel', texto: 'Senha' }),
        el('div', { 'class': 'portao-campo' }, [campo, ver]),
        dica, botao, status
      ]);
      campo.addEventListener('keyup', function (e) {
        var caps = e.getModifierState && e.getModifierState('CapsLock');
        dica.textContent = caps ? 'Atenção: o Caps Lock está ligado.' : 'A senha fica salva só neste navegador.';
        dica.classList.toggle('caps', !!caps);
      });
      [campo, usuario].forEach(function (c) { c.addEventListener('input', function () { form.classList.remove('com-erro'); status.textContent = ''; }); });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var u = usuario.value.trim();
        if (!u) { form.classList.add('com-erro'); status.textContent = 'Digite seu usuário.'; usuario.focus(); return; }
        if (!campo.value) { form.classList.add('com-erro'); status.textContent = 'Digite a senha.'; campo.focus(); return; }
        botao.disabled = true; botao.classList.add('carregando'); status.textContent = 'Conferindo…';
        try {
          gravar(await conferir(u + ':' + campo.value));
          try { localStorage.setItem('unimed-usuario-painel', u); } catch (e2) { /* sem memória */ }
          status.textContent = ''; aoEntrar();
        }
        catch (x) {
          form.classList.add('com-erro');
          status.textContent = /fetch|NetworkError/i.test(x.message) ? 'Sem conexão com o registro. Tente de novo em instantes.' : x.message;
          botao.disabled = false; botao.classList.remove('carregando'); campo.select();
        }
      });
      lado2.appendChild(form);
      setTimeout(function () { (usuario.value ? campo : usuario).focus(); }, 50);
    }
    if (mensagem) lado2.appendChild(el('p', { 'class': 'alerta ' + (mensagem.aviso ? 'aviso' : 'erro'), role: 'status', texto: mensagem.texto }));
    lado2.appendChild(el('div', { 'class': 'portao-rodape' }, [
      el('a', { href: 'index.html', texto: '← Voltar para Criar peça' }),
      el('span', { texto: 'Esqueceu a senha? Fale com o Marketing.' })
    ]));

    caixa.appendChild(el('div', { 'class': 'portao-moldura' }, [marca, lado2]));
  }

  function montarMenu(atual) {
    var nav = document.getElementById('menu-restrito');
    if (!nav) return;
    nav.textContent = '';
    nav.appendChild(el('a', { href: 'index.html', texto: 'Criar peça' }));
    var itens = [['painel.html', 'Painel'], ['nucleo.html', 'Núcleo da Marca'], ['radar.html', 'Radar']];
    if (memoria && memoria.admin) itens.push(['acessos.html', 'Acessos']);
    itens.forEach(function (i) {
      var a = el('a', { href: i[0], texto: i[1] });
      if (i[0] === atual) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    if (memoria && memoria.nome) nav.appendChild(el('span', { 'class': 'quem', texto: memoria.nome }));
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
      return opcoes.aoLiberar({ token: memoria && memoria.senha, admin: !!(local || (memoria && memoria.admin)), usuario: memoria && memoria.usuario, local: !!local, sistema: sistema });
    };
    if (!api()) {
      if (ehLocal()) return liberar(true);
      return telaPortao({ aviso: true, texto: 'O registro ainda não foi ligado (veja docs/registro-cloudflare.md).' }, false);
    }
    // Sessões antigas, abertas só com a senha geral, deixam de valer.
    if (memoria && memoria.senha && memoria.senha.indexOf(':') < 1) gravar(null);
    if (memoria && memoria.senha) {
      if (Date.now() - (memoria.conferido || 0) < 12 * 3600 * 1000) return liberar(false);
      try { gravar(await conferir(memoria.senha)); return liberar(false); } catch (e) { gravar(null); }
    }
    return telaPortao(null, true, function () { liberar(false); });
  }

  function sistemaAtual() { return sistema; }

  raiz.UnimedAcesso = { api: api, proteger: proteger, carregarSistema: carregarSistema, sair: sair, el: el, sistema: sistemaAtual, ehLocal: ehLocal };
})(window);
