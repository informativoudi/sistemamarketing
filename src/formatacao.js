/* ============================================================
   Barra de formatação · negrito, itálico e realce arredondado
   Trabalha sobre o campo de texto com marcas simples, que a prévia
   já mostra formatadas:  **negrito**   *itálico*   ==(cor)realce==
   Atalhos: Ctrl/Cmd + B (negrito) e Ctrl/Cmd + I (itálico).
   ============================================================ */
(function (raiz) {
  'use strict';

  function avisar(campo) { campo.dispatchEvent(new Event('input', { bubbles: true })); }

  function envolver(campo, antes, depois, exemplo) {
    var ini = campo.selectionStart, fim = campo.selectionEnd;
    var v = campo.value;
    var sel = v.slice(ini, fim);
    // Mantém espaços fora das marcas (" texto " → " **texto** ").
    var esq = sel.match(/^\s*/)[0], dir = sel.match(/\s*$/)[0];
    var miolo = sel.slice(esq.length, sel.length - dir.length);
    // Já formatado com a mesma marca: remove.
    if (miolo && miolo.indexOf(antes) === 0 && miolo.slice(-depois.length) === depois && miolo.length > antes.length + depois.length) {
      var limpo = miolo.slice(antes.length, miolo.length - depois.length);
      campo.value = v.slice(0, ini) + esq + limpo + dir + v.slice(fim);
      campo.setSelectionRange(ini + esq.length, ini + esq.length + limpo.length);
      avisar(campo); return;
    }
    var texto = miolo || exemplo;
    campo.value = v.slice(0, ini) + esq + antes + texto + depois + dir + v.slice(fim);
    var a = ini + esq.length + antes.length;
    campo.focus();
    campo.setSelectionRange(a, a + texto.length);
    avisar(campo);
  }

  /* ---------- Parágrafo em box: >>(cor) no começo do parágrafo ---------- */
  var BOX = /^>>(?:\(([a-z0-9-]+)\))?[ \t]*/i;
  function paragrafos(v, ini, fim) {
    // devolve [{a, b}] dos parágrafos (separados por linha em branco) tocados pela seleção
    var lista = [], re = /\n[ \t]*\n/g, a = 0, m;
    var cortes = [];
    while ((m = re.exec(v))) cortes.push([m.index, re.lastIndex]);
    cortes.push([v.length, v.length]);
    cortes.forEach(function (c) {
      var b = c[0];
      if (b >= ini && a <= Math.max(fim, ini) && v.slice(a, b).trim()) lista.push({ a: a, b: b });
      a = c[1];
    });
    return lista;
  }
  /* cor: id do realce; null alterna (tira se já for box, senão usa a cor padrão). */
  function aplicarBox(campo, cor, padrao) {
    var v = campo.value, ini = campo.selectionStart, fim = campo.selectionEnd;
    var ps = paragrafos(v, ini, fim);
    if (!ps.length) return false;
    var todosBox = ps.every(function (p) { return BOX.test(v.slice(p.a, p.b).replace(/^\s+/, '')); });
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      var trecho = v.slice(p.a, p.b);
      var esp = trecho.match(/^\s*/)[0];
      var miolo = trecho.slice(esp.length).replace(BOX, '');
      var novo = (cor == null && todosBox) ? miolo : '>>(' + (cor || padrao) + ') ' + miolo;
      v = v.slice(0, p.a) + esp + novo + v.slice(p.b);
    }
    campo.value = v;
    var fimSel = paragrafos(v, ps[0].a, ps[0].a)[0];
    campo.focus();
    if (fimSel) campo.setSelectionRange(fimSel.a, ps.length > 1 ? paragrafos(v, ps[0].a, v.length).slice(0, ps.length).pop().b : fimSel.b);
    avisar(campo);
    return true;
  }
  /* A seleção cobre um parágrafo inteiro (ou mais)? Então o realce vira box. */
  function cobreParagrafo(campo) {
    var v = campo.value, ini = campo.selectionStart, fim = campo.selectionEnd;
    if (fim - ini < 2) return false;
    var ps = paragrafos(v, ini, fim);
    if (!ps.length) return false;
    var primeiro = ps[0], ultimo = ps[ps.length - 1];
    var inicioTexto = primeiro.a + v.slice(primeiro.a, primeiro.b).search(/\S/);
    var semMarca = v.slice(inicioTexto, primeiro.b).match(BOX);
    if (semMarca) inicioTexto += semMarca[0].length;
    var fimTexto = ultimo.a + v.slice(ultimo.a, ultimo.b).replace(/\s+$/, '').length;
    return ini <= inicioTexto && fim >= fimTexto;
  }

  function limpar(campo) {
    var ini = campo.selectionStart, fim = campo.selectionEnd;
    if (ini === fim) { ini = 0; fim = campo.value.length; }
    var trecho = campo.value.slice(ini, fim)
      .replace(/(^|\n)[ \t]*>>(?:\([a-z0-9-]+\))?[ \t]*/gi, '$1')
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1$2');
    campo.value = campo.value.slice(0, ini) + trecho + campo.value.slice(fim);
    campo.setSelectionRange(ini, ini + trecho.length);
    avisar(campo);
  }

  function botao(texto, titulo, classe, acao) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fmt-btn ' + (classe || '');
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    b.innerHTML = texto;
    // mousedown evita que o campo perca a seleção antes do clique.
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', acao);
    return b;
  }

  /* realces: [{ id, nome, fundo, texto }] já com as cores resolvidas.
     modo 'completo': negrito, itálico, realce e box (texto corrido)
     modo 'simples': só negrito e itálico (ex.: subtítulo)
     modo 'realce': só o realce */
  function barra(campo, realces, modo) {
    var completo = modo !== 'realce';
    var comRealce = modo !== 'simples';
    var comBox = modo === 'completo' && campo.tagName === 'TEXTAREA';
    var padrao = (realces.filter(function (r) { return r.id === 'verde'; })[0] || realces[0] || {}).id;
    var caixa = document.createElement('div');
    caixa.className = 'fmt-barra';
    caixa.setAttribute('role', 'toolbar');
    caixa.setAttribute('aria-label', 'Formatação do texto');
    var sep = document.createElement('span'); sep.className = 'fmt-sep'; sep.setAttribute('aria-hidden', 'true');
    if (completo) {
      caixa.appendChild(botao('<b>B</b>', 'Negrito (Ctrl+B)', '', function () { envolver(campo, '**', '**', 'texto em negrito'); }));
      caixa.appendChild(botao('<i>I</i>', 'Itálico (Ctrl+I)', '', function () { envolver(campo, '*', '*', 'texto em itálico'); }));
      caixa.appendChild(sep);
    }
    if (comRealce) {
      var rot = document.createElement('span'); rot.className = 'fmt-rot'; rot.textContent = 'Realce';
      caixa.appendChild(rot);
      realces.forEach(function (r) {
        var b = botao('<span>Aa</span>', 'Realce ' + r.nome + (comBox ? ' (parágrafo inteiro selecionado vira box)' : ''), 'fmt-realce', function () {
          if (comBox && cobreParagrafo(campo)) aplicarBox(campo, r.id, padrao);
          else envolver(campo, '==(' + r.id + ')', '==', 'destaque');
        });
        b.style.background = r.fundo;
        b.style.color = r.texto;
        caixa.appendChild(b);
      });
    }
    if (comBox) {
      caixa.appendChild(botao('<span class="fmt-box-ico" aria-hidden="true"></span>Box', 'Parágrafo em box: põe ou tira o box do parágrafo onde está o cursor', 'fmt-box', function () { aplicarBox(campo, null, padrao); }));
    }
    var sep2 = sep.cloneNode(); caixa.appendChild(sep2);
    caixa.appendChild(botao('Limpar', 'Tirar a formatação do trecho selecionado', 'fmt-limpar', function () { limpar(campo); }));

    campo.addEventListener('keydown', function (e) {
      if (!completo || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); envolver(campo, '**', '**', 'texto em negrito'); }
      if (k === 'i') { e.preventDefault(); envolver(campo, '*', '*', 'texto em itálico'); }
    });
    return caixa;
  }

  raiz.UnimedFormatacao = { barra: barra };
})(window);
