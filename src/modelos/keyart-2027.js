/* ============================================================
   Key Art 2027 · "Humano por natureza" (desenho das campanhas)
   Usado pelas peças de tamanho fixo quando o público é campanha
   (interna ou externa) e, por consequência, pelo Kit de campanha.

   Linguagem (Radar → tendencias.json → "keyArt"):
   - tipografia mista: Black + Light em caixa alta, palavra em Slab
     na cor de destaque, ponto laranja no fim (neo-brutalismo & tipo cru);
   - grade de 12 colunas à mostra, marcas de corte, FIG., coordenadas
     e "KV 2027" (prova de processo);
   - texturas reais;
   - elementos: mosaico de formas, pílulas e pontos com retícula e o
     símbolo em 3D, cards com ícones de linha;
   - marca Unimed SEMPRE a original (box verde, letras brancas).

   Estilos: foto (Master), mosaico, pilulas, icones. Cada um se adapta
   à proporção (horizontal, quadrado, vertical) e às margens do formato.
   ============================================================ */
(function (raiz) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function url(base, caminho) {
    if (!caminho) return '';
    if (/^(https?:|data:)/.test(caminho)) return caminho;
    return (base || '').replace(/\/?$/, '/') + caminho.replace(/^\//, '');
  }
  function limpar(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function semMarcas(t) {
    return String(t == null ? '' : t).replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1').replace(/\*\*([\s\S]+?)\*\*/g, '$1');
  }
  function rico(t) {
    return esc(String(t || '').replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1'))
      .replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight:800;">$1</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1<em style="font-style:italic;">$2</em>');
  }
  function luz(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 1;
    var n = parseInt(m[1], 16);
    return 0.299 * (n >> 16) / 255 + 0.587 * (n >> 8 & 255) / 255 + 0.114 * (n & 255) / 255;
  }
  function rgba(hex, a) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  /* Sorteio estável (mesmo título → mesmo mosaico em todas as peças). */
  function semente(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function sorteio(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var ESTILOS_ROTULO = { 'Foto (Master)': 'foto', 'Foto': 'foto', 'Mosaico': 'mosaico', 'Pílulas e pontos': 'pilulas', 'Ícones': 'icones' };

  /* ---------- Ícones de linha (Key Art 2027) ---------- */
  var ICONES = {
    consulta: { d: '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v3a5 5 0 0 0 10 0v-2"/>', a: '<circle cx="20" cy="10.5" r="2"/>', p: 'consulta médico medica doutor especialista atendimento pediatra' },
    telemedicina: { d: '<path d="M5 6H12A3 3 0 0 1 15 9V18H5A3 3 0 0 1 2 15V9A3 3 0 0 1 5 6Z"/><path d="M15 10.5l6-3v9l-6-3"/>', a: '<circle cx="8.5" cy="12" r="2"/>', p: 'telemedicina online vídeo video teleconsulta digital' },
    exame: { d: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>', a: '<path d="M7.5 15h9"/>', p: 'exame exames laboratório laboratorio mamografia prevenção prevencao check-up resultado' },
    receita: { d: '<path d="M8 3H16A3 3 0 0 1 19 6V21H8A3 3 0 0 1 5 18V6A3 3 0 0 1 8 3Z"/><path d="M9 8h6M9 12h6"/>', a: '<path d="M9 16h3"/>', p: 'receita receitas documento guia formulário informação informacao' },
    carteirinha: { d: '<path d="M5 5H19A3 3 0 0 1 22 8V19H5A3 3 0 0 1 2 16V8A3 3 0 0 1 5 5Z"/><path d="M2 10h20"/>', a: '<path d="M6 14.5h5"/>', p: 'carteirinha cartão cartao plano plano de saúde benefício beneficio' },
    reembolso: { d: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 3.5V7h3.5"/>', a: '<path d="M12 8.5v7"/>', p: 'reembolso pagamento boleto financeiro' },
    rede: { d: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/>', a: '<circle cx="12" cy="10" r="2.5"/>', p: 'rede local onde endereço endereco unidade hospital clínica clinica' },
    agenda: { d: '<path d="M6 5H18A3 3 0 0 1 21 8V21H6A3 3 0 0 1 3 18V8A3 3 0 0 1 6 5Z"/><path d="M3 10h18M8 3v4M16 3v4"/>', a: '<path d="M8 14h3v3H8z"/>', p: 'agenda agende agendar data horário horario marque calendário calendario' },
    alerta: { d: '<path d="M12 3L2 20.5h20z"/>', a: '<path d="M12 10v4.5M12 17.5v.5"/>', p: 'alerta atenção atencao aviso cuidado! urgente' },
    familia: { d: '<circle cx="8" cy="7" r="3"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/>', a: '<circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 21v-1a3.8 3.8 0 0 1 6.5-2.6"/>', p: 'família familia filhos pais mãe mae pai crianças criancas pessoas equipe colaboradores time' },
    cuidado: { d: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>', a: '<path d="M12 8.5v5M9.5 11h5"/>', p: 'cuidado cuide saúde saude coração coracao amor bem-estar vida autoexame' }
  };
  var ORDEM_ICONES = ['consulta', 'telemedicina', 'carteirinha', 'cuidado', 'familia', 'agenda', 'exame', 'rede', 'receita', 'reembolso', 'alerta'];
  function iconePara(rotulo, usados) {
    var t = String(rotulo || '').toLowerCase();
    var achado = null;
    ORDEM_ICONES.forEach(function (k) { if (!achado && !usados[k] && ICONES[k].p.split(' ').some(function (w) { return w && t.indexOf(w) >= 0; })) achado = k; });
    if (!achado) achado = ORDEM_ICONES.filter(function (k) { return !usados[k]; })[0] || 'cuidado';
    usados[achado] = true;
    return achado;
  }
  function svgIcone(k, tam, cor, corAcento) {
    var i = ICONES[k] || ICONES.cuidado;
    return '<svg width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="' + cor + '" stroke-width="2" stroke-linecap="square" stroke-linejoin="round" style="display:block;">' + i.d + '<g stroke="' + corAcento + '">' + i.a + '</g></svg>';
  }

  /* ---------- Formas do mosaico (cada uma num quadro 100 × 100) ---------- */
  function forma(tipo, fundo, cor, rot) {
    var r = ' transform="rotate(' + rot + ' 50 50)"';
    var miolo = {
      quarto: '<path d="M0 100V0a100 100 0 0 1 100 100z" fill="' + cor + '"' + r + '/>',
      triangulo: '<path d="M0 0L100 100H0z" fill="' + cor + '"' + r + '/>',
      meia: '<path d="M0 100a50 50 0 0 1 100 0z" fill="' + cor + '"' + r + '/>',
      anel: '<circle cx="50" cy="50" r="31" fill="none" stroke="' + cor + '" stroke-width="18"/>',
      capsula: '<g transform="rotate(' + (rot - 45) + ' 50 50)"><path d="M31 50V35a19 19 0 0 1 38 0v15z" fill="' + cor + '"/><path d="M31 50h38v15a19 19 0 0 1-38 0z" fill="#ffffff" fill-opacity=".85"/></g>',
      arco: '<path d="M0 0A100 100 0 0 1 100 100H58A58 58 0 0 0 0 42z" fill="' + cor + '"' + r + '/>',
      ponto: '<circle cx="50" cy="50" r="24" fill="' + cor + '"/>',
      box: '<path d="M38 14H62A24 24 0 0 1 86 38V86H38A24 24 0 0 1 14 62V38A24 24 0 0 1 38 14Z" fill="' + cor + '"/>'
    }[tipo] || '';
    return '<rect width="100" height="100" fill="' + fundo + '"/>' + miolo;
  }
  var TIPOS = ['quarto', 'triangulo', 'meia', 'anel', 'capsula', 'arco', 'ponto', 'box', 'quarto', 'meia'];
  function mosaicoSvg(w, h, T, cols, rows, P, rnd, pular) {
    var cores = [P.petroleo, P.verdeEscuro, P.institucional, P.citrico, P.amarelo, P.laranja, P.azul, P.agua, P.institucional, P.citrico];
    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="position:absolute;left:0;top:0;display:block;">';
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      if (pular && pular(c, r)) continue;
      var f = cores[Math.floor(rnd() * cores.length)], k;
      do { k = cores[Math.floor(rnd() * cores.length)]; } while (k === f);
      var tipo = TIPOS[Math.floor(rnd() * TIPOS.length)], rot = [0, 90, 180, 270][Math.floor(rnd() * 4)];
      s += '<svg x="' + (c * T).toFixed(1) + '" y="' + (r * T).toFixed(1) + '" width="' + (T + 0.6).toFixed(1) + '" height="' + (T + 0.6).toFixed(1) + '" viewBox="0 0 100 100" preserveAspectRatio="none">' + forma(tipo, f, k, rot) + '</svg>';
    }
    return s + '</svg>';
  }

  /* Símbolo Unimed em 3D (Key Art B): camadas deslocadas no petróleo + face com degradê. */
  var PINHEIRO = 'M854.1,230h38c2.2,0,3.4-.7,4.6-2.2l24.7-33.5c.5-.7,1-1.5,1-2.4s-1.2-1.9-3.3-1.9h-14.2c-2.2,0-3.4-1-3.4-2.4s.5-1.7,1-2.4l22.6-30.4c.5-.7,1-1.5,1-2.4,0-1.4-1.2-2.4-3.4-2.4h-16.8c-2.2,0-3.4-.9-3.4-2.2s.5-1.9,1-2.6l22-29.2c1.2-1.5,2.9-2.1,4.5-2.1s3.3.5,4.5,2.1l22,29.2c.5.7,1,1.7,1,2.6,0,1.4-1.2,2.2-3.4,2.2h-16.8c-2.2,0-3.4,1-3.4,2.4s.5,1.7,1,2.4l22.6,30.4c.5.7,1,1.5,1,2.4,0,1.4-1.2,2.4-3.4,2.4h-14.2c-2.1,0-3.3.7-3.3,1.9s.5,1.7,1,2.4l24.7,33.5c1.2,1.5,2.6,2.2,4.6,2.2h38c2.7,0,4.3-1,4.3-2.7s-.5-2.1-1-2.7l-22.3-30.2c-.5-.7-1-1.5-1-2.4s1.2-1.9,3.3-1.9h26.7c2.7,0,4.1-1,4.1-2.7s-.5-2.1-1-2.7l-54.7-72.4c-1-1.4-2.1-2.1-4.5-2.1h-61.4c-1.5,0-3.3.3-4.5,2.1l-53,72.4c-.7,1-1,1.9-1,2.7,0,1.7,1.4,2.7,4.1,2.7h26.7c2.1,0,3.3.7,3.3,1.9s-.5,1.7-1,2.4l-22.3,30.2c-.5.7-1,1.7-1,2.7,0,1.7,1.5,2.7,4.3,2.7h0Z';
  function pinheiro3d(x, y, w, P, id) {
    var h = Math.round(w * 127 / 188);
    var camadas = '';
    for (var i = 10; i >= 1; i--) camadas += '<path d="' + PINHEIRO + '" fill="' + P.petroleo + '" transform="translate(' + (i * 0.75).toFixed(2) + ' ' + (i * 1).toFixed(2) + ')"/>';
    return '<svg data-x="img" width="' + w + '" height="' + h + '" viewBox="835 106 188 127" style="position:absolute;left:' + x + 'px;top:' + y + 'px;overflow:visible;">' +
      '<defs><linearGradient id="pg' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#54c393"/><stop offset=".45" stop-color="' + P.institucional + '"/><stop offset="1" stop-color="' + P.verdeEscuro + '"/></linearGradient>' +
      '<linearGradient id="ph' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + PINHEIRO + '" fill="' + P.petroleo + '" fill-opacity=".18" transform="translate(14 18)"/>' + camadas +
      '<path d="' + PINHEIRO + '" fill="url(#pg' + id + ')"/><path d="' + PINHEIRO + '" fill="url(#ph' + id + ')"/></svg>';
  }
  /* Retícula (pontos que diminuem a partir do centro). */
  function reticula(x, y, d, cor, opac) {
    var n = 15, passo = d / n, s = '';
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var cx = (i + 0.5) * passo, cy = (j + 0.5) * passo;
      var dist = Math.hypot(cx - d / 2, cy - d / 2) / (d / 2);
      if (dist > 1) continue;
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (passo * 0.42 * (1 - dist * 0.75)).toFixed(1) + '"/>';
    }
    return '<svg width="' + d + '" height="' + d + '" style="position:absolute;left:' + x + 'px;top:' + y + 'px;opacity:' + opac + ';"><g fill="' + cor + '">' + s + '</g></svg>';
  }
  function hachura(x, y, w, h, cor) {
    var s = '', p = Math.max(6, Math.round(Math.min(w, h) / 6));
    for (var i = -h; i < w; i += p) s += '<line x1="' + i + '" y1="' + h + '" x2="' + (i + h) + '" y2="0"/>';
    return '<svg width="' + w + '" height="' + h + '" style="position:absolute;left:' + x + 'px;top:' + y + 'px;"><g stroke="' + cor + '" stroke-width="1.5">' + s + '</g></svg>';
  }

  /* ---------- Estilo e cores ---------- */
  function estiloDe(tendencias, linha, dados) {
    var ka = (tendencias && tendencias.keyArt) || {};
    var lista = (linha && linha.estilos) || Object.keys(ka.estilos || {});
    var pedido = ESTILOS_ROTULO[(dados && dados.estilo) || ''] || '';
    if (pedido && lista.indexOf(pedido) >= 0) return pedido;
    return (linha && linha.estiloPadrao) || lista[0] || 'foto';
  }
  function cores(tendencias, marca, estilo) {
    var ka = (tendencias && tendencias.keyArt) || {};
    var P = Object.assign({ petroleo: '#00433f', verdeEscuro: '#005941', institucional: '#00995d', citrico: '#d3d92b', agua: '#199975', amarelo: '#f9b000', laranja: '#f47920', azul: '#7dcbdb', rosa: '#f4aab8', papel: '#e9dfd0', branco: '#ffffff' }, ka.paleta || {});
    var e = (ka.estilos || {})[estilo] || {};
    var pega = function (k, padrao) { return P[k] || (marca.cores || {})[k] || k || padrao; };
    var fundo = pega(e.fundo, P.petroleo);
    return { P: P, nomeEstilo: e.nome || estilo, fundo: fundo, escuro: luz(fundo) < 0.5, texto: pega(e.texto, '#ffffff'), destaque: pega(e.destaque, P.citrico), legenda: pega(e.legenda, P.citrico), textura: e.textura || 'papel' };
  }

  /* ---------- Geometria por estilo ---------- */
  function geometria(g, cp, temImagem) {
    var W = g.W, H = g.H, m = g.m, mt = g.mt, prop = W / H, tipo = g.tipo;
    var U = tipo === 'largo' ? H : W;
    var s = function (k) { return Math.round(U * k); };
    var est = cp.estilo;
    var compacto = tipo === 'largo' && (H < 560 || prop >= 2.6);
    g.U = U; g.compacto = compacto; g.estilo = est;
    g.lh = tipo === 'largo' ? Math.max(compacto ? s(0.15) : s(0.085), 22) : s(0.065);
    g.cap = Math.max(10, tipo === 'largo' ? s(compacto ? 0.034 : 0.016) : s(0.019));
    g.rodape = !compacto;
    g.rodH = Math.round(g.cap * 1.6);
    var fim = H - g.mbT;                         // fim da área de conteúdo
    g.barra = { y: mt };
    g.foto = null; g.area = null;
    var rB = function () { return g.rodape ? fim - g.rodH - s(0.035) : fim; };

    if (est === 'icones') {
      g.faixa = { h: Math.max(16, s(compacto ? 0.09 : 0.055)) };
      g.faixa.y = g.fb - g.faixa.h;
      fim = Math.min(fim, g.faixa.y - s(0.03));
    }
    if (est === 'mosaico' && tipo !== 'largo') {
      var cols = tipo === 'alto' ? 4 : 5, rows = tipo === 'alto' ? 3 : 2, T = W / cols;
      g.mosaico = { x: 0, y: 0, w: W, h: Math.round(rows * T), T: T, cols: cols, rows: rows };
      g.barra = { y: Math.max(mt, g.mosaico.h + s(0.05)) };
      if (temImagem) g.mosaico.foto = { c: cols - 2, r: 0 };
    }
    var topo = g.barra.y + g.lh + s(tipo === 'largo' ? 0.06 : 0.05);
    var B = rB();
    g.rodY = fim - g.rodH;

    if (tipo === 'largo') {
      if (est === 'foto') {
        if (compacto && temImagem) {
          var fx = Math.round(W * (prop >= 3.2 ? 0.68 : 0.62));
          g.foto = { x: fx, y: 0, w: W - fx, h: H, raio: [Math.round(H * 0.22), 0, 0, 0] };
        } else if (temImagem) {
          var fx2 = Math.round(W * 0.58), fy = topo + g.cap * 2;
          var rr = s(0.035);
          g.foto = { x: fx2, y: fy, w: W - m - fx2, h: B - fy, raio: [rr, rr, 0, rr], fig: true };
        }
        g.texto = { x: m, y: topo, w: (g.foto ? g.foto.x : W - m) - m - s(0.07), h: B - topo, alinhar: 'flex-end' };
      } else if (est === 'mosaico') {
        var rows2 = compacto ? 2 : 4, T2 = H / rows2, cols2 = Math.max(2, Math.ceil(W * (compacto ? 0.36 : 0.44) / T2));
        var x0 = Math.round(W - cols2 * T2);
        g.mosaico = { x: x0, y: 0, w: W - x0, h: H, T: T2, cols: cols2, rows: rows2 };
        if (temImagem) g.mosaico.foto = { c: compacto ? cols2 - 2 : Math.min(1, cols2 - 2), r: compacto ? 0 : 1 };
        g.texto = { x: m, y: topo, w: x0 - m - s(0.06), h: B - topo, alinhar: 'center' };
      } else if (est === 'pilulas') {
        var ax = Math.round(W * (compacto ? 0.58 : 0.5));
        g.area = { x: ax, y: mt, w: W - m - ax, h: H - mt - g.mbT };
        g.texto = { x: m, y: topo, w: ax - m - s(0.05), h: B - topo, alinhar: 'center' };
      } else {
        var ax2 = Math.round(W * (compacto ? 0.56 : 0.52));
        g.area = { x: ax2, y: mt, w: W - m - ax2, h: fim - mt, cols: 3, rows: compacto ? 1 : 2 };
        g.texto = { x: m, y: topo, w: ax2 - m - s(0.05), h: B - topo, alinhar: 'center' };
      }
    } else {
      var util = B - topo;
      if (est === 'foto') {
        if (temImagem) {
          var fy2 = topo + g.cap * 2, rr2 = s(0.035);
          g.foto = { x: m, y: fy2, w: W - 2 * m, h: Math.round((B - fy2) * (tipo === 'alto' ? (prop < 0.6 ? 0.42 : 0.48) : 0.47)), raio: [rr2, rr2, 0, rr2], fig: true };
          var ty = g.foto.y + g.foto.h + s(0.05);
          g.texto = { x: m, y: ty, w: W - 2 * m, h: B - ty, alinhar: 'flex-start' };
        } else g.texto = { x: m, y: topo, w: W - 2 * m, h: util, alinhar: 'flex-end' };
      } else if (est === 'mosaico') {
        g.texto = { x: m, y: topo, w: W - 2 * m, h: util, alinhar: 'flex-start' };
      } else if (est === 'pilulas') {
        var ah = Math.round(util * (tipo === 'alto' ? 0.46 : 0.42));
        g.area = { x: m, y: topo, w: W - 2 * m, h: ah };
        g.texto = { x: m, y: topo + ah + s(0.04), w: W - 2 * m, h: util - ah - s(0.04), alinhar: 'flex-start' };
      } else {
        var cols3 = tipo === 'alto' ? 2 : 3, rows3 = tipo === 'alto' ? 3 : 2;
        var ah2 = Math.round(util * (tipo === 'alto' ? 0.5 : 0.44));
        g.area = { x: m, y: B - ah2, w: W - 2 * m, h: ah2, cols: cols3, rows: rows3 };
        g.texto = { x: m, y: topo, w: W - 2 * m, h: util - ah2 - s(0.04), alinhar: 'flex-start' };
      }
    }
    // Foto no mosaico: um bloco 2 × 2.
    if (g.mosaico && g.mosaico.foto) {
      var M = g.mosaico, pad = Math.round(M.T * 0.08), rb = Math.round(M.T * 0.32);
      g.foto = { x: Math.round(M.x + M.foto.c * M.T) + pad, y: Math.round(M.y + M.foto.r * M.T) + pad, w: Math.round(2 * M.T) - 2 * pad, h: Math.round(2 * M.T) - 2 * pad, raio: [rb, rb, 0, rb] };
    }
    // Pílulas: a foto vira uma cápsula; ícones: a foto ocupa dois cards.
    if (g.area && temImagem && est === 'pilulas') {
      var A = g.area, pw = Math.round(Math.min(A.w * 0.74, A.h * 1.5)), ph = Math.round(pw * 0.56);
      g.foto = { x: Math.round(A.x + A.w * 0.06), y: Math.round(A.y + (A.h - ph) * 0.62), w: pw, h: ph, raio: [ph / 2, ph / 2, ph / 2, ph / 2] };
    }
    if (g.area && est === 'icones') {
      var A2 = g.area, gap = Math.max(8, Math.round(Math.min(A2.w, A2.h) * 0.035));
      A2.gap = gap; A2.cw = (A2.w - gap * (A2.cols - 1)) / A2.cols; A2.ch = (A2.h - gap * (A2.rows - 1)) / A2.rows;
      if (A2.ch > A2.cw * 1.05) { var sobra = (A2.ch - A2.cw * 1.05) * A2.rows; A2.ch = A2.cw * 1.05; A2.y += sobra / 2; A2.h -= sobra; }
      if (temImagem) {
        var rc = Math.round(Math.min(A2.cw, A2.ch) * 0.16);
        g.foto = { x: Math.round(A2.x), y: Math.round(A2.y), w: Math.round(A2.cw * 2 + gap), h: Math.round(A2.ch), raio: [rc, rc, 0, rc] };
        if (A2.cols === 2) g.foto.w = Math.round(A2.w);
      }
    }
    if (g.foto) g.foto.fundo = cp.fundo;
    return g;
  }

  /* ---------- Título em tipografia mista ---------- */
  var LIGA = { de: 1, da: 1, do: 1, das: 1, dos: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, que: 1, por: 1, para: 1, pra: 1, com: 1, sem: 1, a: 1, o: 1, as: 1, os: 1, e: 1, 'é': 1, ao: 1, 'à': 1, um: 1, uma: 1, se: 1, ou: 1, mais: 1, seu: 1, sua: 1, te: 1 };
  function tituloMisto(titulo, cp, slab) {
    var bruto = semMarcas(limpar(titulo));
    var marcadas = /(^|\s)\*[^*]+\*/.test(bruto);
    var partes = [];
    bruto.replace(/\*([^*]+)\*|(\S+)/g, function (t, a, b) {
      if (a) a.split(/\s+/).forEach(function (w) { partes.push({ t: w, slab: true }); });
      else partes.push({ t: b, slab: false });
      return t;
    });
    if (!cp.misto) return partes.map(function (p) { return esc(p.t); }).join(' ');
    if (!marcadas && partes.length > 1) {
      for (var i = partes.length - 1; i >= 0; i--) { if (!LIGA[partes[i].t.toLowerCase().replace(/[^\wà-ú]/gi, '')]) { partes[i].slab = true; break; } }
    }
    return partes.map(function (p) {
      var w = p.t.toLowerCase().replace(/[^\wà-ú]/gi, '');
      if (p.slab) return '<span style="font-family:' + slab + ';font-weight:700;text-transform:none;letter-spacing:-0.045em;color:' + cp.destaque + ';">' + esc(p.t) + '</span>';
      if (LIGA[w]) return '<span style="font-weight:200;letter-spacing:-0.035em;">' + esc(p.t) + '</span>';
      return '<span style="font-weight:900;">' + esc(p.t) + '</span>';
    }).join(' ');
  }

  /* ---------- Desenho ---------- */
  function render(plano, dados, marca, opcoes) {
    var base = opcoes.baseUrl || '';
    var c = marca.cores, cp = plano.campanha, g = plano.geo, P = cp.P;
    var W = g.W, H = g.H, m = g.m, U = g.U;
    var s = function (k) { return Math.round(U * k); };
    var F = marca.tipografia.familia, SLAB = marca.tipografia.familiaSlab || "'Unimed Slab', Georgia, serif";
    var TX = 'data-x="texto"', CX = 'data-x="caixa"', IM = 'data-x="img"';
    var tinta = cp.escuro ? '#ffffff' : P.petroleo;
    var raioBox = function (r) { return r + 'px ' + r + 'px 0 ' + r + 'px'; };
    var h = [];
    var rnd = sorteio(semente(limpar(dados.titulo) + '|' + (dados.cabecalho || '')));

    // Fundo de papel (estilo claro) e grade de 12 colunas à mostra.
    if (cp.textura === 'papel-claro' && cp.usaTextura) h.push('<div ' + CX + ' style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background-image:url(' + url(base, 'assets/textura-papel-claro.jpg') + ');background-size:' + Math.max(W, H) + 'px auto;opacity:.85;"></div>');
    if (cp.prova) {
      var linhas = '';
      for (var i = 1; i < 12; i++) linhas += '<div style="position:absolute;top:0;left:' + Math.round(W * i / 12) + 'px;width:1px;height:' + H + 'px;background:' + (cp.escuro ? 'rgba(255,255,255,.07)' : rgba(P.petroleo, 0.09)) + ';"></div>';
      h.push('<div ' + CX + ' style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;">' + linhas + '</div>');
    }

    // Elementos do estilo.
    if (g.mosaico && cp.elementos) {
      var M = g.mosaico;
      var pular = M.foto ? function (cc, rr) { return cc >= M.foto.c && cc < M.foto.c + 2 && rr >= M.foto.r && rr < M.foto.r + 2; } : null;
      h.push('<div ' + IM + ' style="position:absolute;left:' + M.x + 'px;top:' + M.y + 'px;width:' + M.w + 'px;height:' + M.h + 'px;overflow:hidden;">' + mosaicoSvg(M.w, M.h, M.T, M.cols, M.rows, P, rnd, pular) + '</div>');
      if (M.foto) h.push('<div ' + CX + ' style="position:absolute;left:' + Math.round(M.x + M.foto.c * M.T) + 'px;top:' + Math.round(M.y + M.foto.r * M.T) + 'px;width:' + Math.round(2 * M.T) + 'px;height:' + Math.round(2 * M.T) + 'px;background:' + cp.fundo + ';"></div>');
    }
    if (cp.estilo === 'pilulas' && g.area && cp.elementos) {
      var A = g.area, Q = Math.min(A.w, A.h);
      var px = function (f) { return Math.round(A.x + f * A.w); }, py = function (f) { return Math.round(A.y + f * A.h); };
      var pilula = function (x, y, w, hh, cor, rot, z) {
        return '<div ' + CX + ' style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + hh + 'px;border-radius:' + Math.round(Math.min(w, hh) / 2) + 'px;background:' + cor + ';transform:rotate(' + rot + 'deg);box-shadow:' + Math.round(Q * 0.012) + 'px ' + Math.round(Q * 0.022) + 'px ' + Math.round(Q * 0.03) + 'px ' + rgba(P.petroleo, 0.28) + ';' + (z ? 'z-index:' + z + ';' : '') + '"></div>';
      };
      var ponto = function (x, y, d, cor) { return '<div ' + CX + ' style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:' + cor + ';"></div>'; };
      h.push(reticula(px(0.02), py(0.5), Math.round(Q * 0.5), P.agua, 0.55));
      h.push(reticula(px(0.7), py(-0.02), Math.round(Q * 0.34), P.institucional, 0.35));
      h.push(hachura(px(0.66), py(0.16), Math.round(Q * 0.16), Math.round(Q * 0.1), P.petroleo));
      h.push(pilula(px(0.04), py(0.02), Math.round(Q * 0.12), Math.round(Q * 0.3), P.azul, 0));
      h.push(ponto(px(0.3), py(0.0), Math.round(Q * 0.07), P.laranja));
      h.push(ponto(px(0.74), py(0.06), Math.round(Q * 0.18), P.citrico));
      h.push(pilula(px(0.93) - Math.round(Q * 0.09), py(0.28), Math.round(Q * 0.09), Math.round(Q * 0.26), P.amarelo, 0));
      h.push(ponto(px(0.84), py(0.5), Math.round(Q * 0.09), P.rosa));
      h.push(pilula(px(0.96) - Math.round(Q * 0.16), py(0.7), Math.round(Q * 0.16), Math.round(Q * 0.16), P.agua, 0));
      h.push(ponto(px(0.6), py(0.93), Math.round(Q * 0.045), P.petroleo));
      var pw = Math.round((g.foto ? 0.36 : 0.62) * Math.min(A.w, A.h * 1.5));
      var pxp = g.foto ? px(0.62) : Math.round(A.x + (A.w - pw) / 2), pyp = g.foto ? py(0.06) : Math.round(A.y + (A.h - pw * 127 / 188) / 2);
      h.push('<div style="position:absolute;left:0;top:0;z-index:4;">' + pinheiro3d(pxp, pyp, pw, P, String(W) + H) + '</div>');
      h.push(pilula(px(0.58), py(0.8), Math.round(Q * 0.38), Math.round(Q * 0.12), 'linear-gradient(90deg,' + P.institucional + ' 50%,#ffffff 50%)', -14, 5));
    }
    if (cp.estilo === 'icones' && g.area) {
      var A2 = g.area;
      var itens = String(dados.itens || '').split(/[,;\n]+/).map(limpar).filter(Boolean);
      var padrao = ['Consulta', 'Telemedicina', 'Carteirinha', 'Cuidado', 'Família', 'Agenda'];
      var total = A2.cols * A2.rows - (g.foto ? 2 : 0);
      var CARTOES = [[P.petroleo, '#ffffff', P.citrico], ['#ffffff', P.petroleo, P.laranja], [P.institucional, '#ffffff', P.citrico], [P.citrico, P.petroleo, P.institucional], [P.rosa, P.petroleo, P.institucional], [P.petroleo, '#ffffff', P.amarelo]];
      var usados = {}, k = 0;
      for (var rr2 = 0; rr2 < A2.rows; rr2++) for (var cc2 = 0; cc2 < A2.cols; cc2++) {
        if (g.foto && rr2 === 0 && (cc2 < 2 || A2.cols === 2)) continue;
        if (k >= total) break;
        var rot = itens[k] || padrao.filter(function (x) { return itens.map(function (y) { return y.toLowerCase(); }).indexOf(x.toLowerCase()) < 0; })[k - itens.length] || padrao[k % padrao.length];
        var cor = CARTOES[k % CARTOES.length];
        var x = Math.round(A2.x + cc2 * (A2.cw + A2.gap)), y = Math.round(A2.y + rr2 * (A2.ch + A2.gap));
        var cw = Math.round(A2.cw), ch = Math.round(A2.ch), rc = Math.round(Math.min(cw, ch) * 0.16);
        var ic = Math.round(Math.min(cw, ch) * 0.3), fs = Math.max(10, Math.round(Math.min(cw * 0.085, ch * 0.13)));
        var so = Math.max(3, Math.round(rc * 0.35));
        // Sombra dura (neo-brutalismo) como uma forma atrás: sai igual na imagem, no PDF e no PowerPoint.
        h.push('<div ' + CX + ' style="position:absolute;left:' + (x + so) + 'px;top:' + (y + so) + 'px;width:' + cw + 'px;height:' + ch + 'px;background:' + P.petroleo + ';border-radius:' + raioBox(rc) + ';"></div>');
        h.push('<div ' + CX + ' style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + cw + 'px;height:' + ch + 'px;background:' + cor[0] + ';border-radius:' + raioBox(rc) + ';">' +
          '<div style="position:absolute;left:' + Math.round(cw * 0.12) + 'px;top:' + Math.round(ch * 0.14) + 'px;">' + svgIcone(iconePara(rot, usados), ic, cor[1], cor[2]) + '</div>' +
          '<p ' + TX + ' style="position:absolute;left:' + Math.round(cw * 0.12) + 'px;right:' + Math.round(cw * 0.08) + 'px;bottom:' + Math.round(ch * 0.13) + 'px;margin:0;font-size:' + fs + 'px;font-weight:800;letter-spacing:' + (fs * 0.06).toFixed(1) + 'px;line-height:1.1;text-transform:uppercase;color:' + cor[1] + ';">' + esc(rot) + '</p></div>');
        k++;
      }
    }
    if (g.faixa && cp.elementos) {
      var Tf = g.faixa.h, nf = Math.ceil(W / Tf);
      h.push('<div ' + IM + ' style="position:absolute;left:0;top:' + g.faixa.y + 'px;width:' + W + 'px;height:' + Tf + 'px;overflow:hidden;">' + mosaicoSvg(nf * Tf, Tf, Tf, nf, 1, P, rnd) + '</div>');
    }

    // Foto (cantos gravados no recorte), FIG. e marcas de corte.
    if (plano.imagens && g.foto) {
      var it = plano.imagens.itens[0], f = g.foto;
      var raioCss = f.raio.map(function (r) { return Math.round(r) + 'px'; }).join(' ');
      if (cp.estilo === 'pilulas' || cp.estilo === 'icones') h.push('<div ' + CX + ' style="position:absolute;left:' + (f.x + s(0.012)) + 'px;top:' + (f.y + s(0.016)) + 'px;width:' + f.w + 'px;height:' + f.h + 'px;background:' + P.petroleo + ';border-radius:' + raioCss + ';"></div>');
      h.push('<img ' + IM + ' src="' + esc(it.src || url(base, it.arquivo)) + '" alt="' + esc(it.descricao) + '" style="position:absolute;left:' + f.x + 'px;top:' + f.y + 'px;width:' + f.w + 'px;height:' + f.h + 'px;object-fit:cover;border-radius:' + raioCss + ';">');
      if (f.fig && cp.prova) {
        var rm = Math.max(12, s(0.026)), corReg = cp.escuro ? P.citrico : P.petroleo;
        h.push('<p ' + TX + ' style="position:absolute;left:' + f.x + 'px;top:' + (f.y - Math.round(g.cap * 1.9)) + 'px;margin:0;font-size:' + g.cap + 'px;font-weight:700;letter-spacing:' + (g.cap * 0.22).toFixed(1) + 'px;line-height:1;text-transform:uppercase;color:' + (cp.escuro ? 'rgba(255,255,255,.72)' : rgba(P.petroleo, 0.75)) + ';white-space:nowrap;">FIG.01 / ' + esc(plano.cabecalho) + '</p>');
        h.push('<div ' + CX + ' style="position:absolute;left:' + (f.x - Math.round(rm / 2)) + 'px;top:' + (f.y - Math.round(rm / 2)) + 'px;width:' + rm + 'px;height:' + rm + 'px;border-left:2px solid ' + corReg + ';border-top:2px solid ' + corReg + ';"></div>');
        h.push('<div ' + CX + ' style="position:absolute;left:' + (f.x + f.w - Math.round(rm / 2)) + 'px;top:' + (f.y + f.h - Math.round(rm / 2)) + 'px;width:' + rm + 'px;height:' + rm + 'px;border-right:2px solid ' + corReg + ';border-bottom:2px solid ' + corReg + ';"></div>');
      }
    }

    // Textura real por cima (grão leve).
    if (cp.usaTextura && cp.textura !== 'papel-claro' && marca.recursos2027 && marca.recursos2027.textura) {
      h.push('<div ' + CX + ' style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background-image:url(' + url(base, marca.recursos2027.textura) + ');background-repeat:repeat;opacity:' + (cp.escuro ? '.9' : '.5') + ';"></div>');
    }

    // Barra: logo (Unimed sempre a original, box verde) e legenda técnica.
    var logo = plano.publico.logo;
    var lh = g.lh;
    var lw = Math.max(Math.round(lh * logo.proporcao), marca.logos.minimoPx || 70);
    if (lw > g.texto.w * 0.7) { lw = Math.round(g.texto.w * 0.7); }
    var lhr = Math.round(lw / logo.proporcao);
    h.push('<img ' + IM + ' src="' + esc(url(base, logo.claro)) + '" alt="' + esc(logo.nome) + '" style="position:absolute;left:' + m + 'px;top:' + g.barra.y + 'px;width:' + lw + 'px;height:' + lhr + 'px;">');
    if (cp.prova) {
      var mx = W - m;
      if (g.tipo === 'largo') {
        if (g.mosaico) mx = g.mosaico.x - s(0.04);
        else if (g.area) mx = g.area.x - s(0.04);
        else if (g.foto && !g.foto.fig) mx = g.foto.x - s(0.04);
      }
      var linha2 = ((marca.rodape && marca.rodape.coordenadas) || '') + (opcoes.codigo ? ' · ' + opcoes.codigo : '');
      var largMeta = Math.max(('KV ' + (cp.ciclo || '') + ' · ' + cp.nomeEstilo).length, linha2.length) * g.cap * 0.9;
      if (mx - largMeta > m + lw + s(0.03)) h.push('<p ' + TX + ' style="position:absolute;right:' + (W - mx) + 'px;top:' + (g.barra.y + Math.max(0, Math.round((lhr - g.cap * 3.4) / 2))) + 'px;margin:0;font-size:' + g.cap + 'px;font-weight:700;letter-spacing:' + (g.cap * 0.24).toFixed(1) + 'px;line-height:1.7;text-transform:uppercase;text-align:right;color:' + cp.legenda + ';white-space:nowrap;">KV ' + esc(cp.ciclo || '') + ' · ' + esc(cp.nomeEstilo) + '<br>' + esc(linha2) + '</p>');
    }

    // Bloco de texto.
    var t = g.texto;
    var chapeuPx = Math.max(11, g.tipo === 'largo' ? s(g.compacto ? 0.045 : 0.028) : s(0.026));
    var subPx = Math.max(12, g.tipo === 'largo' ? s(g.compacto ? 0.06 : 0.04) : s(0.036));
    var botaoPx = Math.max(12, g.tipo === 'largo' ? s(g.compacto ? 0.055 : 0.036) : s(0.03));
    var gap = g.tipo === 'largo' ? s(0.03) : s(0.026);
    var corChapeu = cp.escuro ? P.citrico : P.institucional;
    var corApoio = cp.escuro ? 'rgba(255,255,255,.88)' : P.petroleo;
    var filete = cp.estilo === 'pilulas' ? '<div ' + CX + ' style="height:2px;background:' + rgba(P.petroleo, 0.8) + ';margin:' + Math.round(gap * 0.6) + 'px 0;"></div>' : '';
    var itx = [];
    itx.push('<p ' + TX + ' style="margin:0 0 ' + Math.round(gap * 0.7) + 'px;font-size:' + chapeuPx + 'px;font-weight:700;letter-spacing:' + (chapeuPx * 0.2).toFixed(1) + 'px;line-height:1.2;text-transform:uppercase;color:' + corChapeu + ';">' + esc((plano.selo ? plano.selo + ' · ' : '') + plano.cabecalho) + '</p>');
    if (filete) itx.push(filete);
    itx.push('<h1 ' + TX + ' style="margin:0;font-size:' + plano.tituloPx + 'px;font-weight:900;line-height:.9;letter-spacing:' + (-plano.tituloPx * 0.04).toFixed(1) + 'px;' + (cp.caixaAlta ? 'text-transform:uppercase;' : '') + 'color:' + cp.texto + ';">' + tituloMisto(dados.titulo, cp, SLAB) + (cp.ponto ? '<span style="display:inline-block;width:.17em;height:.17em;margin-left:.04em;background:' + P.laranja + ';"></span>' : '') + '</h1>');
    if (filete) itx.push(filete);
    if (limpar(dados.subtitulo)) itx.push('<p ' + TX + ' style="margin:' + gap + 'px 0 0;font-size:' + subPx + 'px;font-weight:400;line-height:1.3;color:' + corApoio + ';">' + rico(limpar(dados.subtitulo)) + '</p>');
    var sombra = Math.max(3, Math.round(botaoPx * 0.22));
    var borda = Math.max(2, Math.round(botaoPx * 0.09));
    // Botões: no fundo claro ganham borda e sombra dura (neo-brutalismo), desenhadas como formas.
    var pilulaBotao = function (fundo, raio, miolo, margemDir) {
      return '<div style="float:left;position:relative;margin:0 ' + margemDir + 'px ' + sombra + 'px 0;">' +
        (cp.escuro ? '' : '<div ' + CX + ' style="position:absolute;left:' + sombra + 'px;top:' + sombra + 'px;width:100%;height:100%;background:' + P.petroleo + ';border-radius:' + raioBox(raio) + ';"></div>') +
        '<div ' + CX + ' style="position:relative;background:' + fundo + ';border-radius:' + raioBox(raio) + ';' + (cp.escuro ? '' : 'border:' + borda + 'px solid ' + P.petroleo + ';') + '">' + miolo + '</div></div>';
    };
    var rod = [];
    if (plano.data) {
      var dp = botaoPx;
      var dFundo = cp.estilo === 'icones' ? P.petroleo : P.citrico, dTexto = cp.estilo === 'icones' ? '#ffffff' : P.petroleo;
      rod.push(pilulaBotao(dFundo, Math.round(dp * 0.6), '<p ' + TX + ' style="margin:0;padding:' + Math.round(dp * 0.55) + 'px ' + Math.round(dp * 0.9) + 'px;font-size:' + dp + 'px;font-weight:800;line-height:1.1;color:' + dTexto + ';white-space:nowrap;">' + plano.data.dia + ' ' + esc(plano.data.mes) + (plano.data.hora ? ' · ' + esc(plano.data.hora.replace(':00', 'h').replace(':', 'h')) : '') + '</p>', Math.round(gap * 0.7) + sombra));
    }
    if (plano.chamada) {
      rod.push(pilulaBotao(P.laranja, Math.round(botaoPx * 1.3), '<p ' + TX + ' data-forma="botao" style="margin:0;padding:' + Math.round(botaoPx * 0.6) + 'px ' + Math.round(botaoPx * 1.2) + 'px;font-size:' + botaoPx + 'px;font-weight:800;line-height:1.1;color:#ffffff;white-space:nowrap;">' + esc(plano.chamada) + ' &rarr;</p>', 0));
    }
    if (rod.length) itx.push('<div style="margin-top:' + Math.round(gap * 1.2) + 'px;overflow:hidden;padding-right:' + sombra + 'px;">' + rod.join('') + '</div>');
    // Alinhamento por espaçadores (o excesso sempre vai para baixo, e o encaixe automático percebe).
    var mola = '<div style="flex:1 1 0px;min-height:0;"></div>';
    var miolo = (t.alinhar === 'flex-end' ? mola : t.alinhar === 'center' ? mola : '') + itx.join('') + (t.alinhar === 'center' ? mola : '');
    h.push('<div data-ajuste style="position:absolute;left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + Math.max(40, t.h) + 'px;display:flex;flex-direction:column;z-index:6;">' + miolo + '</div>');

    // Rodapé técnico: assinatura · campanha · site (+ ANS na externa).
    var ans = plano.publico.ans && marca.ans;
    var ah = Math.max(14, g.tipo === 'largo' ? s(g.compacto ? 0.06 : 0.032) : s(0.03)), aw = ans ? Math.round(ah * marca.ans.proporcao) : 0;
    if (g.rodape) {
      var itensRod = [plano.publico.logo.nome, (cp.nome || 'Campanha') + ' ' + (cp.ciclo || ''), (marca.rodape && marca.rodape.site) || ''];
      var dir = (g.mosaico && g.tipo === 'largo' ? g.mosaico.x - s(0.04) : W - m) - (ans ? aw + s(0.03) : 0);
      var larg = function (l) { return l.reduce(function (a, x) { return a + x.length * g.cap * 0.86; }, 0) + (l.length - 1) * g.cap * 3; };
      if (larg(itensRod) > dir - m) itensRod = [itensRod[0], itensRod[2]];
      if (larg(itensRod) > dir - m) itensRod = [itensRod[1]];
      h.push('<div style="position:absolute;left:' + m + 'px;top:' + g.rodY + 'px;width:' + (dir - m) + 'px;height:' + g.rodH + 'px;display:flex;justify-content:space-between;align-items:center;z-index:6;">' +
        itensRod.map(function (x) { return '<span ' + TX + ' style="font-size:' + g.cap + 'px;font-weight:700;letter-spacing:' + (g.cap * 0.22).toFixed(1) + 'px;line-height:1;text-transform:uppercase;white-space:nowrap;color:' + (cp.escuro ? 'rgba(255,255,255,.72)' : rgba(P.petroleo, 0.75)) + ';">' + esc(x) + '</span>'; }).join('') + '</div>');
      if (ans) h.push('<img ' + IM + ' src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="position:absolute;left:' + (dir + s(0.03)) + 'px;top:' + (g.rodY + Math.round((g.rodH - ah) / 2)) + 'px;width:' + aw + 'px;height:' + ah + 'px;z-index:6;">');
    } else if (ans) {
      h.push('<img ' + IM + ' src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="position:absolute;left:' + (t.x + t.w - aw) + 'px;top:' + (H - g.mbT - ah) + 'px;width:' + aw + 'px;height:' + ah + 'px;z-index:6;">');
    }
    return h;
  }

  raiz.UnimedKeyArt = { estiloDe: estiloDe, cores: cores, geometria: geometria, render: render, tituloMisto: tituloMisto, ICONES: ICONES, ESTILOS_ROTULO: ESTILOS_ROTULO, mosaicoSvg: mosaicoSvg, sorteio: sorteio, semente: semente };
})(window);
