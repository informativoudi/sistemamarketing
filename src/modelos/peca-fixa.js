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
  function geometria(f, temImagem, campanha, lado) {
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
    var inv = /^Invert/i.test(lado || '');
    var g = { W: W, H: H, m: m, mt: mt, mb: mb, mbT: mbT, fb: fb, tipo: tipo, campanha: !!campanha, inv: inv && !campanha && !!temImagem };
    mb = mbT;
    // Campanha: desenho da Key Art 2027 (src/modelos/keyart-2027.js), por estilo.
    if (campanha) return raiz.UnimedKeyArt.geometria(g, typeof campanha === 'object' ? campanha : { estilo: 'foto' }, temImagem);
    if (tipo === 'largo') {
      g.U = H;
      g.foto = temImagem ? { x: Math.round(W * (prop >= 3 ? 0.64 : 0.58)), y: 0 } : null;
      if (g.foto) { g.foto.w = W - g.foto.x; g.foto.h = H; }
      g.texto = { x: m, y: mt, w: (g.foto ? g.foto.x : W) - m - Math.round(m * (g.foto ? 0.8 : 1)), h: H - mt - mb };
      // Foto invertida: sangra à esquerda e o texto vai para a direita.
      if (g.inv && g.foto) { g.foto.x = 0; var tx = g.foto.w + Math.round(m * 0.8); g.texto = { x: tx, y: mt, w: W - tx - m, h: H - mt - mb }; }
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
      // Foto invertida: texto logo abaixo do logo e a foto embaixo, na margem.
      if (g.inv && g.foto) { g.foto.y = H - mb - hFoto; g.texto = { x: m, y: topoFoto, w: W - 2 * m, h: g.foto.y - Math.round(m * 0.45) - topoFoto }; }
    }
    return g;
  }

  /* Tamanho do quadro da imagem (usado pelo editor de enquadramento). */
  function ehCampanha(formato, dados) {
    var pub = (formato.publicos || {})[dados && dados.publico] || {};
    if (pub.layout !== 'campanha') return null;
    var t = raiz.UnimedTendencias || {};
    var linha = (t.campanhas || {})[/intern/i.test((dados && dados.publico) || '') ? 'interna' : 'externa'];
    return { estilo: raiz.UnimedKeyArt.estiloDe(t, linha, dados) };
  }
  function slots(formato, qtd, dados) {
    if (!qtd) return [];
    var g = geometria(formato, true, ehCampanha(formato, dados), dados && dados.ladoFoto);
    return [{ w: g.foto.w, h: g.foto.h }];
  }

  /* ---------- Linha da campanha (Radar → "campanhas"): externa ou interna ----------
     As duas são da mesma família (Tendências do ciclo), mas nunca se misturam:
     externa = forte, fundo escuro, todas as tendências, Unimed + ANS;
     interna = próxima, fundo claro, 2027 sutil, marca do Grupo. */
  function linhaCampanha(marca, tendencias, dados, porque) {
    var t = tendencias || {};
    var qual = /intern/i.test((dados && dados.publico) || '') ? 'interna' : 'externa';
    var todas = t.campanhas || {};
    var l = todas[qual] || (qual === 'externa' ? t.campanha : null) || {};
    // Campanha do ano (config/campanhas.json): ajusta estilo padrão, selo, destaque e mote da linha.
    var ct = t.campanhasTematicas || {};
    var tem = (ct.lista || []).filter(function (x) { return x.nome === (dados && dados.campanha) || x.id === (dados && dados.campanha); })[0];
    if (tem) {
      l = Object.assign({}, l, {
        nome: tem.nome + (qual === 'interna' ? ' · interna' : ''),
        estiloPadrao: tem.estiloPadrao && (l.estilos || []).indexOf(tem.estiloPadrao) >= 0 ? tem.estiloPadrao : l.estiloPadrao,
        selo: tem.selo ? (qual === 'interna' ? tem.selo + ' · interna' : tem.selo) : l.selo,
        mote: tem.mote || l.mote
      });
    }
    var c = marca.cores, cor = function (k, padrao) { return c[k] || k || padrao; };
    var ativas = {};
    (t.tendencias || []).forEach(function (x) { if (x.status === 'ativa') ativas[x.id] = true; });
    var usa = function (id) { return !!ativas[id] && (!l.tendencias || l.tendencias.indexOf(id) >= 0); };
    var KA = raiz.UnimedKeyArt;
    var estilo = KA.estiloDe(t, l, dados);
    var pal = KA.cores(t, marca, estilo);
    var cp = {
      linha: qual, nome: l.nome || (qual === 'externa' ? 'Campanha externa' : 'Campanha interna'), tom: l.tom || '',
      ciclo: t.ciclo, conceito: t.conceito, selo: l.selo,
      marca: l.marca || (qual === 'externa' ? 'externo' : 'interno'), ans: l.ans != null ? !!l.ans : qual === 'externa',
      estilo: estilo, nomeEstilo: pal.nomeEstilo, P: pal.P, fundo: pal.fundo, escuro: pal.escuro,
      texto: pal.texto, destaque: pal.destaque, legenda: pal.legenda, textura: pal.textura,
      contraste: usa('titulo-contraste'), caixaAlta: usa('titulo-contraste'), ponto: usa('quadrado-laranja'), box: usa('moldura-box'),
      usaTextura: usa('textura-papel'), prova: usa('prova-de-processo'), misto: usa('neo-brutalismo'), elementos: usa('elementos-key-art'),
      mote: l.mote || (marca.rodape && marca.rodape.mote) || '',
      tematica: tem ? tem.id : '', itensPadrao: tem ? tem.itens : null
    };
    // Cor de destaque da campanha, só se tiver contraste com o fundo do estilo.
    var corTem = tem && tem.destaque ? pal.P[tem.destaque] || (marca.cores || {})[tem.destaque] : '';
    if (corTem && Math.abs(luz(corTem) - luz(cp.fundo)) > 0.35) cp.destaque = corTem;
    if (tem && porque) porque.push('Campanha ' + tem.nome + ' → estilo padrão ' + (tem.estiloPadrao || '—') + ', destaque ' + (tem.destaque || '—') + (tem.aguardandoMaterial ? ' (visual provisório até chegar o material oficial).' : '.'));
    if (porque) {
      var nomes = ['titulo-contraste', 'neo-brutalismo', 'quadrado-laranja', 'moldura-box', 'textura-papel', 'prova-de-processo', 'elementos-key-art'].filter(usa)
        .map(function (k) { return ((t.tendencias || []).filter(function (x) { return x.id === k; })[0] || {}).nome || k; });
      porque.push(cp.nome + ' → Key Art ' + (t.ciclo || '') + ', estilo ' + cp.nomeEstilo + ', linha ' + qual + ' do ciclo ' + (t.ciclo || '') + (t.conceito ? ' ("' + t.conceito + '")' : '') + (cp.tom ? ': ' + cp.tom.toLowerCase() : '') + '. Tendências: ' + (nomes.join(', ') || 'nenhuma') + '.');
    }
    return cp;
  }
  function luz(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 1;
    var n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
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
    if (pub.layout === 'campanha') campanha = linhaCampanha(marca, tendencias, dados, porque);
    if (campanha) { logo = marca.logos[campanha.marca] || logo; if (campanha.escuro) logo = Object.assign({}, logo, { claro: logo.escuro || logo.claro }); }
    var g = geometria(formato, !!aprovada, campanha, dados.ladoFoto);
    if (g.inv) porque.push('Lado da foto invertido → ' + (g.tipo === 'largo' ? 'foto à esquerda, texto à direita.' : 'texto em cima, foto embaixo.'));
    var imagens = aprovada ? { quantidade: 1, itens: [Object.assign({ arquivo: aprovada.arquivo, descricao: aprovada.descricao, w: g.foto.w, h: g.foto.h }, ap)] } : null;
    porque.push(formato.largura + ' × ' + formato.altura + ' px, margem de ' + formato.margem + ' px → desenho ' + { largo: 'horizontal', quadrado: 'quadrado', alto: 'vertical' }[g.tipo] + '.');
    porque.push(imagens ? 'Com imagem → foto no quadro de ' + g.foto.w + ' × ' + g.foto.h + ' px.' : 'Sem imagem → fundo de apoio com a grade leve.');
    var titulo = puro(limpar(dados.titulo));
    var n = titulo.length;
    var base = g.tipo === 'largo' ? 0.105 : g.tipo === 'alto' ? (formato.largura / formato.altura < 0.6 ? 0.1 : 0.085) : 0.068;
    if (campanha) {
      var fino = formato.largura / formato.altura < 0.6; // story, pop-up
      base = g.tipo === 'largo' ? (g.compacto ? 0.17 : 0.14) : g.tipo === 'alto' ? (fino ? 0.13 : 0.115) : 0.11;
    }
    var red = n > 65 ? 0.72 : n > 45 ? 0.85 : 1;
    var dataInfo = null;
    if (dados.data) {
      var d = String(dados.data).split('-');
      if (d.length === 3) dataInfo = { dia: Number(d[2]), mes: MESES[Number(d[1]) - 1] || '', hora: limpar(dados.hora) };
    }
    if (dataInfo) porque.push('Com data → selo cítrico com dia e mês.');
    if (limpar(dados.chamada)) porque.push('Com chamada → botão laranja (sem link: é uma imagem).');
    // MS.024: serviço ou recurso próprio na peça externa → assinatura só em letras, nunca logo próprio.
    var servicos = (marca.assinaturaTextual && marca.assinaturaTextual.servicos) || {};
    var servico = !campanha && pub.ans && dados.filial && servicos[dados.filial] && servicos[dados.filial].nome ? servicos[dados.filial] : null;
    if (servico) porque.push('Peça externa de ' + dados.filial + ' → assinatura em letras (MS.024): ' + servico.nome + (servico.apoio ? ' / ' + servico.apoio : '') + '.');
    return {
      servico: servico,
      variante: 'fixa', varianteNome: g.tipo === 'largo' ? 'HORIZONTAL' : g.tipo === 'alto' ? 'VERTICAL' : 'QUADRADO',
      caracteres: puro(limpar(dados.subtitulo)).length + n,
      publico: { nome: dados.publico || 'Interno', logo: logo, ans: campanha ? campanha.ans : !!pub.ans, assinatura: campanha ? logo.nome : pub.assinatura },
      selo: campanha && campanha.selo != null ? campanha.selo : pub.selo, tema: tema, imagens: imagens, geo: g, campanha: campanha,
      tituloPx: Math.round(g.U * base * red),
      cabecalho: limpar(dados.cabecalho) || limpar(dados.area) || logo.nome,
      data: dataInfo, chamada: limpar(dados.chamada),
      botao: !!limpar(dados.chamada),
      porque: porque,
      chips: [campanha ? campanha.nome + ' ' + (campanha.ciclo || '') : g.tipo === 'largo' ? 'Horizontal' : g.tipo === 'alto' ? 'Vertical' : 'Quadrado', formato.largura + ' × ' + formato.altura, dados.publico || 'Interno', 'Tema ' + (dados.tema || '')]
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
    if (plano.campanha) return embrulhar(raiz.UnimedKeyArt.render(plano, dados, marca, opcoes), plano.campanha.fundo);

    // Fundo: cor de apoio do tema + grade de 12 colunas quase invisível.
    var grade = r27.grade ? 'background-image:url(' + url(base, r27.grade) + ');background-size:100% auto;background-repeat:repeat-y;' : '';
    var areaFundo = g.tipo === 'largo' ? (g.inv && g.foto ? { x: g.foto.w, y: 0, w: W - g.foto.w, h: H } : { x: 0, y: 0, w: g.foto ? g.foto.x : W, h: H }) : { x: 0, y: 0, w: W, h: H };
    html.push('<div ' + CX + ' style="position:absolute;left:' + areaFundo.x + 'px;top:' + areaFundo.y + 'px;width:' + areaFundo.w + 'px;height:' + areaFundo.h + 'px;background-color:' + fundo + ';' + grade + '"></div>');

    // Logo (+ faixa do mosaico) no topo da área de texto.
    var logo = plano.publico.logo;
    var logoH = g.tipo === 'largo' ? Math.max(Math.round(U * 0.11), 26) : Math.round(U * 0.06);
    var logoW = Math.round(logoH * logo.proporcao);
    var maxLogo = g.tipo === 'largo' ? g.texto.w * 0.8 : g.texto.w * 0.62;
    if (logoW > maxLogo) { logoW = Math.round(maxLogo); logoH = Math.round(logoW / logo.proporcao); }
    logoW = Math.max(logoW, marca.logos.minimoPx || 70);
    html.push('<img ' + IM + ' src="' + esc(url(base, logo.claro)) + '" alt="' + esc(logo.nome) + '" style="position:absolute;left:' + (g.tipo === 'largo' ? g.texto.x : m) + 'px;top:' + g.mt + 'px;width:' + logoW + 'px;height:' + Math.round(logoW / logo.proporcao) + 'px;">');
    if (r27.mosaico && g.tipo !== 'largo') {
      var mh = Math.round(logoH * 0.9), mw = Math.round(mh * (r27.mosaicoLargura / r27.mosaicoAltura));
      html.push('<img ' + IM + ' src="' + esc(url(base, r27.mosaico)) + '" alt="" style="position:absolute;left:' + (W - m - mw) + 'px;top:' + (g.mt + Math.round((Math.round(logoW / logo.proporcao) - mh) / 2)) + 'px;width:' + mw + 'px;height:' + mh + 'px;">');
    }

    // Foto: no horizontal sangra à direita com o canto do box; nos outros, quadro box dentro da margem.
    if (plano.imagens && g.foto) {
      var it = plano.imagens.itens[0];
      var src = it.src || url(base, it.arquivo);
      var raio = g.tipo === 'largo' ? (g.inv ? '0 ' + Math.round(H * 0.16) + 'px 0 0' : Math.round(H * 0.16) + 'px 0 0 0') : raioBox(Math.round(U * 0.03));
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
    // Assinatura do serviço próprio (MS.024): nome em Sans Bold caixa alta + apoio em Slab Bold.
    if (plano.servico) {
      var sn = g.tipo === 'largo' ? s(0.04) : s(0.026), sa = Math.round(sn * 0.9);
      itens.push('<div ' + CX + ' data-forma="assinatura" style="margin-top:' + (g.tipo === 'largo' ? Math.round(gap * 1.2) + 'px' : 'auto') + ';padding-top:' + Math.round(gap * 1.2) + 'px;">' +
        '<p ' + TX + ' style="margin:0;font-size:' + sn + 'px;font-weight:700;letter-spacing:0;line-height:1.1;text-transform:uppercase;color:' + c.verdeEscuro + ';">' + esc(plano.servico.nome) + '</p>' +
        (plano.servico.apoio ? '<p ' + TX + ' style="margin:' + Math.round(sn * 0.25) + 'px 0 0;font-family:\'Unimed Slab\',Georgia,serif;font-size:' + sa + 'px;font-weight:700;line-height:1.15;color:' + c.institucional + ';">' + esc(plano.servico.apoio) + '</p>' : '') + '</div>');
    }

    html.push('<div data-ajuste style="position:absolute;left:' + t.x + 'px;top:' + topoTexto + 'px;width:' + t.w + 'px;height:' + altTexto + 'px;display:flex;flex-direction:column;justify-content:' + (g.tipo === 'largo' ? 'center' : 'flex-start') + ';">' + itens.join('') + '</div>');

    // ANS nas peças externas (canto inferior direito, dentro da margem).
    if (plano.publico.ans && marca.ans) {
      var ah = Math.max(14, s(g.tipo === 'largo' ? 0.045 : 0.026)), aw = Math.round(ah * marca.ans.proporcao);
      var ax = g.tipo === 'largo' && g.foto && !g.inv ? g.foto.x - Math.round(m * 0.8) - aw : W - m - aw;
      html.push('<img ' + IM + ' src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="position:absolute;left:' + ax + 'px;top:' + (g.fb - ah - Math.round(m * 0.5)) + 'px;width:' + aw + 'px;height:' + ah + 'px;">');
    }

    return embrulhar(html, fundo);

    function embrulhar(partes, fundoPeca) {
      // Ajustes finos (posição, alinhamento, tamanho do título, deslocamento) — sempre dentro da área segura do texto.
      var aj = dados._aj || (dados.ajustes && dados.ajustes.todas) || {};
      var A = JSON.stringify({ v: aj.v || '', h: aj.h || '', e: Number(aj.e) || 1, dx: Number(aj.dx) || 0, dy: Number(aj.dy) || 0 });
      var scriptAntes = '<script>(function(){var A=' + A + ';var t=document.querySelector("[data-ajuste]");if(!t)return;' +
        'if(A.v){Array.prototype.slice.call(t.children).forEach(function(c){if(c.style.flexGrow==="1")c.remove();});t.style.justifyContent="flex-start";' +
        'var mola=function(){var d=document.createElement("div");d.style.cssText="flex:1 1 0px;min-height:0;";return d;};' +
        'if(A.v==="base"||A.v==="meio"){t.insertBefore(mola(),t.firstChild);t.style.paddingBottom=Math.round(t.clientHeight*0.02)+"px";}if(A.v==="meio")t.appendChild(mola());}' +
        'if(A.h==="centro"){t.style.textAlign="center";t.style.alignItems="center";Array.prototype.forEach.call(t.querySelectorAll("div"),function(d){if(d.style.float==="left"){d.style.float="none";d.style.display="inline-block";d.style.verticalAlign="top";}if(d.style.overflow==="hidden"){d.style.textAlign="center";d.style.alignSelf="stretch";}});}' +
        'if(A.e!==1){var h=t.querySelector("h1");if(h)h.style.fontSize=(parseFloat(h.style.fontSize)*A.e)+"px";}' +
        '})();<\/script>';
      var scriptDepois = '<script>(function(){var A=' + A + ';if(!A.dx&&!A.dy)return;var t=document.querySelector("[data-ajuste]"),pc=document.querySelector("[data-x=peca]");if(!t||!pc)return;' +
        'function mover(){t.style.transform="";var r=t.getBoundingClientRect(),u=null;Array.prototype.forEach.call(t.children,function(c){var b=c.getBoundingClientRect();if(!b.width&&!b.height)return;u=u?{l:Math.min(u.l,b.left),t:Math.min(u.t,b.top),r:Math.max(u.r,b.right),b:Math.max(u.b,b.bottom)}:{l:b.left,t:b.top,r:b.right,b:b.bottom};});if(!u)return;' +
        'var passo=Math.min(pc.offsetWidth,pc.offsetHeight)*0.025;var x=Math.max(r.left-u.l,Math.min(r.right-u.r,A.dx*passo)),y=Math.max(r.top-u.t,Math.min(r.bottom-u.b,A.dy*passo));t.style.transform="translate("+Math.round(x)+"px,"+Math.round(y)+"px)";}' +
        'mover();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){setTimeout(mover,0);});})();<\/script>';
      return '<!doctype html>\n<!-- Peça ' + esc(opcoes.codigo || '') + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(puro(dados.titulo)) + '</title>' + fontes(marca, base) +
      '<style>html,body{margin:0;padding:0;background:#ffffff;}*{box-sizing:border-box;}[data-ajuste]>*{flex-shrink:0;}</style></head><body>' +
      '<div data-x="peca" style="position:relative;overflow:hidden;width:' + W + 'px;height:' + H + 'px;background:' + fundoPeca + ';font-family:' + F + ';">' + partes.join('') + '</div>' + scriptAntes +
      /* Encaixe: se o texto passar da área segura, o título (e depois o apoio) diminuem um pouco por vez. */
      '<script>(function(){var t=document.querySelector("[data-ajuste]");if(!t)return;var h=t.querySelector("h1"),p=t.querySelectorAll("p");' +
      'function cabe(){var ms=Array.prototype.filter.call(t.children,function(c){return c.style.flexGrow==="1";});if(ms.length&&ms.some(function(m){return m.getBoundingClientRect().height>1;}))return true;return t.scrollHeight<=t.clientHeight+Math.max(2,Math.round(t.clientHeight*0.015));}' +
      'function ajusta(){var n=0;while(!cabe()&&n<16){h.style.fontSize=(parseFloat(h.style.fontSize)*0.94)+"px";if(n>6)for(var i=0;i<p.length;i++){p[i].style.fontSize=(parseFloat(getComputedStyle(p[i]).fontSize)*0.95)+"px";}n++;}}' +
      'ajusta();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ajusta);})();<\/script>' + scriptDepois +
      '</body></html>';
    }
  }

  /* Cantos da foto gravados no recorte, com a cor do que fica atrás dela. */
  function formaImagem(plano, it, marca) {
    var g = plano.geo;
    if (!g || !g.foto) return null;
    var U = g.U;
    if (plano.campanha) return { raio: g.foto.raio.map(function (r) { return Math.round(r); }), fundo: g.foto.fundo || plano.campanha.fundo };
    var fundo = plano.tema.fundoInterno ? ((marca && marca.cores[plano.tema.fundoInterno]) || plano.tema.fundoInterno) : (marca ? marca.cores.apoioAreia : '#ece3d9');
    if (g.tipo === 'largo') return { raio: g.inv ? [0, Math.round(g.H * 0.16), 0, 0] : [Math.round(g.H * 0.16), 0, 0, 0], fundo: fundo };
    var r = Math.round(U * 0.03);
    return { raio: [r, r, 0, r], fundo: fundo };
  }

  raiz.UnimedModelos = raiz.UnimedModelos || {};
  raiz.UnimedModelos['peca-fixa'] = { render: render, decidir: decidir, slots: slots, geometria: geometria, formaImagem: formaImagem, linhaCampanha: linhaCampanha };
})(window);
