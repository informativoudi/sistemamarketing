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

  function limpar(campo) {
    var ini = campo.selectionStart, fim = campo.selectionEnd;
    if (ini === fim) { ini = 0; fim = campo.value.length; }
    var trecho = campo.value.slice(ini, fim)
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

  /* realces: [{ id, nome, fundo, texto }] já com as cores resolvidas. */
  function barra(campo, realces) {
    var caixa = document.createElement('div');
    caixa.className = 'fmt-barra';
    caixa.setAttribute('role', 'toolbar');
    caixa.setAttribute('aria-label', 'Formatação do texto');
    caixa.appendChild(botao('<b>B</b>', 'Negrito (Ctrl+B)', '', function () { envolver(campo, '**', '**', 'texto em negrito'); }));
    caixa.appendChild(botao('<i>I</i>', 'Itálico (Ctrl+I)', '', function () { envolver(campo, '*', '*', 'texto em itálico'); }));
    var sep = document.createElement('span'); sep.className = 'fmt-sep'; sep.setAttribute('aria-hidden', 'true');
    caixa.appendChild(sep);
    var rot = document.createElement('span'); rot.className = 'fmt-rot'; rot.textContent = 'Realce';
    caixa.appendChild(rot);
    realces.forEach(function (r) {
      var b = botao('<span>Aa</span>', 'Realce ' + r.nome, 'fmt-realce', function () { envolver(campo, '==(' + r.id + ')', '==', 'destaque'); });
      b.style.background = r.fundo;
      b.style.color = r.texto;
      caixa.appendChild(b);
    });
    var sep2 = sep.cloneNode(); caixa.appendChild(sep2);
    caixa.appendChild(botao('Limpar', 'Tirar a formatação do trecho selecionado', 'fmt-limpar', function () { limpar(campo); }));

    campo.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); envolver(campo, '**', '**', 'texto em negrito'); }
      if (k === 'i') { e.preventDefault(); envolver(campo, '*', '*', 'texto em itálico'); }
    });
    return caixa;
  }

  raiz.UnimedFormatacao = { barra: barra };
})(window);
