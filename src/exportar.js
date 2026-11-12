/* ============================================================
   Exportar a peça em Imagem (PNG), PDF e PowerPoint (PPTX)
   - Imagem e PDF: fotografia fiel do e-mail (PDF mantém o link do botão).
   - PowerPoint: um slide do tamanho do e-mail, com caixas, imagens e
     TEXTOS EDITÁVEIS nas mesmas posições, para ajustes de texto.
   As bibliotecas ficam em src/vendor e só carregam quando alguém exporta.
   ============================================================ */
(function (raiz) {
  'use strict';

  var LIBS = {
    html2canvas: 'src/vendor/html2canvas.min.js',
    jspdf: 'src/vendor/jspdf.umd.min.js',
    pptx: 'src/vendor/pptxgen.bundle.js'
  };
  var carregadas = {};

  function carregar(nome) {
    if (carregadas[nome]) return carregadas[nome];
    carregadas[nome] = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = LIBS[nome];
      s.onload = ok;
      s.onerror = function () { delete carregadas[nome]; falha(new Error('Não consegui carregar a ferramenta de exportação.')); };
      document.head.appendChild(s);
    });
    return carregadas[nome];
  }

  /* Monta o e-mail num quadro invisível, do tamanho real, e espera as imagens. */
  function montar(html) {
    return new Promise(function (ok, falha) {
      var quadro = document.createElement('iframe');
      quadro.setAttribute('aria-hidden', 'true');
      quadro.tabIndex = -1;
      quadro.style.cssText = 'position:fixed;left:-10000px;top:0;width:680px;height:2000px;border:0;visibility:hidden;';
      document.body.appendChild(quadro);
      var limite = setTimeout(function () { falha(new Error('O e-mail demorou demais para montar.')); }, 20000);
      quadro.onload = function () {
        var doc = quadro.contentDocument;
        var imgs = Array.prototype.slice.call(doc.images);
        Promise.all(imgs.map(function (img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function (r) { img.onload = img.onerror = r; });
        })).then(function () {
          return doc.fonts && doc.fonts.ready ? doc.fonts.ready : null;
        }).then(function () {
          quadro.style.height = Math.ceil(doc.documentElement.scrollHeight) + 'px';
          setTimeout(function () {
            clearTimeout(limite);
            var cartao = doc.querySelector('[data-x="email"]');
            if (!cartao) return falha(new Error('Modelo sem área de e-mail marcada.'));
            ok({ quadro: quadro, doc: doc, cartao: cartao, sair: function () { quadro.remove(); } });
          }, 60);
        });
      };
      quadro.srcdoc = html;
    });
  }

  function baixarBlob(blob, nome) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  async function fotografar(m, escala) {
    await carregar('html2canvas');
    return raiz.html2canvas(m.cartao, { scale: escala || 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: 680 });
  }

  /* ---------- Imagem ---------- */
  async function png(html, nome) {
    var m = await montar(html);
    try {
      var tela = await fotografar(m, 2);
      await new Promise(function (ok) { tela.toBlob(function (b) { baixarBlob(b, nome + '.png'); ok(); }, 'image/png'); });
    } finally { m.sair(); }
  }

  /* ---------- PDF ---------- */
  async function pdf(html, nome) {
    var m = await montar(html);
    try {
      await carregar('jspdf');
      var tela = await fotografar(m, 2);
      var base = m.cartao.getBoundingClientRect();
      var w = base.width, h = base.height;
      var J = raiz.jspdf.jsPDF;
      var doc = new J({ orientation: h > w ? 'portrait' : 'landscape', unit: 'px', format: [w, h], hotfixes: ['px_scaling'], compress: true });
      doc.addImage(tela.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
      // Mantém os botões clicáveis no PDF.
      Array.prototype.forEach.call(m.cartao.querySelectorAll('a[href]'), function (a) {
        var r = a.getBoundingClientRect();
        doc.link(r.left - base.left, r.top - base.top, r.width, r.height, { url: a.href });
      });
      doc.setProperties({ title: nome, creator: 'Gerador de Peças · Unimed Uberlândia' });
      doc.save(nome + '.pdf');
    } finally { m.sair(); }
  }

  /* ---------- PowerPoint editável ---------- */
  function hex(cor) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cor || '');
    if (!m) return null;
    if (m[4] !== undefined && Number(m[4]) === 0) return null;
    return [m[1], m[2], m[3]].map(function (n) { return ('0' + Number(n).toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function transparencia(cor) {
    var m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(cor || '');
    return m ? Math.round((1 - Number(m[1])) * 100) : 0;
  }
  var PX = 1 / 96; // polegadas por pixel

  function trechos(el, win) {
    var lista = [];
    (function andar(no) {
      Array.prototype.forEach.call(no.childNodes, function (f) {
        if (f.nodeType === 3) {
          var t = f.nodeValue.replace(/\s+/g, ' ');
          if (!t.trim() && !lista.length) return;
          var st = win.getComputedStyle(f.parentNode);
          if (st.textTransform === 'uppercase') t = t.toUpperCase();
          // Realce: compensa o respiro lateral do realce (padding) com espaços fixos, para o texto
          // do PowerPoint ficar dentro da forma arredondada.
          var sp = f.parentNode.closest ? f.parentNode.closest('span') : null;
          if (sp && sp !== el && el.contains(sp) && hex(win.getComputedStyle(sp).backgroundColor)) {
            var pad = parseFloat(win.getComputedStyle(sp).paddingLeft) || 0;
            var n = Math.max(1, Math.round(pad / (0.278 * (parseFloat(st.fontSize) || 16))));
            var esp = new Array(n + 1).join('\u00A0');
            var nos = []; (function junta(x) { Array.prototype.forEach.call(x.childNodes, function (k) { if (k.nodeType === 3) nos.push(k); else junta(k); }); })(sp);
            if (nos[0] === f) t = esp + t.replace(/^\s+/, '');
            if (nos[nos.length - 1] === f) t = t.replace(/\s+$/, '') + esp;
          }
          var op = { color: hex(st.color) || '3C3C3B', transparency: transparencia(st.color) || undefined, bold: Number(st.fontWeight) >= 600 || st.fontWeight === 'bold', italic: st.fontStyle === 'italic' };
          lista.push({ text: t, options: op });
        } else if (f.nodeName === 'BR') {
          if (lista.length) lista[lista.length - 1].options.breakLine = true;
        } else if (f.nodeType === 1) andar(f);
      });
    })(el);
    if (lista.length) lista[lista.length - 1].text = lista[lista.length - 1].text.replace(/[ \t\n]+$/, '');
    if (lista.length) lista[0].text = lista[0].text.replace(/^[ \t\n]+/, '');
    return lista;
  }

  /* Realce no PowerPoint: o marca-texto do PowerPoint é reto e alguns leitores nem mostram.
     Por isso cada linha do realce vira uma forma arredondada atrás do texto, com a mesma cor. */
  function realcesDoTexto(el, win, base, s, P) {
    Array.prototype.forEach.call(el.querySelectorAll('span'), function (sp) {
      var st = win.getComputedStyle(sp);
      var cor = hex(st.backgroundColor);
      if (!cor) return;
      Array.prototype.forEach.call(sp.getClientRects(), function (q) {
        if (q.width < 2 || q.height < 2) return;
        s.addShape(P.ShapeType.roundRect, {
          x: (q.left - base.left) * PX, y: (q.top - base.top) * PX, w: q.width * PX, h: q.height * PX,
          fill: { color: cor }, line: { color: cor, width: 0 }, rectRadius: (q.height / 2) * PX
        });
      });
    });
  }
  /* Fundo com imagem (ex.: as linhas leves da grade na faixa do cabeçalho). */
  async function fundoImagem(el, st, s, x, y, w, h) {
    var m = /url\(["']?([^"')]+)["']?\)/.exec(st.backgroundImage || '');
    if (!m) return;
    try { s.addImage({ data: await paraDataUrl(m[1]), x: x, y: y, w: w, h: h }); } catch (e) { /* segue sem */ }
  }

  async function paraDataUrl(src) {
    var r = await fetch(src, { mode: 'cors' });
    if (!r.ok) throw new Error('imagem');
    var b = await r.blob();
    return new Promise(function (ok) { var f = new FileReader(); f.onload = function () { ok(f.result); }; f.readAsDataURL(b); });
  }

  async function pptx(html, nome, info) {
    var m = await montar(html);
    try {
      await carregar('pptx');
      info = info || {};
      var win = m.quadro.contentWindow;
      var base = m.cartao.getBoundingClientRect();
      var W = base.width * PX, H = base.height * PX;
      var P = new raiz.PptxGenJS();
      P.defineLayout({ name: 'EMAIL', width: W, height: H });
      P.layout = 'EMAIL';
      P.author = info.autor || 'Unimed Uberlândia';
      P.company = 'Unimed Uberlândia';
      P.title = nome;
      var s = P.addSlide();
      s.background = { color: 'FFFFFF' };
      var fonte = info.fonte || 'Arial';

      var itens = m.cartao.querySelectorAll('[data-x]');
      var lista = [m.cartao].concat(Array.prototype.slice.call(itens));
      for (var i = 0; i < lista.length; i++) {
        var el = lista[i];
        var tipo = el.getAttribute('data-x');
        var r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        var x = (r.left - base.left) * PX, y = (r.top - base.top) * PX, w = r.width * PX, h = r.height * PX;
        var st = win.getComputedStyle(el);

        if (tipo === 'caixa' || tipo === 'email') {
          var cor = hex(st.backgroundColor);
          if (!cor) continue;
          var raio = parseFloat(st.borderTopLeftRadius) || 0;
          var retoBD = raio > 0 && (parseFloat(st.borderBottomRightRadius) || 0) === 0;
          if (raio > 0) {
            s.addShape(P.ShapeType.roundRect, { x: x, y: y, w: w, h: h, fill: { color: cor }, line: { color: cor, width: 0 }, rectRadius: Math.min(raio, r.height / 2) * PX });
            // Box Unimed: canto inferior direito reto.
            if (retoBD) s.addShape(P.ShapeType.rect, { x: x + w - raio * PX, y: y + h - raio * PX, w: raio * PX, h: raio * PX, fill: { color: cor }, line: { color: cor, width: 0 } });
          } else {
            s.addShape(P.ShapeType.rect, { x: x, y: y, w: w, h: h, fill: { color: cor }, line: { color: cor, width: 0 } });
          }
          await fundoImagem(el, st, s, x, y, w, h);
        } else if (tipo === 'img') {
          try {
            var dado = await paraDataUrl(el.currentSrc || el.src);
            s.addImage({ data: dado, x: x, y: y, w: w, h: h, altText: el.alt || '' });
          } catch (e) { /* imagem indisponível: segue sem ela */ }
        } else if (tipo === 'texto') {
          var partes = trechos(el, win);
          if (!partes.length) continue;
          realcesDoTexto(el, win, base, s, P);
          var pl = parseFloat(st.paddingLeft) || 0, pt = parseFloat(st.paddingTop) || 0, pr = parseFloat(st.paddingRight) || 0, pb = parseFloat(st.paddingBottom) || 0;
          var tam = parseFloat(st.fontSize) || 16;
          var alt = st.lineHeight === 'normal' ? tam * 1.2 : parseFloat(st.lineHeight);
          var link = el.closest('a') || (el.tagName === 'A' ? el : null);
          if (link) partes.forEach(function (p) { p.options.hyperlink = { url: link.href }; });
          var alinhar = /center/.test(st.textAlign) ? 'center' : /right/.test(st.textAlign) ? 'right' : 'left';
          var folga = alinhar === 'left' ? 16 : 0; // folga para a fonte do PowerPoint não quebrar a linha antes
          s.addText(partes, {
            x: x + pl * PX, y: y + pt * PX,
            w: Math.max(0.2, (r.width - pl - pr + folga) * PX), h: Math.max(0.15, (r.height - pt - pb) * PX),
            fontFace: fonte, fontSize: Math.round(tam * 0.75 * 2) / 2,
            lineSpacing: Math.round(alt * 0.75 * 10) / 10,
            charSpacing: (parseFloat(st.letterSpacing) || 0) * 0.75 || undefined,
            align: alinhar,
            valign: el.getAttribute('data-forma') === 'botao' || st.verticalAlign === 'middle' ? 'middle' : 'top',
            margin: 0, fit: 'none', wrap: true, paraSpaceBefore: 0, paraSpaceAfter: 0
          });
        }
      }
      if (info.codigo) s.addNotes('Peça ' + info.codigo + ' gerada no Gerador de Peças da Unimed Uberlândia. Ajustes feitos aqui não alteram o registro oficial.');
      await P.writeFile({ fileName: nome + '.pptx' });
    } finally { m.sair(); }
  }

  raiz.UnimedExportar = { png: png, pdf: pdf, pptx: pptx };
})(window);
