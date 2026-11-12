/* ============================================================
   Recorte de imagens · tamanho fixo com ajuste de enquadramento
   Toda imagem é recortada no navegador para o tamanho exato do
   quadro (mesmo se a foto for vertical). A pessoa arrasta a foto
   dentro do quadro e ajusta o zoom; o resultado é um JPEG nítido
   (2x) que vai para o e-mail.
   ============================================================ */
(function (raiz) {
  'use strict';

  var cacheImg = {};
  var cacheCorte = {};

  function carregar(src) {
    if (cacheImg[src]) return cacheImg[src];
    cacheImg[src] = new Promise(function (ok, falha) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { ok(im); };
      im.onerror = function () { delete cacheImg[src]; falha(new Error('Não consegui abrir a imagem.')); };
      im.src = src;
    });
    return cacheImg[src];
  }

  function limitar(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* Geometria comum ao recorte e ao editor: a foto cobre o quadro (cover) × zoom,
     centrada no ponto (x, y) da foto, sem deixar sobra. */
  function geometria(iw, ih, W, H, aj) {
    var zoom = limitar(aj.zoom || 1, 1, 3);
    var esc = Math.max(W / iw, H / ih) * zoom;
    var dw = iw * esc, dh = ih * esc;
    var x = limitar(aj.x == null ? 0.5 : aj.x, (W / 2) / dw, 1 - (W / 2) / dw);
    var y = limitar(aj.y == null ? 0.5 : aj.y, (H / 2) / dh, 1 - (H / 2) / dh);
    return { dw: dw, dh: dh, ox: W / 2 - x * dw, oy: H / 2 - y * dh, x: x, y: y, zoom: zoom };
  }

  async function cortar(src, w, h, aj, escala) {
    escala = escala || 2;
    aj = aj || {};
    var chave = [src, w, h, (aj.x || 0.5).toFixed(3), (aj.y || 0.5).toFixed(3), (aj.zoom || 1).toFixed(2), escala].join('|');
    if (cacheCorte[chave]) return cacheCorte[chave];
    var im = await carregar(src);
    var W = w * escala, H = h * escala;
    var g = geometria(im.naturalWidth, im.naturalHeight, W, H, aj);
    var tela = document.createElement('canvas');
    tela.width = W; tela.height = H;
    var ctx = tela.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, g.ox, g.oy, g.dw, g.dh);
    var dado = tela.toDataURL('image/jpeg', 0.86);
    cacheCorte[chave] = dado;
    return dado;
  }

  /* Editor de enquadramento: quadro com a proporção final; arrastar move a foto,
     setas do teclado também; controle de zoom e botão para centralizar. */
  function editor(opcoes) {
    var aj = { x: opcoes.ajuste.x == null ? 0.5 : opcoes.ajuste.x, y: opcoes.ajuste.y == null ? 0.5 : opcoes.ajuste.y, zoom: opcoes.ajuste.zoom || 1 };
    var caixa = document.createElement('div');
    caixa.className = 'recorte';
    var quadro = document.createElement('div');
    quadro.className = 'recorte-quadro';
    quadro.style.aspectRatio = opcoes.w + ' / ' + opcoes.h;
    quadro.tabIndex = 0;
    quadro.setAttribute('role', 'group');
    quadro.setAttribute('aria-label', opcoes.rotulo + '. Arraste a foto ou use as setas para mudar o enquadramento.');
    var foto = document.createElement('img');
    foto.alt = '';
    foto.draggable = false;
    foto.src = opcoes.src;
    quadro.appendChild(foto);
    var etiqueta = document.createElement('span');
    etiqueta.className = 'recorte-etiqueta';
    etiqueta.textContent = opcoes.numero + ' · ' + opcoes.w + ' × ' + opcoes.h;
    quadro.appendChild(etiqueta);

    var controles = document.createElement('div');
    controles.className = 'recorte-controles';
    var idZoom = 'zoom-' + opcoes.id + '-' + opcoes.numero;
    var rot = document.createElement('label');
    rot.setAttribute('for', idZoom);
    rot.textContent = 'Zoom';
    var zoom = document.createElement('input');
    zoom.type = 'range'; zoom.min = '1'; zoom.max = '2.5'; zoom.step = '0.05'; zoom.value = String(aj.zoom); zoom.id = idZoom;
    var centro = document.createElement('button');
    centro.type = 'button'; centro.className = 'btn-mini'; centro.textContent = 'Centralizar';
    controles.appendChild(rot); controles.appendChild(zoom); controles.appendChild(centro);
    caixa.appendChild(quadro); caixa.appendChild(controles);

    var geo = null;
    function desenhar() {
      if (!foto.naturalWidth) return;
      var W = quadro.clientWidth, H = quadro.clientHeight;
      geo = geometria(foto.naturalWidth, foto.naturalHeight, W, H, aj);
      aj.x = geo.x; aj.y = geo.y;
      foto.style.width = geo.dw + 'px';
      foto.style.height = geo.dh + 'px';
      foto.style.transform = 'translate(' + geo.ox + 'px,' + geo.oy + 'px)';
    }
    var aviso = null;
    function avisar() { clearTimeout(aviso); aviso = setTimeout(function () { opcoes.aoMudar({ x: aj.x, y: aj.y, zoom: aj.zoom }); }, 140); }
    foto.addEventListener('load', desenhar);
    if (raiz.ResizeObserver) new ResizeObserver(desenhar).observe(quadro);

    var arrasto = null;
    quadro.addEventListener('pointerdown', function (e) {
      if (!geo) return;
      arrasto = { px: e.clientX, py: e.clientY, x: aj.x, y: aj.y };
      quadro.setPointerCapture(e.pointerId);
      quadro.classList.add('arrastando');
    });
    quadro.addEventListener('pointermove', function (e) {
      if (!arrasto || !geo) return;
      aj.x = arrasto.x - (e.clientX - arrasto.px) / geo.dw;
      aj.y = arrasto.y - (e.clientY - arrasto.py) / geo.dh;
      desenhar();
    });
    function soltar() { if (arrasto) { arrasto = null; quadro.classList.remove('arrastando'); avisar(); } }
    quadro.addEventListener('pointerup', soltar);
    quadro.addEventListener('pointercancel', soltar);
    quadro.addEventListener('keydown', function (e) {
      var passo = e.shiftKey ? 0.08 : 0.02;
      var mov = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
      if (!mov) return;
      e.preventDefault();
      aj.x += mov[0]; aj.y += mov[1];
      desenhar(); avisar();
    });
    zoom.addEventListener('input', function () { aj.zoom = Number(zoom.value); desenhar(); avisar(); });
    centro.addEventListener('click', function () { aj.x = 0.5; aj.y = 0.5; aj.zoom = 1; zoom.value = '1'; desenhar(); avisar(); });
    return caixa;
  }

  function paraBlob(dataUrl) {
    var partes = dataUrl.split(',');
    var bin = atob(partes[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: (/data:([^;]+)/.exec(partes[0]) || [])[1] || 'image/jpeg' });
  }

  raiz.UnimedRecorte = { cortar: cortar, editor: editor, paraBlob: paraBlob, geometria: geometria };
})(window);
