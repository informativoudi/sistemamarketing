/* ============================================================
   Modelo · Peças de tamanho fixo (imagem)
   Peça quadrada, banner do portal, notificações (portal e app),
   topo de e-mail e Painel SMU. Um só desenho que se adapta à
   proporção: horizontal (texto à esquerda, foto sangrando à direita),
   quadrado e vertical (foto em cima, texto embaixo).
   Tudo dentro da margem de segurança do formato.
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
  function puro(t) {
    return String(t == null ? '' : t)
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1$2');
  }
  function rico(t) {
    return esc(puro(t).length ? t : '')
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight:800;">$1</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1<em style="font-style:italic;">$2</em>');
  }
  var MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  /* ---------- Geometria a partir do tamanho e da margem ---------- */
  function geometria(f, temImagem, campanha) {
    var W = f.largura, H = f.altura, m = f.margem;
    // Margens por lado (ex.: Banner App do Praia Clube com 110 px embaixo; Story com áreas do Instagram).
    var mg = f.margens || {};
    var mt = mg.topo != null ? mg.topo : m, mb = mg.base != null ? mg.base : m;
    var prop = W / H;
    var tipo = prop >= 1.6 ? 'largo' : prop <= 0.75 ? 'alto' : 'quadrado';
    // Margem reservada (maior que a normal): nada entra nela. Selo ANS e linha técnica ficam logo acima.
    var reservada = mb > m;
    var fb = reservada ? H - mb : H;                       // fim da área usável
    var mbT = reservada ? mb + Math.round(m * 0.6) : mb;   // margem inferior do texto
    var g = { W: W, H: H, m: m, mt: mt, mb: mb, mbT: mbT, fb: fb, tipo: tipo, campanha: !!campanha };
    mb = mbT;
    if (campanha) {
      /* Campanha (Tendências 2027): foto sangrando (à direita no horizontal, em cima nos outros),
         fundo escuro, logo branco e faixa de formas embaixo. */
      if (tipo === 'largo') {
        g.U = H;
        g.foto = temImagem ? { x: Math.round(W * (prop >= 3 ? 0.62 : 0.55)), y: 0 } : null;
        if (g.foto) { g.foto.w = W - g.foto.x; g.foto.h = H; }
        g.texto = { x: m, y: mt, w: (g.foto ? g.foto.x : W) - m - Math.round(m * 0.9), h: H - mt - mb };
      } else {
        g.U = W;
        g.rodapeH = Math.round(W * 0.065);
        g.foto = temImagem ? { x: 0, y: 0, w: W, h: Math.round(H * (tipo === 'alto' ? 0.46 : 0.44)) } : null;
        var y0 = g.foto ? Math.max(g.foto.h + Math.round(m * 0.55), mt) : mt + Math.round(W * 0.04);
        g.texto = { x: m, y: y0, w: W - 2 * m, h: H - mb - g.rodapeH - Math.round(m * 0.45) - y0 };
      }
      return g;
    }
    if (tipo === 'largo') {
      g.U = H;
      g.foto = temImagem ? { x: Math.round(W * (prop >= 3 ? 0.64 : 0.58)), y: 0 } : null;
      if (g.foto) { g.foto.w = W - g.foto.x; g.foto.h = H; }
      g.texto = { x: m, y: mt, w: (g.foto ? g.foto.x : W) - m - Math.round(m * (g.foto ? 0.8 : 1)), h: H - mt - mb };
    } else {
      g.U = W;
      var logoH = Math.round(W * 0.06);
      var topoFoto = mt + logoH + Math.round(m * 0.5);
      // Vertical: a foto ocupa parte da área usável (entre as margens), não da peça inteira.
      var usavel = H - mt - mb - logoH - Math.round(m * 0.5);
      var hFoto = tipo === 'alto' ? Math.round(usavel * (prop < 0.6 ? 0.46 : 0.5)) : Math.round(H * 0.33);
      g.foto = temImagem ? { x: m, y: topoFoto, w: W - 2 * m, h: hFoto } : null;
      var yTexto = g.foto ? topoFoto + hFoto + Math.round(m * 0.45) : topoFoto;
      g.texto = { x: m, y: yTexto, w: W - 2 * m, h: H - yTexto - mb };
    }
    return g;
  }

  /* Tamanho do quadro da imagem (usado pelo editor de enquadramento). */
  function ehCampanha(formato, dados) {
    var pub = (formato.publicos || {})[dados && dados.publico] || {};
    return pub.layout === 'campanha';
  }
  function slots(formato, qtd, dados) {
    if (!qtd) return [];
    var g = geometria(formato, true, ehCampanha(formato, dados));
    return [{ w: g.foto.w, h: g.foto.h }];
  }

  /* ---------- Decisão: regras simples, tudo vindo do arquivo do formato ---------- */
  function decidir(formato, marca, tendencias, dados) {
    var porque = [];
    var pub = (formato.publicos || {})[dados.publico] || {};
    var porTema = (pub.porTema || {})[dados.tema];
    if (porTema) { pub = Object.assign({}, pub, porTema); porque.push('Público externo + tema ' + dados.tema + ' → ' + (porTema.motivo || 'regra do tema') + '.'); }
    var logo = marca.logos[pub.logo || 'interno'];
    porque.push('Público ' + (dados.publico || 'Interno').toLowerCase() + ' → ' + logo.nome + (pub.ans ? ' + registro ANS.' : '.'));
    var tema = Object.assign({ rotulo: dados.tema }, (formato.temas || {})[dados.tema] || {});
    var ap = (dados.imagens || [])[0];
    var aprovada = ap && (marca.imagensAprovadas || []).filter(function (a) { return a.id === ap.id; })[0];
    // Campanha: o visual vem das tendências ativas do ciclo (Radar). A principal é a do ciclo atual.
    var campanha = null;
    if (pub.layout === 'campanha') {
      var t = tendencias || {};
      var ativas = {};
      (t.tendencias || []).forEach(function (x) { if (x.status === 'ativa') ativas[x.id] = true; });
      var cc = t.campanha || {};
      campanha = {
        ciclo: t.ciclo, conceito: t.conceito,
        fundo: marca.cores[cc.fundo] || cc.fundo || marca.cores.verdeEscuro,
        destaque: marca.cores[cc.destaque] || cc.destaque || marca.cores.citrico,
        contraste: !!ativas['titulo-contraste'], ponto: !!ativas['quadrado-laranja'], box: !!ativas['moldura-box'],
        textura: !!ativas['textura-papel'], prova: !!ativas['prova-de-processo'],
        mote: cc.mote || ''
      };
      logo = Object.assign({}, logo, { claro: logo.escuro || logo.claro });
      porque.push('Campanha → visual do ciclo ' + (t.ciclo || '') + (t.conceito ? ' ("' + t.conceito + '")' : '') + ' com as tendências ativas do Radar: ' +
        ['titulo-contraste', 'quadrado-laranja', 'moldura-box', 'textura-papel', 'prova-de-processo'].filter(function (k) { return ativas[k]; }).map(function (k) { return ((t.tendencias || []).filter(function (x) { return x.id === k; })[0] || {}).nome || k; }).join(', ') + '.');
    }
    var g = geometria(formato, !!aprovada, !!campanha);
    var imagens = aprovada ? { quantidade: 1, itens: [Object.assign({ arquivo: aprovada.arquivo, descricao: aprovada.descricao, w: g.foto.w, h: g.foto.h }, ap)] } : null;
    porque.push(formato.largura + ' × ' + formato.altura + ' px, margem de ' + formato.margem + ' px → desenho ' + { largo: 'horizontal', quadrado: 'quadrado', alto: 'vertical' }[g.tipo] + '.');
    porque.push(imagens ? 'Com imagem → foto no quadro de ' + g.foto.w + ' × ' + g.foto.h + ' px.' : 'Sem imagem → fundo de apoio com a grade leve.');
    var titulo = puro(limpar(dados.titulo));
    var n = titulo.length;
    var base = g.tipo === 'largo' ? 0.105 : g.tipo === 'alto' ? (formato.largura / formato.altura < 0.6 ? 0.1 : 0.085) : 0.068;
    if (campanha) base = campanha.contraste ? (g.tipo === 'largo' ? 0.115 : g.tipo === 'alto' ? 0.095 : 0.082) : base * 1.08;
    var red = n > 65 ? 0.72 : n > 45 ? 0.85 : 1;
    var dataInfo = null;
    if (dados.data) {
      var d = String(dados.data).split('-');
      if (d.length === 3) dataInfo = { dia: Number(d[2]), mes: MESES[Number(d[1]) - 1] || '', hora: limpar(dados.hora) };
    }
    if (dataInfo) porque.push('Com data → selo cítrico com dia e mês.');
    if (limpar(dados.chamada)) porque.push('Com chamada → botão laranja (sem link: é uma imagem).');
    return {
      variante: 'fixa', varianteNome: g.tipo === 'largo' ? 'HORIZONTAL' : g.tipo === 'alto' ? 'VERTICAL' : 'QUADRADO',
      caracteres: puro(limpar(dados.subtitulo)).length + n,
      publico: { nome: dados.publico || 'Interno', logo: logo, ans: !!pub.ans, assinatura: pub.assinatura },
      selo: pub.selo, tema: tema, imagens: imagens, geo: g, campanha: campanha,
      tituloPx: Math.round(g.U * base * red),
      cabecalho: limpar(dados.cabecalho) || limpar(dados.area) || logo.nome,
      data: dataInfo, chamada: limpar(dados.chamada),
      botao: !!limpar(dados.chamada),
      porque: porque,
      chips: [campanha ? 'Campanha ' + (campanha.ciclo || '') : g.tipo === 'largo' ? 'Horizontal' : g.tipo === 'alto' ? 'Vertical' : 'Quadrado', formato.largura + ' × ' + formato.altura, dados.publico || 'Interno', 'Tema ' + (dados.tema || '')]
    };
  }

  function fontes(marca, base) {
    var a = (marca.tipografia && marca.tipografia.arquivos) || [];
    if (!a.length) return '';
    return '<style>' + a.map(function (x) {
      return '@font-face{font-family:"' + x.familia + '";src:url(' + url(base, x.arquivo) + ') format("woff2");font-weight:' + x.peso + ';font-style:' + (x.estilo || 'normal') + ';}';
    }).join('') + '</style>';
  }

  /* ---------- Desenho ---------- */
  function render(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var base = opcoes.baseUrl || '';
    var c = marca.cores, F = marca.tipografia.familia;
    var g = plano.geo, U = g.U, m = g.m, W = g.W, H = g.H;
    var r27 = marca.recursos2027 || {};
    var fundo = plano.tema.fundoInterno ? (c[plano.tema.fundoInterno] || plano.tema.fundoInterno) : c.apoioAreia;
    var TX = 'data-x="texto"', CX = 'data-x="caixa"', IM = 'data-x="img"';
    var raioBox = function (r) { return r + 'px ' + r + 'px 0 ' + r + 'px'; };
    var html = [];
    if (plano.campanha) return embrulhar(renderCampanha(plano, dados, marca, opcoes), plano.campanha.fundo);

    // Fundo: cor de apoio do tema + grade de 12 colunas quase invisível.
    var grade = r27.grade ? 'background-image:url(' + url(base, r27.grade) + ');background-size:100% auto;background-repeat:repeat-y;' : '';
    var areaFundo = g.tipo === 'largo' ? { x: 0, y: 0, w: g.foto ? g.foto.x : W, h: H } : { x: 0, y: 0, w: W, h: H };
    html.push('<div ' + CX + ' style="position:absolute;left:' + areaFundo.x + 'px;top:' + areaFundo.y + 'px;width:' + areaFundo.w + 'px;height:' + areaFundo.h + 'px;background-color:' + fundo + ';' + grade + '"></div>');

    // Logo (+ faixa do mosaico) no topo da área de texto.
    var logo = plano.publico.logo;
    var logoH = g.tipo === 'largo' ? Math.max(Math.round(U * 0.11), 26) : Math.round(U * 0.06);
    var logoW = Math.round(logoH * logo.proporcao);
    var maxLogo = g.tipo === 'largo' ? g.texto.w * 0.8 : g.texto.w * 0.62;
    if (logoW > maxLogo) { logoW = Math.round(maxLogo); logoH = Math.round(logoW / logo.proporcao); }
    logoW = Math.max(logoW, marca.logos.minimoPx || 70);
    html.push('<img ' + IM + ' src="' + esc(url(base, logo.claro)) + '" alt="' + esc(logo.nome) + '" style="position:absolute;left:' + m + 'px;top:' + g.mt + 'px;width:' + logoW + 'px;height:' + Math.round(logoW / logo.proporcao) + 'px;">');
    if (r27.mosaico && g.tipo !== 'largo') {
      var mh = Math.round(logoH * 0.9), mw = Math.round(mh * (r27.mosaicoLargura / r27.mosaicoAltura));
      html.push('<img ' + IM + ' src="' + esc(url(base, r27.mosaico)) + '" alt="" style="position:absolute;left:' + (W - m - mw) + 'px;top:' + (g.mt + Math.round((Math.round(logoW / logo.proporcao) - mh) / 2)) + 'px;width:' + mw + 'px;height:' + mh + 'px;">');
    }

    // Foto: no horizontal sangra à direita com o canto do box; nos outros, quadro box dentro da margem.
    if (plano.imagens && g.foto) {
      var it = plano.imagens.itens[0];
      var src = it.src || url(base, it.arquivo);
      var raio = g.tipo === 'largo' ? Math.round(H * 0.16) + 'px 0 0 0' : raioBox(Math.round(U * 0.03));
      html.push('<img ' + IM + ' src="' + esc(src) + '" alt="' + esc(it.descricao) + '" style="position:absolute;left:' + g.foto.x + 'px;top:' + g.foto.y + 'px;width:' + g.foto.w + 'px;height:' + g.foto.h + 'px;object-fit:cover;border-radius:' + raio + ';">');
    }

    // Bloco de texto.
    var t = g.texto;
    var topoTexto = g.tipo === 'largo' ? t.y + Math.round(logoW / logo.proporcao) + Math.round(U * 0.06) : t.y;
    var altTexto = t.y + t.h - topoTexto;
    var s = function (k) { return Math.round(U * k); };
    var chapeuPx = g.tipo === 'largo' ? s(0.034) : s(0.022);
    var subPx = g.tipo === 'largo' ? s(0.05) : s(0.034);
    var botaoPx = g.tipo === 'largo' ? s(0.042) : s(0.026);
    var gap = g.tipo === 'largo' ? s(0.035) : s(0.022);
    var itens = [];
    itens.push('<div ' + CX + ' style="width:' + s(g.tipo === 'largo' ? 0.08 : 0.05) + 'px;height:' + Math.max(3, s(g.tipo === 'largo' ? 0.012 : 0.007)) + 'px;background:' + c.citrico + ';margin-bottom:' + Math.round(gap * 0.8) + 'px;"></div>');
    itens.push('<p ' + TX + ' style="margin:0 0 ' + Math.round(gap * 0.6) + 'px;font-size:' + chapeuPx + 'px;font-weight:700;letter-spacing:' + (chapeuPx * 0.14).toFixed(1) + 'px;line-height:1.2;text-transform:uppercase;color:' + c.institucional + ';">' + esc((plano.selo ? plano.selo + ' · ' : '') + plano.cabecalho) + '</p>');
    itens.push('<h1 ' + TX + ' style="margin:0;font-size:' + plano.tituloPx + 'px;font-weight:800;line-height:1.05;letter-spacing:' + (-plano.tituloPx * 0.015).toFixed(1) + 'px;color:' + c.verdeEscuro + ';">' + esc(puro(limpar(dados.titulo))) + '<span style="color:' + c.laranja + ';">&#9632;</span></h1>');
    if (limpar(dados.subtitulo)) itens.push('<p ' + TX + ' style="margin:' + gap + 'px 0 0;font-size:' + subPx + 'px;font-weight:400;line-height:1.3;color:' + c.texto + ';">' + rico(limpar(dados.subtitulo)) + '</p>');
    var rodape = [];
    if (plano.data) {
      var dp = Math.round(botaoPx * 1.05);
      rodape.push('<div ' + CX + ' style="float:left;background:' + c.citrico + ';border-radius:' + raioBox(Math.round(dp * 0.6)) + ';margin-right:' + Math.round(gap * 0.6) + 'px;">' +
        '<p ' + TX + ' style="margin:0;padding:' + Math.round(dp * 0.55) + 'px ' + Math.round(dp * 0.9) + 'px;font-size:' + dp + 'px;font-weight:800;line-height:1.1;color:' + c.verdeEscuro + ';white-space:nowrap;">' + plano.data.dia + ' ' + esc(plano.data.mes) + (plano.data.hora ? ' · ' + esc(plano.data.hora.replace(':00', 'h').replace(':', 'h')) : '') + '</p></div>');
    }
    if (plano.chamada) {
      rodape.push('<div ' + CX + ' style="float:left;background:' + c.laranja + ';border-radius:' + raioBox(Math.round(botaoPx * 1.3)) + ';">' +
        '<p ' + TX + ' data-forma="botao" style="margin:0;padding:' + Math.round(botaoPx * 0.62) + 'px ' + Math.round(botaoPx * 1.2) + 'px;font-size:' + botaoPx + 'px;font-weight:700;line-height:1.1;color:#ffffff;white-space:nowrap;">' + esc(plano.chamada) + ' &rarr;</p></div>');
    }
    if (rodape.length) itens.push('<div style="margin-top:' + Math.round(gap * 1.3) + 'px;overflow:hidden;">' + rodape.join('') + '</div>');

    html.push('<div data-ajuste style="position:absolute;left:' + t.x + 'px;top:' + topoTexto + 'px;width:' + t.w + 'px;height:' + altTexto + 'px;display:flex;flex-direction:column;justify-content:' + (g.tipo === 'largo' ? 'center' : 'flex-start') + ';">' + itens.join('') + '</div>');

    // ANS nas peças externas (canto inferior direito, dentro da margem).
    if (plano.publico.ans && marca.ans) {
      var ah = Math.max(14, s(g.tipo === 'largo' ? 0.045 : 0.026)), aw = Math.round(ah * marca.ans.proporcao);
      var ax = g.tipo === 'largo' && g.foto ? g.foto.x - Math.round(m * 0.8) - aw : W - m - aw;
      html.push('<img ' + IM + ' src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="position:absolute;left:' + ax + 'px;top:' + (g.fb - ah - Math.round(m * 0.5)) + 'px;width:' + aw + 'px;height:' + ah + 'px;">');
    }

    return embrulhar(html, fundo);

    function embrulhar(partes, fundoPeca) {
      return '<!doctype html>\n<!-- Peça ' + esc(opcoes.codigo || '') + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(puro(dados.titulo)) + '</title>' + fontes(marca, base) +
      '<style>html,body{margin:0;padding:0;background:#ffffff;}*{box-sizing:border-box;}[data-ajuste]>*{flex-shrink:0;}</style></head><body>' +
      '<div data-x="peca" style="position:relative;overflow:hidden;width:' + W + 'px;height:' + H + 'px;background:' + fundoPeca + ';font-family:' + F + ';">' + partes.join('') + '</div>' +
      /* Encaixe: se o texto passar da área segura, o título (e depois o apoio) diminuem um pouco por vez. */
      '<script>(function(){var t=document.querySelector("[data-ajuste]");if(!t)return;var h=t.querySelector("h1"),p=t.querySelectorAll("p");' +
      'function cabe(){return t.scrollHeight<=t.clientHeight+1;}' +
      'function ajusta(){var n=0;while(!cabe()&&n<16){h.style.fontSize=(parseFloat(h.style.fontSize)*0.94)+"px";if(n>6)for(var i=0;i<p.length;i++){p[i].style.fontSize=(parseFloat(getComputedStyle(p[i]).fontSize)*0.95)+"px";}n++;}}' +
      'ajusta();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ajusta);})();<\/script>' +
      '</body></html>';
    }
  }

  /* ---------- Campanha (interna ou externa): Tendências do ciclo ---------- */
  function renderCampanha(plano, dados, marca, opcoes) {
    var base = opcoes.baseUrl || '';
    var c = marca.cores, cp = plano.campanha;
    var g = plano.geo, U = g.U, m = g.m, W = g.W, H = g.H;
    var r27 = marca.recursos2027 || {};
    var TX = 'data-x="texto"', CX = 'data-x="caixa"', IM = 'data-x="img"';
    var s = function (k) { return Math.round(U * k); };
    var raioBox = function (r) { return r + 'px ' + r + 'px 0 ' + r + 'px'; };
    var h = [];

    // Foto sangrando, com o canto do box gravado no recorte.
    if (plano.imagens && g.foto) {
      var it = plano.imagens.itens[0];
      var f = formaImagem(plano);
      var raioCss = f ? f.raio.map(function (r) { return r + 'px'; }).join(' ') : '0';
      h.push('<img ' + IM + ' src="' + esc(it.src || url(base, it.arquivo)) + '" alt="' + esc(it.descricao) + '" style="position:absolute;left:' + g.foto.x + 'px;top:' + g.foto.y + 'px;width:' + g.foto.w + 'px;height:' + g.foto.h + 'px;object-fit:cover;border-radius:' + raioCss + ';">');
    }
    // Textura real (tendência): grão de papel por cima de tudo, bem leve.
    if (cp.textura && r27.textura) {
      h.push('<div ' + CX + ' style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background-image:url(' + url(base, r27.textura) + ');background-repeat:repeat;opacity:.9;"></div>');
    }

    // Logo branco e faixa de formas.
    var logo = plano.publico.logo;
    var logoH = g.tipo === 'largo' ? Math.max(Math.round(U * 0.1), 26) : Math.round(g.rodapeH * 0.82);
    var logoW = Math.max(Math.round(logoH * logo.proporcao), marca.logos.minimoPx || 70);
    var maxLogo = (g.tipo === 'largo' ? g.texto.w : W - 2 * m) * 0.6;
    if (logoW > maxLogo) { logoW = Math.round(maxLogo); }
    var lh = Math.round(logoW / logo.proporcao);
    var mh = g.tipo === 'largo' ? Math.round(U * 0.075) : Math.round(g.rodapeH * 0.8), mw = r27.mosaico ? Math.round(mh * (r27.mosaicoLargura / r27.mosaicoAltura)) : 0;
    if (g.tipo === 'largo') {
      h.push('<img ' + IM + ' src="' + esc(url(base, logo.claro)) + '" alt="' + esc(logo.nome) + '" style="position:absolute;left:' + m + 'px;top:' + g.mt + 'px;width:' + logoW + 'px;height:' + lh + 'px;">');
      if (r27.mosaico) h.push('<img ' + IM + ' src="' + esc(url(base, r27.mosaico)) + '" alt="" style="position:absolute;left:' + (g.texto.x + g.texto.w - mw) + 'px;top:' + (g.mt + Math.round((lh - mh) / 2)) + 'px;width:' + mw + 'px;height:' + mh + 'px;">');
    } else {
      var yb = H - g.mbT - g.rodapeH;
      h.push('<img ' + IM + ' src="' + esc(url(base, logo.claro)) + '" alt="' + esc(logo.nome) + '" style="position:absolute;left:' + m + 'px;top:' + (yb + Math.round((g.rodapeH - lh) / 2)) + 'px;width:' + logoW + 'px;height:' + lh + 'px;">');
      if (r27.mosaico) h.push('<img ' + IM + ' src="' + esc(url(base, r27.mosaico)) + '" alt="" style="position:absolute;left:' + (W - m - mw) + 'px;top:' + (yb + Math.round((g.rodapeH - mh) / 2)) + 'px;width:' + mw + 'px;height:' + mh + 'px;">');
    }

    // Texto: título em contraste (Black, caixa alta) quando a tendência está ativa.
    var t = g.texto;
    var topo = g.tipo === 'largo' ? t.y + lh + s(0.05) : t.y;
    var alt = t.y + t.h - topo;
    var chapeuPx = g.tipo === 'largo' ? s(0.034) : s(0.022);
    var subPx = g.tipo === 'largo' ? s(0.05) : s(0.032);
    var botaoPx = g.tipo === 'largo' ? s(0.042) : s(0.026);
    var gap = g.tipo === 'largo' ? s(0.035) : s(0.022);
    var it2 = [];
    it2.push('<p ' + TX + ' style="margin:0 0 ' + Math.round(gap * 0.7) + 'px;font-size:' + chapeuPx + 'px;font-weight:700;letter-spacing:' + (chapeuPx * 0.16).toFixed(1) + 'px;line-height:1.2;text-transform:uppercase;color:' + cp.destaque + ';">' + esc((plano.selo ? plano.selo + ' · ' : '') + plano.cabecalho) + '</p>');
    var tit = esc(puro(limpar(dados.titulo)));
    it2.push('<h1 ' + TX + ' style="margin:0;font-size:' + plano.tituloPx + 'px;font-weight:' + (cp.contraste ? 900 : 800) + ';line-height:' + (cp.contraste ? 1.02 : 1.05) + ';letter-spacing:' + (-plano.tituloPx * (cp.contraste ? 0.01 : 0.015)).toFixed(1) + 'px;' + (cp.contraste ? 'text-transform:uppercase;' : '') + 'color:#ffffff;">' + tit + (cp.ponto ? '<span style="color:' + c.laranja + ';">&#9632;</span>' : '') + '</h1>');
    if (limpar(dados.subtitulo)) it2.push('<p ' + TX + ' style="margin:' + gap + 'px 0 0;font-size:' + subPx + 'px;font-weight:400;line-height:1.3;color:rgba(255,255,255,0.86);">' + rico(limpar(dados.subtitulo)) + '</p>');
    var rod = [];
    if (plano.data) {
      var dp = Math.round(botaoPx * 1.05);
      rod.push('<div ' + CX + ' style="float:left;background:' + cp.destaque + ';border-radius:' + raioBox(Math.round(dp * 0.6)) + ';margin-right:' + Math.round(gap * 0.6) + 'px;"><p ' + TX + ' style="margin:0;padding:' + Math.round(dp * 0.55) + 'px ' + Math.round(dp * 0.9) + 'px;font-size:' + dp + 'px;font-weight:800;line-height:1.1;color:' + c.verdeEscuro + ';white-space:nowrap;">' + plano.data.dia + ' ' + esc(plano.data.mes) + (plano.data.hora ? ' · ' + esc(plano.data.hora.replace(':00', 'h').replace(':', 'h')) : '') + '</p></div>');
    }
    if (plano.chamada) {
      rod.push('<div ' + CX + ' style="float:left;background:' + c.laranja + ';border-radius:' + raioBox(Math.round(botaoPx * 1.3)) + ';"><p ' + TX + ' data-forma="botao" style="margin:0;padding:' + Math.round(botaoPx * 0.62) + 'px ' + Math.round(botaoPx * 1.2) + 'px;font-size:' + botaoPx + 'px;font-weight:700;line-height:1.1;color:#ffffff;white-space:nowrap;">' + esc(plano.chamada) + ' &rarr;</p></div>');
    }
    if (rod.length) it2.push('<div style="margin-top:' + Math.round(gap * 1.3) + 'px;overflow:hidden;">' + rod.join('') + '</div>');
    h.push('<div data-ajuste style="position:absolute;left:' + t.x + 'px;top:' + topo + 'px;width:' + t.w + 'px;height:' + alt + 'px;display:flex;flex-direction:column;justify-content:' + (g.tipo === 'largo' ? 'center' : 'flex-start') + ';">' + it2.join('') + '</div>');

    // Prova de processo (tendência): código da peça e coordenadas, discretos.
    if (cp.prova) {
      var pp = Math.max(9, s(g.tipo === 'largo' ? 0.022 : 0.012));
      var py = g.tipo === 'largo' ? g.fb - Math.round(m * 0.65) - pp : g.fb - Math.round(m * 0.55);
      h.push('<p ' + TX + ' style="position:absolute;left:' + m + 'px;top:' + py + 'px;margin:0;font-size:' + pp + 'px;font-weight:700;letter-spacing:' + (pp * 0.18).toFixed(1) + 'px;line-height:1;text-transform:uppercase;color:' + cp.destaque + ';opacity:.75;white-space:nowrap;">' + esc((opcoes.codigo || '') + ' · ' + ((marca.rodape && marca.rodape.coordenadas) || '')) + '</p>');
    }
    // ANS (campanha externa).
    if (plano.publico.ans && marca.ans) {
      var ah = Math.max(14, s(g.tipo === 'largo' ? 0.045 : 0.024)), aw = Math.round(ah * marca.ans.proporcao);
      var ax = g.tipo === 'largo' ? (g.foto ? g.foto.x : W) - Math.round(m * 0.9) - aw : W - m - aw;
      var ay = g.tipo === 'largo' ? g.fb - Math.round(m * 0.65) - ah : g.fb - Math.round(m * 0.55) - ah + Math.round(ah * 0.25);
      h.push('<img ' + IM + ' src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="position:absolute;left:' + ax + 'px;top:' + ay + 'px;width:' + aw + 'px;height:' + ah + 'px;">');
    }
    return h;
  }

  /* Cantos da foto gravados no recorte, com a cor do que fica atrás dela. */
  function formaImagem(plano, it, marca) {
    var g = plano.geo;
    if (!g || !g.foto) return null;
    var U = g.U;
    if (plano.campanha) {
      if (g.tipo === 'largo') return { raio: [Math.round(g.H * 0.22), 0, 0, 0], fundo: plano.campanha.fundo };
      return { raio: [0, 0, 0, Math.round(U * 0.12)], fundo: plano.campanha.fundo };
    }
    var fundo = plano.tema.fundoInterno ? ((marca && marca.cores[plano.tema.fundoInterno]) || plano.tema.fundoInterno) : (marca ? marca.cores.apoioAreia : '#ece3d9');
    if (g.tipo === 'largo') return { raio: [Math.round(g.H * 0.16), 0, 0, 0], fundo: fundo };
    var r = Math.round(U * 0.03);
    return { raio: [r, r, 0, r], fundo: fundo };
  }

  raiz.UnimedModelos = raiz.UnimedModelos || {};
  raiz.UnimedModelos['peca-fixa'] = { render: render, decidir: decidir, slots: slots, geometria: geometria, formaImagem: formaImagem };
})(window);
