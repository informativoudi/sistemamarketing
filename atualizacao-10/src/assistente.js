/* ============================================================
   Assistente da marca (IA) · só no Núcleo da Marca e no Radar
   1. A pessoa escreve o pedido ("deixe o laranja só no botão",
      "crie um branding para a campanha de inverno"…).
   2. A função "assistente" no Supabase devolve as mudanças nos
      arquivos de regras (JSON) com o motivo de cada uma.
   3. A pessoa revisa (antes → depois), testa na prévia do gerador
      sem publicar e, se estiver bom, publica no GitHub.
   O gerador continua sem IA: ele só lê as regras publicadas.
   ============================================================ */
(function (raiz) {
  'use strict';
  var A = raiz.UnimedAcesso, el = A.el;
  var CHAVE_TESTE = 'unimed-teste-config';

  function lerTeste() { try { return JSON.parse(localStorage.getItem(CHAVE_TESTE) || '{}'); } catch (e) { return {}; } }
  function gravarTeste(v) { try { localStorage.setItem(CHAVE_TESTE, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- Diferenças linha a linha (antes → depois) ---------- */
  function diferencas(a, b) {
    var x = a.split('\n'), y = b.split('\n');
    var n = x.length, m = y.length;
    if (n * m > 2500000) return null; // arquivo grande demais para comparar aqui
    var t = [];
    for (var i = 0; i <= n; i++) { t.push(new Uint16Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { out.push([' ', x[i]]); i++; j++; }
      else if (t[i + 1][j] >= t[i][j + 1]) { out.push(['-', x[i]]); i++; }
      else { out.push(['+', y[j]]); j++; }
    }
    while (i < n) out.push(['-', x[i++]]);
    while (j < m) out.push(['+', y[j++]]);
    return out;
  }
  function blocoDiferencas(antes, depois) {
    var d = diferencas(JSON.stringify(antes || {}, null, 2), JSON.stringify(depois, null, 2));
    var pre = el('pre', { 'class': 'dif' });
    if (!d) { pre.textContent = 'Arquivo grande demais para mostrar as diferenças aqui.'; return pre; }
    var mudou = d.map(function (l) { return l[0] !== ' '; });
    var mostrar = d.map(function (l, k) { for (var q = Math.max(0, k - 2); q <= Math.min(d.length - 1, k + 2); q++) if (mudou[q]) return true; return false; });
    var pulou = false, linhas = 0;
    d.forEach(function (l, k) {
      if (!mostrar[k]) { if (!pulou) { pre.appendChild(el('span', { 'class': 'dif-linha dif-pulo', texto: '⋯' })); pulou = true; } return; }
      pulou = false; linhas++;
      pre.appendChild(el('span', { 'class': 'dif-linha ' + (l[0] === '+' ? 'dif-mais' : l[0] === '-' ? 'dif-menos' : ''), texto: (l[0] === ' ' ? '  ' : l[0] + ' ') + l[1] }));
    });
    if (!linhas) pre.textContent = 'Nenhuma diferença.';
    return pre;
  }

  /* ---------- Publicar no GitHub (com a permissão dada no login) ---------- */
  function base64(texto) {
    var bytes = new TextEncoder().encode(texto), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function publicar(alteracoes, mensagem) {
    var sis = A.sistema() || {}, rep = sis.repositorio || {};
    var tk = A.tokenGithub();
    if (!tk) throw new Error('Para publicar, saia e entre de novo com o GitHub: o login vai pedir a permissão de gravar no repositório.');
    var api = 'https://api.github.com/repos/' + rep.dono + '/' + rep.nome + '/contents/';
    var cab = { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json' };
    for (var i = 0; i < alteracoes.length; i++) {
      var a = alteracoes[i];
      var atual = await fetch(api + a.arquivo + '?ref=' + encodeURIComponent(rep.ramo || 'main'), { headers: cab });
      if (atual.status === 401 || atual.status === 403) throw new Error('O GitHub recusou a permissão. Saia e entre de novo; se continuar, confira se sua conta pode gravar em ' + rep.dono + '/' + rep.nome + '.');
      var sha = atual.ok ? (await atual.json()).sha : undefined;
      var r = await fetch(api + a.arquivo, {
        method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, cab),
        body: JSON.stringify({ message: mensagem + (a.motivo ? '\n\n' + a.motivo : ''), content: base64(JSON.stringify(a.conteudo, null, 2) + '\n'), sha: sha, branch: rep.ramo || 'main' })
      });
      if (!r.ok) {
        var j = null; try { j = await r.json(); } catch (e) { j = null; }
        throw new Error('Não consegui publicar ' + a.arquivo + ' (' + r.status + (j && j.message ? ': ' + j.message : '') + ').');
      }
    }
  }

  /* ---------- Tela ---------- */
  function montar(alvo, opcoes) {
    var historico = [];
    var cartao = el('section', { 'class': 'cartao bloco assistente', 'aria-labelledby': 'assistente-titulo' });
    cartao.appendChild(el('div', { 'class': 'assistente-topo' }, [
      el('h2', { id: 'assistente-titulo', texto: opcoes.titulo || 'Assistente da marca' }),
      el('span', { 'class': 'selo ia', texto: 'IA' })
    ]));
    cartao.appendChild(el('p', { 'class': 'sub', texto: opcoes.descricao || '' }));

    var conversa = el('div', { 'class': 'assistente-conversa', 'aria-live': 'polite' });
    var campo = el('textarea', { id: 'assistente-pedido', rows: '3', placeholder: opcoes.placeholder || 'O que você quer mudar?' });
    var enviar = el('button', { type: 'submit', 'class': 'btn primario' }, ['Pedir ao assistente']);
    var extra = opcoes.extra ? opcoes.extra() : null;
    var form = el('form', { 'class': 'assistente-form' }, [
      el('label', { 'for': 'assistente-pedido', 'class': 'sr-only', texto: 'Pedido ao assistente' }),
      campo, extra, el('div', { 'class': 'acoes' }, [enviar])
    ]);
    var exemplos = el('div', { 'class': 'pilulas assistente-exemplos' }, (opcoes.exemplos || []).map(function (t) {
      return el('button', { type: 'button', 'class': 'btn-mini', texto: t, onclick: function () { campo.value = t; campo.focus(); } });
    }));
    cartao.appendChild(exemplos);
    cartao.appendChild(conversa);
    cartao.appendChild(form);

    var sis = A.sistema() || {};
    var ligado = A.bancoLigado();
    if (!ligado) {
      cartao.appendChild(el('p', { 'class': 'alerta aviso', texto: 'O assistente funciona no site publicado, com o login do GitHub e a função "assistente" ligada no Supabase (veja docs/assistente-ia.md).' }));
      enviar.disabled = true;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var pedido = campo.value.trim();
      if (!pedido) { campo.focus(); return; }
      enviar.disabled = true; enviar.textContent = 'Pensando…';
      conversa.appendChild(el('div', { 'class': 'msg-pessoa', texto: pedido }));
      var espera = el('div', { 'class': 'msg-ia carregando', texto: 'O assistente está lendo as regras e preparando a proposta…' });
      conversa.appendChild(espera);
      try {
        var arquivos = await opcoes.arquivos();
        var r = await fetch(A.urlBanco() + '/functions/v1/' + ((sis.assistente && sis.assistente.funcao) || 'assistente'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: A.chaveBanco(), Authorization: 'Bearer ' + (await A.token()) },
          body: JSON.stringify({ area: opcoes.area, pedido: pedido, arquivos: arquivos, historico: historico })
        });
        var j = null; try { j = await r.json(); } catch (x) { j = null; }
        if (!r.ok || !j) throw new Error((j && j.erro) || (r.status === 404 ? 'A função "assistente" ainda não foi criada no Supabase.' : 'O assistente não respondeu (' + r.status + ').'));
        espera.remove();
        historico.push({ papel: 'pessoa', texto: pedido });
        historico.push({ papel: 'assistente', texto: j.resposta + (j.alteracoes.length ? ' [propôs mudanças em ' + j.alteracoes.map(function (a) { return a.arquivo; }).join(', ') + ']' : '') });
        conversa.appendChild(proposta(j, arquivos, pedido));
        campo.value = '';
      } catch (x) {
        espera.className = 'msg-ia erro';
        espera.textContent = x.message === 'Failed to fetch' ? 'Sem conexão com o assistente. Confira se a função "assistente" foi publicada no Supabase.' : x.message;
      } finally { enviar.disabled = !ligado; enviar.textContent = 'Pedir ao assistente'; }
    });

    function proposta(j, arquivos, pedido) {
      var caixa = el('div', { 'class': 'msg-ia' });
      caixa.appendChild(el('p', { texto: j.resposta || 'Pronto.' }));
      if (j.limites && j.limites.length) caixa.appendChild(el('ul', { 'class': 'limites' }, j.limites.map(function (l) { return el('li', { texto: l }); })));
      if (!j.alteracoes.length) return caixa;
      j.alteracoes.forEach(function (a) {
        var det = el('details', { 'class': 'mudanca', open: j.alteracoes.length === 1 ? true : null }, [
          el('summary', {}, [el('code', { texto: a.arquivo }), a.motivo ? ' · ' + a.motivo : '']),
          blocoDiferencas(arquivos[a.arquivo], a.conteudo)
        ]);
        caixa.appendChild(det);
      });
      var status = el('p', { 'class': 'ajuda', role: 'status' });
      var testar = el('button', { type: 'button', 'class': 'btn secundario' }, ['Testar na prévia']);
      var pub = el('button', { type: 'button', 'class': 'btn primario' }, ['Publicar no site']);
      var descartar = el('button', { type: 'button', 'class': 'link' }, ['Descartar']);
      testar.addEventListener('click', function () {
        var t = lerTeste();
        j.alteracoes.forEach(function (a) { t[a.arquivo] = a.conteudo; });
        if (!gravarTeste(t)) { status.textContent = 'Não consegui guardar o teste neste navegador.'; return; }
        status.textContent = 'Abrindo o gerador em modo teste (só neste navegador; nada foi publicado).';
        raiz.open('index.html?teste=1', '_blank', 'noopener');
      });
      pub.addEventListener('click', async function () {
        pub.disabled = true; testar.disabled = true; pub.textContent = 'Publicando…';
        try {
          await publicar(j.alteracoes, 'Assistente da marca: ' + pedido.slice(0, 72));
          var t = lerTeste(); j.alteracoes.forEach(function (a) { delete t[a.arquivo]; }); gravarTeste(t);
          status.textContent = 'Publicado no GitHub. O site atualiza em 1 a 2 minutos; depois recarregue esta página.';
          pub.textContent = 'Publicado';
        } catch (x) {
          status.textContent = x.message; pub.disabled = false; testar.disabled = false; pub.textContent = 'Publicar no site';
        }
      });
      descartar.addEventListener('click', function () { caixa.classList.add('descartada'); status.textContent = 'Proposta descartada.'; pub.disabled = testar.disabled = true; });
      caixa.appendChild(el('div', { 'class': 'acoes' }, [pub, testar, descartar]));
      caixa.appendChild(status);
      return caixa;
    }

    alvo.insertBefore(cartao, alvo.firstChild);
    return cartao;
  }

  raiz.UnimedAssistente = { montar: montar, diferencas: diferencas, CHAVE_TESTE: CHAVE_TESTE };
})(window);
