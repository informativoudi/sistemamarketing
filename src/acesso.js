/* ============================================================
   Área restrita · login e permissões
   Usa o login do Supabase (e-mail e senha). Só entra quem está na
   tabela "acessos". Papéis: "dono" (gerencia acessos) e "equipe".
   Sem banco configurado, a área restrita só abre no computador
   local (localhost), para testes.
   ============================================================ */
(function (raiz) {
  'use strict';

  var CHAVE = 'unimed-sessao-v1';
  var sistema = null;

  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function gravar(s) { try { if (s) localStorage.setItem(CHAVE, JSON.stringify(s)); else localStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento: sessão só desta aba */ } memoria = s; }
  var memoria = ler();

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
    return { 'apikey': cfg().supabaseChaveAnonima, 'Authorization': 'Bearer ' + (token || cfg().supabaseChaveAnonima), 'Content-Type': 'application/json' };
  }

  function traduzir(corpo, status) {
    var m = String((corpo && (corpo.msg || corpo.error_description || corpo.message || corpo.error)) || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/database error saving new user|não tem acesso liberado/i.test(m)) return 'Este e-mail não tem acesso liberado. Peça para a Comunicação incluir você.';
    if (/already registered|already been registered/i.test(m)) return 'Este e-mail já tem senha. Use "Entrar" ou "Esqueci a senha".';
    if (/password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
    return m || ('Não foi possível concluir (' + status + ').');
  }

  async function auth(caminho, corpo, token, metodo) {
    var r = await fetch(base() + '/auth/v1/' + caminho, { method: metodo || 'POST', headers: cabecalhos(token), body: corpo ? JSON.stringify(corpo) : undefined });
    var j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw new Error(traduzir(j, r.status));
    return j;
  }

  function guardarSessao(j) {
    var s = { token: j.access_token, renovar: j.refresh_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000, email: (j.user && j.user.email) || (memoria && memoria.email) || '' };
    gravar(s);
    return s;
  }

  async function token() {
    var s = memoria;
    if (!s) return null;
    if (Date.now() < s.expira - 60000) return s.token;
    try { return guardarSessao(await auth('token?grant_type=refresh_token', { refresh_token: s.renovar })).token; }
    catch (e) { gravar(null); return null; }
  }

  async function entrar(email, senha) {
    return guardarSessao(await auth('token?grant_type=password', { email: email.trim().toLowerCase(), password: senha }));
  }

  async function criarConta(email, senha) {
    var destino = location.href.split('#')[0];
    var j = await auth('signup?redirect_to=' + encodeURIComponent(destino), { email: email.trim().toLowerCase(), password: senha });
    if (j && j.access_token) { guardarSessao(j); return 'entrou'; }
    return 'confirmar';
  }

  async function lembrarSenha(email) {
    var destino = location.href.split('#')[0];
    await auth('recover?redirect_to=' + encodeURIComponent(destino), { email: email.trim().toLowerCase() });
  }

  async function novaSenha(senha) {
    await auth('user', { password: senha }, await token(), 'PUT');
  }

  async function sair() {
    var t = memoria && memoria.token;
    gravar(null);
    if (t && bancoLigado()) { try { await auth('logout', null, t); } catch (e) { /* já saiu localmente */ } }
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

  /* Volta de um link enviado por e-mail (confirmação ou troca de senha). */
  function lerRetornoDoEmail() {
    if (!/access_token=/.test(location.hash)) return null;
    var p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error_description')) return { erro: p.get('error_description').replace(/\+/g, ' ') };
    guardarSessao({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in') });
    return { tipo: p.get('type') };
  }

  /* ---------- Tela de login ---------- */
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

  function campo(id, rotulo, tipo, auto) {
    return el('div', { 'class': 'campo largo' }, [
      el('label', { 'for': id, texto: rotulo }),
      el('input', { id: id, type: tipo, autocomplete: auto, required: 'required' })
    ]);
  }

  function telaPortao(modo, mensagem, aoEntrar) {
    var caixa = document.getElementById('portao');
    caixa.textContent = '';
    caixa.hidden = false;
    var titulos = {
      entrar: ['Área restrita', 'Painel, Núcleo da Marca e Radar de Tendências. Só para quem tem acesso liberado.'],
      primeiro: ['Primeiro acesso', 'Seu e-mail precisa estar liberado pela Comunicação. Crie uma senha com pelo menos 8 caracteres.'],
      esqueci: ['Esqueci a senha', 'Enviamos um link para você criar uma senha nova.'],
      nova: ['Nova senha', 'Escolha uma senha com pelo menos 8 caracteres.'],
      bloqueado: ['Área restrita', '']
    };
    var t = titulos[modo];
    var cartao = el('div', { 'class': 'cartao portao-cartao' }, [
      el('h1', { 'class': 'portao-titulo' }, [t[0].split(' ')[0].toUpperCase() + ' ', el('span', { texto: t[0].split(' ').slice(1).join(' ') })]),
      t[1] ? el('p', { 'class': 'sub', texto: t[1] }) : null
    ]);
    var aviso = el('div', { role: 'status' });
    if (mensagem) aviso.appendChild(el('p', { 'class': 'alerta ' + (mensagem.ok ? 'ok' : mensagem.aviso ? 'aviso' : 'erro'), texto: mensagem.texto }));

    if (modo === 'bloqueado') { cartao.appendChild(aviso); caixa.appendChild(cartao); return; }

    var form = el('form', { 'class': 'campos', novalidate: 'novalidate' });
    if (modo !== 'nova') form.appendChild(campo('p-email', 'E-mail', 'email', 'username'));
    if (modo === 'entrar') form.appendChild(campo('p-senha', 'Senha', 'password', 'current-password'));
    if (modo === 'primeiro' || modo === 'nova') {
      form.appendChild(campo('p-senha', 'Senha', 'password', 'new-password'));
      form.appendChild(campo('p-senha2', 'Repita a senha', 'password', 'new-password'));
    }
    var botao = el('button', { 'class': 'btn primario', type: 'submit', texto: { entrar: 'Entrar', primeiro: 'Criar senha', esqueci: 'Enviar link', nova: 'Salvar senha' }[modo] });
    form.appendChild(el('div', { 'class': 'campo largo' }, [botao]));
    cartao.appendChild(form);
    cartao.appendChild(aviso);

    var links = el('p', { 'class': 'portao-links' });
    function link(texto, alvo) { return el('button', { type: 'button', 'class': 'link', texto: texto, onclick: function () { telaPortao(alvo, null, aoEntrar); } }); }
    if (modo === 'entrar') { links.appendChild(link('Primeiro acesso', 'primeiro')); links.appendChild(link('Esqueci a senha', 'esqueci')); }
    else if (modo !== 'nova') links.appendChild(link('Voltar para entrar', 'entrar'));
    cartao.appendChild(links);
    caixa.appendChild(cartao);

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var v = function (id) { var i = document.getElementById(id); return i ? i.value : ''; };
      aviso.textContent = '';
      var erro = function (m) { aviso.textContent = ''; aviso.appendChild(el('p', { 'class': 'alerta erro', texto: m })); };
      if (modo !== 'nova' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('p-email').trim())) return erro('Digite um e-mail válido.');
      if ((modo === 'primeiro' || modo === 'nova') && v('p-senha').length < 8) return erro('A senha precisa ter pelo menos 8 caracteres.');
      if ((modo === 'primeiro' || modo === 'nova') && v('p-senha') !== v('p-senha2')) return erro('As duas senhas não são iguais.');
      if (modo === 'entrar' && !v('p-senha')) return erro('Digite sua senha.');
      botao.disabled = true;
      try {
        if (modo === 'entrar') { await entrar(v('p-email'), v('p-senha')); await aoEntrar(); }
        else if (modo === 'primeiro') {
          var r = await criarConta(v('p-email'), v('p-senha'));
          if (r === 'entrou') await aoEntrar();
          else telaPortao('entrar', { ok: true, texto: 'Pronto. Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.' }, aoEntrar);
        } else if (modo === 'esqueci') {
          await lembrarSenha(v('p-email'));
          telaPortao('entrar', { ok: true, texto: 'Se o e-mail tiver acesso, o link chega em alguns minutos. Confira também o spam.' }, aoEntrar);
        } else if (modo === 'nova') { await novaSenha(v('p-senha')); await aoEntrar(); }
      } catch (e) { erro(e.message); }
      botao.disabled = false;
    });
    var primeiro = form.querySelector('input'); if (primeiro) primeiro.focus();
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
    nav.appendChild(el('button', { type: 'button', 'class': 'link sair', title: ctx.email || 'Modo local', texto: 'Sair', onclick: sair }));
  }

  /* Protege a página: só chama aoLiberar(ctx) quando a pessoa tem acesso. */
  async function proteger(opcoes) {
    var conteudo = document.getElementById('conteudo-restrito');
    conteudo.hidden = true;
    await carregarSistema();

    if (!bancoLigado()) {
      if (ehLocal()) {
        var ctxLocal = { papel: 'dono', email: '', token: null, local: true, sistema: sistema };
        montarMenu(ctxLocal, opcoes.pagina);
        conteudo.hidden = false;
        return opcoes.aoLiberar(ctxLocal);
      }
      return telaPortao('bloqueado', { aviso: true, texto: 'A área restrita ainda não foi ligada. Ela abre depois que o banco com login estiver configurado (veja docs/acesso-restrito.md).' });
    }

    var retorno = lerRetornoDoEmail();

    async function liberar() {
      var p;
      try { p = await papel(); }
      catch (e) { return telaPortao('entrar', { texto: e.message }, liberar); }
      if (!p) {
        var tinhaSessao = !!memoria;
        gravar(null);
        return telaPortao('entrar', tinhaSessao ? { texto: 'Seu e-mail não tem acesso à área restrita. Peça para a Comunicação incluir você.' } : null, liberar);
      }
      if (opcoes.papelMinimo === 'dono' && p !== 'dono') {
        return telaPortao('bloqueado', { aviso: true, texto: 'Só quem administra os acessos pode abrir esta página.' });
      }
      document.getElementById('portao').hidden = true;
      var ctx = { papel: p, email: memoria && memoria.email, token: await token(), local: false, sistema: sistema };
      montarMenu(ctx, opcoes.pagina);
      conteudo.hidden = false;
      return opcoes.aoLiberar(ctx);
    }

    if (retorno && retorno.erro) return telaPortao('entrar', { texto: 'O link expirou ou já foi usado. Peça um novo.' }, liberar);
    if (retorno && retorno.tipo === 'recovery') return telaPortao('nova', null, liberar);
    if (!(await token())) return telaPortao('entrar', null, liberar);
    return liberar();
  }

  /* Chamadas ao banco já com o login da pessoa. */
  async function banco(caminho, opcoes) {
    opcoes = opcoes || {};
    var r = await fetch(base() + '/rest/v1/' + caminho, { method: opcoes.metodo || 'GET', headers: Object.assign(cabecalhos(await token()), opcoes.cabecalhos || {}), body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined });
    if (!r.ok) {
      var j = null; try { j = await r.json(); } catch (e) { j = null; }
      if (j && /duplicate key/i.test(j.message || '')) throw new Error('Esse e-mail já está na lista.');
      throw new Error((j && j.message) || ('O banco recusou a operação (' + r.status + ').'));
    }
    return r.status === 204 ? null : r.json().catch(function () { return null; });
  }

  raiz.UnimedAcesso = { proteger: proteger, banco: banco, token: token, carregarSistema: carregarSistema, bancoLigado: bancoLigado, sair: sair, el: el };
})(window);
