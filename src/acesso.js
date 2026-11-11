/* ============================================================
   Área restrita · login com GitHub e permissões
   O login passa pelo Supabase (provedor GitHub). Só entra quem
   tem o usuário do GitHub na tabela "acessos".
   Papéis: "dono" (gerencia acessos) e "equipe".
   Sem banco configurado, a área restrita só abre no computador
   local (localhost), para testes.
   ============================================================ */
(function (raiz) {
  'use strict';

  var CHAVE = 'unimed-sessao-v2';
  var sistema = null;

  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  var memoria = ler();
  function gravar(s) { memoria = s; try { if (s) localStorage.setItem(CHAVE, JSON.stringify(s)); else localStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento: vale só nesta aba */ } }

  function cfg() { return (sistema && sistema.registro) || {}; }
  function base() { return String(cfg().supabaseUrl || '').replace(/\/$/, ''); }
  function bancoLigado() { return cfg().modo === 'supabase' && !!base() && !!cfg().supabaseChaveAnonima; }
  function ehLocal() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }

  async function carregarSistema() {
    if (sistema) return sistema;
    try { sistema = await fetch('config/sistema.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
    catch (e) { sistema = { registro: { modo: 'local' } }; }
    return sistema;
  }

  function cabecalhos(token) {
    var h = { 'apikey': cfg().supabaseChaveAnonima, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token; // chave "sb_publishable_" vai só no apikey
    return h;
  }

  /* Lê o usuário do GitHub de dentro do token (só para exibir; quem decide o acesso é o banco). */
  function lerToken(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var j = JSON.parse(decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4)))));
      var meta = j.user_metadata || {};
      return { github: meta.user_name || meta.preferred_username || '', nome: meta.full_name || meta.name || '', foto: meta.avatar_url || '' };
    } catch (e) { return { github: '', nome: '', foto: '' }; }
  }

  function guardarSessao(acesso, renovar, expiraEm) {
    var info = lerToken(acesso);
    gravar({ token: acesso, renovar: renovar, expira: Date.now() + (Number(expiraEm) || 3600) * 1000, github: info.github, nome: info.nome, foto: info.foto });
  }

  async function token() {
    var s = memoria;
    if (!s) return null;
    if (Date.now() < s.expira - 60000) return s.token;
    try {
      var r = await fetch(base() + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ refresh_token: s.renovar }) });
      if (!r.ok) throw new Error();
      var j = await r.json();
      guardarSessao(j.access_token, j.refresh_token, j.expires_in);
      return memoria.token;
    } catch (e) { gravar(null); return null; }
  }

  function entrarComGitHub() {
    var volta = location.href.split('#')[0].split('?')[0];
    location.href = base() + '/auth/v1/authorize?provider=github&redirect_to=' + encodeURIComponent(volta);
  }

  async function sair() {
    var t = memoria && memoria.token;
    gravar(null);
    if (t && bancoLigado()) { try { await fetch(base() + '/auth/v1/logout', { method: 'POST', headers: cabecalhos(t) }); } catch (e) { /* já saiu aqui */ } }
    location.href = 'index.html';
  }

  async function papel() {
    var t = await token();
    if (!t) return null;
    var r = await fetch(base() + '/rest/v1/rpc/meu_papel', { method: 'POST', headers: cabecalhos(t), body: '{}' });
    if (r.status === 401) { gravar(null); return null; }
    if (!r.ok) throw new Error('Não foi possível conferir seu acesso (' + r.status + ').');
    return r.json();
  }

  /* Volta do GitHub: o Supabase devolve o login no endereço (#access_token=…) ou um erro. */
  function lerRetorno() {
    var texto = location.hash.slice(1) + '&' + location.search.slice(1);
    if (!/access_token=|error=/.test(texto)) return null;
    var p = new URLSearchParams(texto);
    history.replaceState(null, '', location.pathname);
    if (p.get('error')) {
      var d = String(p.get('error_description') || '').replace(/\+/g, ' ');
      if (/database error|não tem acesso|saving new user/i.test(d)) return { erro: 'Seu usuário do GitHub não tem acesso liberado. Peça para a Comunicação incluir você.' };
      if (/access_denied/i.test(p.get('error'))) return { erro: 'O login foi cancelado no GitHub.' };
      return { erro: d || 'Não foi possível entrar com o GitHub.' };
    }
    guardarSessao(p.get('access_token'), p.get('refresh_token'), p.get('expires_in'));
    return { ok: true };
  }

  /* ---------- Tela de entrada ---------- */
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }

  var ICONE_GITHUB = '<svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  function telaPortao(mensagem, comBotao) {
    var caixa = document.getElementById('portao');
    caixa.textContent = '';
    caixa.hidden = false;
    var cartao = el('div', { 'class': 'cartao portao-cartao' }, [
      el('h1', { 'class': 'portao-titulo' }, ['ÁREA ', el('span', { texto: 'restrita' })]),
      el('p', { 'class': 'sub', texto: 'Painel, Núcleo da Marca e Radar de Tendências. Só para quem tem acesso liberado.' })
    ]);
    if (comBotao) {
      var botao = el('button', { 'class': 'btn primario btn-github', type: 'button', onclick: entrarComGitHub });
      botao.innerHTML = ICONE_GITHUB;
      botao.appendChild(document.createTextNode('Entrar com GitHub'));
      cartao.appendChild(botao);
    }
    if (mensagem) cartao.appendChild(el('p', { 'class': 'alerta ' + (mensagem.aviso ? 'aviso' : 'erro'), role: 'status', texto: mensagem.texto }));
    caixa.appendChild(cartao);
  }

  /* ---------- Menu da área restrita ---------- */
  function montarMenu(ctx, atual) {
    var nav = document.getElementById('menu-restrito');
    if (!nav) return;
    nav.textContent = '';
    var itens = [['painel.html', 'Painel'], ['nucleo.html', 'Núcleo da Marca'], ['radar.html', 'Radar']];
    if (ctx.papel === 'dono') itens.push(['acessos.html', 'Acessos']);
    nav.appendChild(el('a', { href: 'index.html', texto: 'Criar peça' }));
    itens.forEach(function (i) {
      var a = el('a', { href: i[0], texto: i[1] });
      if (i[0] === atual) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    var quem = ctx.github ? '@' + ctx.github : 'modo local';
    var sairBtn = el('button', { type: 'button', 'class': 'link sair', title: 'Sair (' + quem + ')', onclick: sair });
    if (ctx.foto) sairBtn.appendChild(el('img', { src: ctx.foto, alt: '', width: '22', height: '22' }));
    sairBtn.appendChild(document.createTextNode('Sair'));
    nav.appendChild(sairBtn);
  }

  /* Protege a página: só chama aoLiberar(ctx) quando a pessoa tem acesso. */
  async function proteger(opcoes) {
    var conteudo = document.getElementById('conteudo-restrito');
    conteudo.hidden = true;
    await carregarSistema();

    if (!bancoLigado()) {
      if (ehLocal()) {
        var ctxLocal = { papel: 'dono', github: '', token: null, local: true, sistema: sistema };
        montarMenu(ctxLocal, opcoes.pagina);
        conteudo.hidden = false;
        return opcoes.aoLiberar(ctxLocal);
      }
      return telaPortao({ aviso: true, texto: 'A área restrita ainda não foi ligada. Ela abre depois que o login estiver configurado (veja docs/acesso-restrito.md).' }, false);
    }

    var retorno = lerRetorno();
    if (retorno && retorno.erro) return telaPortao({ texto: retorno.erro }, true);
    if (!(await token())) return telaPortao(null, true);

    var p;
    try { p = await papel(); }
    catch (e) { return telaPortao({ texto: e.message }, true); }
    if (!p) {
      var quem = memoria && memoria.github ? ' (@' + memoria.github + ')' : '';
      gravar(null);
      return telaPortao({ texto: 'Seu usuário do GitHub' + quem + ' não tem acesso liberado. Peça para a Comunicação incluir você.' }, true);
    }
    if (opcoes.papelMinimo === 'dono' && p !== 'dono') {
      return telaPortao({ aviso: true, texto: 'Só quem administra os acessos pode abrir esta página.' }, false);
    }
    document.getElementById('portao').hidden = true;
    var ctx = { papel: p, github: memoria.github, foto: memoria.foto, token: await token(), local: false, sistema: sistema };
    montarMenu(ctx, opcoes.pagina);
    conteudo.hidden = false;
    return opcoes.aoLiberar(ctx);
  }

  /* Chamadas ao banco já com o login da pessoa. */
  async function banco(caminho, opcoes) {
    opcoes = opcoes || {};
    var r = await fetch(base() + '/rest/v1/' + caminho, { method: opcoes.metodo || 'GET', headers: Object.assign(cabecalhos(await token()), opcoes.cabecalhos || {}), body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined });
    if (!r.ok) {
      var j = null; try { j = await r.json(); } catch (e) { j = null; }
      if (j && /duplicate key/i.test(j.message || '')) throw new Error('Esse usuário já está na lista.');
      throw new Error((j && j.message) || ('O banco recusou a operação (' + r.status + ').'));
    }
    return r.status === 204 ? null : r.json().catch(function () { return null; });
  }

  raiz.UnimedAcesso = { proteger: proteger, banco: banco, token: token, carregarSistema: carregarSistema, bancoLigado: bancoLigado, sair: sair, el: el };
})(window);
