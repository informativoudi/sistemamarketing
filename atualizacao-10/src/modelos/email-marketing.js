/* ============================================================
   Modelo: E-mail marketing
   Recebe o plano do motor e devolve o HTML do e-mail, em tabelas
   e estilos inline para funcionar no Outlook, Gmail e Apple Mail.

   Estrutura (Manual de Linguagem MS.138 p.168-171 e Manual do Grupo):
   logo na faixa branca → faixa com o nome da área → imagem →
   chapéu + título + data em destaque + texto + botão laranja →
   rodapé com a área que assina, a marca e (externo) o registro ANS.

   Os atributos data-x marcam caixas, textos e imagens para a
   exportação em PowerPoint editável (o e-mail ignora esses atributos).
   ============================================================ */
(function (raiz) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function url(base, caminho) {
    if (/^https?:\/\//.test(caminho)) return caminho;
    return (base || '').replace(/\/?$/, '/') + caminho.replace(/^\//, '');
  }

  function puro(t) {
    return String(t == null ? '' : t)
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1$2');
  }

  function render(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var c = marca.cores;
    var F = marca.tipografia.familia;
    var base = opcoes.baseUrl || '';
    var codigo = opcoes.codigo || 'UNI-EM-PREVIA';
    var box = plano.flags.molduraBox;
    var raioCard = box ? marca.forma.raioCard : '12px';
    var raioBotao = box ? marca.forma.raioBotao : '24px';
    var TX = 'data-x="texto"';
    var CX = 'data-x="caixa"';

    /* Formatação: **negrito**, *itálico* e ==(cor)realce== arredondado com as cores de apoio. */
    var realces = {};
    (plano.realces || []).forEach(function (r) { realces[r.id] = r; });
    var primeiroRealce = (plano.realces || [])[0];
    function realce(id, miolo) {
      var r = realces[id] || primeiroRealce;
      if (!r) return miolo;
      var fundo = c[r.cor] || r.cor, cor = c[r.texto] || r.texto;
      return '<span style="background-color:' + fundo + ';color:' + cor + ';border-radius:999px;padding:1px 8px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">' + miolo + '</span>';
    }
    function rico(t) {
      return esc(t)
        .replace(/==\(([a-z0-9-]+)\)([\s\S]+?)==/gi, function (m, id, x) { return realce(id, x); })
        .replace(/==([\s\S]+?)==/g, function (m, x) { return realce(null, x); })
        .replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
        .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1<em style="font-style:italic;">$2</em>');
    }

    var titulo = esc(puro(String(dados.titulo || '').trim().replace(/[.!]\s*$/, '')));
    var quadrado = plano.flags.quadradoLaranja ? '<span style="color:' + c.laranja + ';">&#9632;</span>' : '';

    /* ---------- Botão (CTA laranja, MS.138 p.168) ---------- */
    function botao(margem) {
      if (!plano.botao) return '';
      var b = plano.botao;
      return '' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:' + (margem || '8px 0 28px') + ';"><tr>' +
        '<td ' + CX + ' data-forma="botao" bgcolor="' + b.cor + '" style="background:' + b.cor + ';border-radius:' + raioBotao + ';">' +
        '<a ' + TX + ' href="' + esc(b.link) + '" target="_blank" style="display:inline-block;padding:16px 28px;font-family:' + F + ';font-size:16px;font-weight:bold;line-height:20px;color:' + b.corTexto + ';text-decoration:none;border-radius:' + raioBotao + ';">' +
        esc(b.texto) + ' &rarr;</a></td></tr></table>';
    }

    /* ---------- Data em destaque ---------- */
    function textoData(d) {
      return esc(d.semana.charAt(0).toUpperCase() + d.semana.slice(1)) + ', ' + d.dia + ' de ' + esc(d.mesLongo) + ' de ' + d.ano;
    }
    function blocoData() {
      if (!plano.data) return '';
      var d = plano.data.info;
      var grande = plano.data.grande;
      var extra = [plano.data.hora ? esc(plano.data.hora) : '', plano.data.local ? esc(plano.data.local) : ''].filter(Boolean).join(' &middot; ');
      return '' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;"><tr>' +
        '<td ' + CX + ' bgcolor="' + c.fundoPagina + '" style="background:' + c.fundoPagina + ';border-radius:' + raioCard + ';padding:12px;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td ' + CX + ' width="' + (grande ? 96 : 84) + '" align="center" valign="middle" bgcolor="' + plano.tema.destaque + '" style="width:' + (grande ? 96 : 84) + 'px;background:' + plano.tema.destaque + ';border-radius:' + raioCard + ';padding:' + (grande ? '16px 0 14px' : '12px 0 10px') + ';font-family:' + F + ';">' +
        '<div ' + TX + ' style="font-size:' + (grande ? 44 : 34) + 'px;font-weight:bold;line-height:1;color:' + plano.tema.textoDestaque + ';">' + d.dia + '</div>' +
        '<div ' + TX + ' style="font-size:12px;font-weight:bold;letter-spacing:2px;line-height:16px;text-transform:uppercase;color:' + plano.tema.textoDestaque + ';padding-top:4px;">' + esc(d.mes) + '</div></td>' +
        '<td valign="middle" style="padding-left:18px;font-family:' + F + ';">' +
        '<div ' + TX + ' style="font-size:' + (grande ? 17 : 16) + 'px;font-weight:bold;line-height:1.4;color:' + c.verdeEscuro + ';">' + textoData(d) + '</div>' +
        (extra ? '<div ' + TX + ' style="font-size:15px;line-height:1.5;color:' + c.texto + ';padding-top:2px;">' + extra + '</div>' : '') +
        '</td></tr></table></td></tr></table>';
    }

    /* ---------- Corpo ---------- */
    function paragrafo(t) {
      return '<p ' + TX + ' style="margin:0 0 16px;font-family:' + F + ';font-size:16px;line-height:1.6;color:' + c.texto + ';">' + rico(t) + '</p>';
    }
    /* Parágrafo inteiro em destaque: box com a forma da marca e a cor de apoio escolhida. */
    function boxDestaque(b) {
      var r = realces[b.cor] || primeiroRealce;
      var fundo = r ? (c[r.cor] || r.cor) : c.apoioVerde;
      var cor = r ? (c[r.texto] || r.texto) : c.verdeEscuro;
      var miolo = rico(b.texto).replace(/<span style="background-color:[^"]*">([\s\S]*?)<\/span>/g, '$1'); // dentro do box não há realce
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr>' +
        '<td ' + CX + ' bgcolor="' + fundo + '" style="background:' + fundo + ';border-radius:' + raioCard + ';padding:20px 24px;">' +
        '<p ' + TX + ' style="margin:0;font-family:' + F + ';font-size:17px;font-weight:500;line-height:1.55;color:' + cor + ';">' + miolo + '</p>' +
        '</td></tr></table>';
    }
    function lista(itens) {
      return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">' +
        itens.map(function (it) {
          return '<tr><td ' + TX + ' valign="top" width="20" style="width:20px;font-family:' + F + ';font-size:12px;line-height:25px;color:' + c.institucional + ';">&#9632;</td>' +
            '<td ' + TX + ' valign="top" style="font-family:' + F + ';font-size:16px;line-height:1.55;color:' + c.texto + ';padding-bottom:6px;">' + rico(it) + '</td></tr>';
        }).join('') + '</table>';
    }

    var corpo = '';
    var botaoColocado = false;
    plano.blocos.forEach(function (b, i) {
      if (b.tipo === 'intertitulo') {
        corpo += '<h2 ' + TX + ' style="margin:28px 0 8px;font-family:' + F + ';font-size:' + plano.intertituloPx + 'px;line-height:1.25;font-weight:bold;color:' + c.verdeEscuro + ';">' + rico(b.texto) + '</h2>';
      } else if (b.tipo === 'lista') {
        corpo += lista(b.itens);
      } else if (b.tipo === 'box') {
        corpo += boxDestaque(b);
      } else {
        corpo += paragrafo(b.texto);
      }
      // Longo com o botão por último: ele também entra depois do primeiro parágrafo.
      if (plano.botao && plano.botao.repetir && plano.botao.ultimo && i === 0) { corpo += botao(); botaoColocado = true; }
    });

    /* No longo, fecha repetindo a data e o botão (MS.138 p.171). */
    var fecho = '';
    if (plano.botao && plano.botao.repetir) {
      fecho = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;"><tr>' +
        '<td style="border-top:1px solid ' + c.borda + ';padding-top:22px;font-family:' + F + ';">' +
        (plano.data ? '<p ' + TX + ' style="margin:0 0 4px;font-size:16px;font-weight:bold;line-height:1.4;color:' + c.verdeEscuro + ';">' + textoData(plano.data.info) + (plano.data.hora ? ' &middot; ' + esc(plano.data.hora) : '') + '</p>' : '') +
        botao('10px 0 28px') + '</td></tr></table>';
    }

    /* ---------- Imagens: até 3, tamanho fixo (já recortadas no navegador) ---------- */
    function foto(it, larguraPct) {
      var src = it.src || url(base, it.arquivo);
      var raio = box ? '12px 12px 0 12px' : '0';
      var ajuste = it.src ? '' : 'object-fit:cover;object-position:' + Math.round(it.x * 100) + '% ' + Math.round(it.y * 100) + '%;height:' + it.h + 'px;';
      return '<img data-x="img" src="' + esc(src) + '" width="' + it.w + '" height="' + it.h + '" alt="' + esc(it.descricao) + '" style="display:block;width:100%;max-width:' + it.w + 'px;' + (ajuste || 'height:auto;') + 'border:0;border-radius:' + raio + ';">';
    }
    function blocoImagens() {
      var im = plano.imagens;
      if (!im) return '';
      var g = im.respiro, t = im.itens;
      var abre = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr>';
      if (t.length === 1) return abre + '<td>' + foto(t[0]) + '</td></tr></table>';
      if (t.length === 2) {
        return abre + '<td class="col" width="' + t[0].w + '" valign="top" style="width:49.25%;">' + foto(t[0]) + '</td>' +
          '<td class="vao" width="' + g + '" style="width:' + g + 'px;font-size:0;line-height:0;">&nbsp;</td>' +
          '<td class="col" width="' + t[1].w + '" valign="top" style="width:49.25%;">' + foto(t[1]) + '</td></tr></table>';
      }
      return abre + '<td class="col" width="' + t[0].w + '" valign="top" style="width:65.67%;">' + foto(t[0]) + '</td>' +
        '<td class="vao" width="' + g + '" style="width:' + g + 'px;font-size:0;line-height:0;">&nbsp;</td>' +
        '<td class="col" width="' + t[1].w + '" valign="top" style="width:32.84%;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>' + foto(t[1]) + '</td></tr>' +
        '<tr><td height="' + g + '" style="height:' + g + 'px;font-size:0;line-height:0;">&nbsp;</td></tr>' +
        '<tr><td>' + foto(t[2]) + '</td></tr></table></td></tr></table>';
    }

    /* ---------- Newsletter: 1ª notícia em destaque, as outras em lista com foto pequena ---------- */
    function blocoNoticias() {
      var ns = plano.noticias;
      if (!ns || !ns.length) return '';
      function linkN(n) {
        return n.link ? '<p style="margin:10px 0 0;font-family:' + F + ';font-size:15px;line-height:1.4;"><a ' + TX + ' href="' + esc(n.link) + '" target="_blank" style="color:' + c.institucional + ';font-weight:bold;text-decoration:none;">' + esc(n.linkTexto) + ' &rarr;</a></p>' : '';
      }
      function fotoN(im) {
        var src = im.src || url(base, im.arquivo);
        return '<img data-x="img" src="' + esc(src) + '" width="' + im.w + '" height="' + im.h + '" alt="' + esc(im.descricao) + '" style="display:block;width:100%;max-width:' + im.w + 'px;height:auto;border:0;border-radius:' + (box ? '12px 12px 0 12px' : '0') + ';">';
      }
      var h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px;">';
      ns.forEach(function (n, i) {
        if (i === 0) {
          h += '<tr><td style="padding:0 0 26px;">' +
            (n.imagem ? fotoN(n.imagem) + '<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>' : '') +
            '<p ' + TX + ' style="margin:0 0 6px;font-family:' + F + ';font-size:11px;font-weight:bold;letter-spacing:2px;line-height:14px;text-transform:uppercase;color:' + c.institucional + ';">Destaque</p>' +
            '<h2 ' + TX + ' style="margin:0;font-family:' + F + ';font-size:24px;line-height:1.2;font-weight:bold;color:' + c.verdeEscuro + ';">' + esc(n.titulo) + '</h2>' +
            (n.texto ? '<p ' + TX + ' style="margin:8px 0 0;font-family:' + F + ';font-size:16px;line-height:1.55;color:' + c.texto + ';">' + rico(n.texto) + '</p>' : '') +
            linkN(n) + '</td></tr>';
        } else {
          h += '<tr><td style="border-top:1px solid ' + c.borda + ';padding:22px 0;">' +
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
            (n.imagem ? '<td class="col" width="' + n.imagem.w + '" valign="top" style="width:' + n.imagem.w + 'px;">' + fotoN(n.imagem) + '</td><td class="vao" width="20" style="width:20px;font-size:0;line-height:0;">&nbsp;</td>' : '') +
            '<td class="col" valign="top">' +
            '<h3 ' + TX + ' style="margin:0;font-family:' + F + ';font-size:19px;line-height:1.25;font-weight:bold;color:' + c.verdeEscuro + ';">' + esc(n.titulo) + '</h3>' +
            (n.texto ? '<p ' + TX + ' style="margin:6px 0 0;font-family:' + F + ';font-size:15px;line-height:1.5;color:' + c.texto + ';">' + rico(n.texto) + '</p>' : '') +
            linkN(n) + '</td></tr></table></td></tr>';
        }
      });
      return h + '</table>';
    }

    var barra = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;"><tr><td ' + CX + ' width="28" height="4" bgcolor="' + c.citrico + '" style="width:28px;height:4px;line-height:4px;font-size:0;background:' + c.citrico + ';">&nbsp;</td></tr></table>';
    var chapeu = barra + '<p ' + TX + ' style="margin:0 0 10px;font-family:' + F + ';font-size:12px;font-weight:bold;letter-spacing:2px;line-height:16px;text-transform:uppercase;color:' + c.institucional + ';">' + esc(plano.tema.rotulo) + '</p>';
    var h1 = '<h1 class="t1" ' + TX + ' style="margin:0 0 ' + (dados.subtitulo ? '10px' : '20px') + ';font-family:' + F + ';font-size:' + plano.tituloPx + 'px;line-height:1.1;font-weight:bold;letter-spacing:-0.5px;color:' + c.verdeEscuro + ';">' + titulo + quadrado + '</h1>';
    var subtitulo = dados.subtitulo ? '<p ' + TX + ' style="margin:0 0 22px;font-family:' + F + ';font-size:18px;font-style:italic;line-height:1.45;color:' + c.textoSuave + ';">' + rico(String(dados.subtitulo).replace(/==\(([a-z0-9-]+)\)([\s\S]+?)==/gi, '$2').replace(/==([\s\S]+?)==/g, '$1')) + '</p>' : '';

    /* ---------- Blocos na ordem escolhida (cabeçalho e rodapé fixos) ---------- */
    var pecas = {
      imagens: blocoImagens(),
      titulo: chapeu + h1 + subtitulo,
      data: blocoData(),
      texto: corpo,
      noticias: blocoNoticias(),
      botao: ''
    };
    if (plano.botao) {
      if (plano.botao.repetir && plano.botao.ultimo) pecas.botao = fecho;            // botão por último: vira o fecho com a data
      else if (!botaoColocado) pecas.botao = botao();
    }
    var conteudo = plano.ordem.map(function (k) { return pecas[k] || ''; }).join('') +
      (plano.botao && plano.botao.repetir && !plano.botao.ultimo ? fecho : '');     // botão em outra posição: repete no fim

    var preheader = esc(puro(dados.subtitulo || (plano.blocos[0] && plano.blocos[0].texto ? plano.blocos[0].texto.slice(0, 110) : '')));

    /* ---------- Logo (Grupo no interno, Unimed no externo) ---------- */
    var logo = plano.publico.logo;
    var larguraLogo = Math.max(logo.larguraEmail, marca.logos.minimoPx);
    var alturaLogo = Math.round(larguraLogo / logo.proporcao);

    var ans = '';
    if (plano.publico.ans && marca.ans) {
      var altAns = 22;
      ans = '<tr><td style="padding:14px 32px 0;"><img data-x="img" src="' + esc(url(base, marca.ans.selo)) + '" height="' + altAns + '" width="' + Math.round(altAns * marca.ans.proporcao) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="display:block;border:0;"></td></tr>';
    }
    /* Fonte da marca: quem tem suporte (Apple Mail, iOS, exportações) usa Unimed Sans; o resto cai no Arial. */
    var fontes = (marca.tipografia.arquivos || []).length ? '<style>' + marca.tipografia.arquivos.map(function (a) {
      return '@font-face{font-family:"' + a.familia + '";src:url(' + url(base, a.arquivo) + ') format("' + (/\.woff2$/.test(a.arquivo) ? 'woff2' : /\.woff$/.test(a.arquivo) ? 'woff' : 'opentype') + '");font-weight:' + a.peso + ';font-style:' + (a.estilo || 'normal') + ';font-display:swap;}';
    }).join('') + '</style>\n' : '';

    var corFaixaTexto = plano.tema.textoFaixa;
    // O quadrado laranja (assinatura 2027) aparece uma vez por peça: no fim do título.
    var r27 = marca.recursos2027 || {};
    var topo;
    if (plano.layout === 'interno-2027') {
      /* Interno 2027 (inspirado na Atualização CERVELLO, de forma sutil):
         logo + faixa curta do mosaico; bloco da área com grade de 12 colunas quase invisível,
         ícone da área no quadro box e nome em dois tons. */
      var p2 = plano.areaPartes;
      topo = '' +
        '<tr><td style="padding:26px 32px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td valign="middle"><img class="logo" data-x="img" src="' + esc(url(base, logo.claro)) + '" width="' + larguraLogo + '" height="' + alturaLogo + '" alt="' + esc(logo.nome) + '" style="display:block;border:0;"></td>' +
        (r27.mosaico ? '<td class="mosaico" valign="middle" align="right" width="' + r27.mosaicoLargura + '"><img data-x="img" src="' + esc(url(base, r27.mosaico)) + '" width="' + r27.mosaicoLargura + '" height="' + r27.mosaicoAltura + '" alt="" style="display:block;border:0;"></td>' : '') +
        '</tr></table></td></tr>\n' +
        '<tr><td ' + CX + ' bgcolor="' + plano.tema.fundoInterno + '"' + (r27.grade ? ' background="' + esc(url(base, r27.grade)) + '"' : '') + ' style="background-color:' + plano.tema.fundoInterno + ';' + (r27.grade ? 'background-image:url(' + esc(url(base, r27.grade)) + ');background-repeat:repeat-y;' : '') + 'padding:22px 32px;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
        (plano.icone ? '<td ' + CX + ' width="56" height="56" align="center" valign="middle" bgcolor="' + c.verdeEscuro + '" style="width:56px;height:56px;background:' + c.verdeEscuro + ';border-radius:' + (box ? '16px 16px 0 16px' : '12px') + ';"><img data-x="img" src="' + esc(url(base, plano.icone)) + '" width="32" height="32" alt="" style="display:block;border:0;margin:0 auto;"></td>' : '') +
        '<td valign="middle" style="padding-left:' + (plano.icone ? 16 : 0) + 'px;font-family:' + F + ';">' +
        (plano.selo ? '<p ' + TX + ' style="margin:0 0 4px;font-size:11px;font-weight:bold;letter-spacing:2px;line-height:14px;text-transform:uppercase;color:' + c.verdeEscuro + ';">' + esc(plano.selo) + '</p>' : '') +
        '<p ' + TX + ' style="margin:0;font-size:24px;font-weight:bold;line-height:1.15;letter-spacing:-0.3px;color:' + c.verdeEscuro + ';">' + (p2.inicio ? esc(p2.inicio) + ' ' : '') + '<span style="color:' + c.institucional + ';">' + esc(p2.fim) + '</span></p>' +
        '</td></tr></table></td></tr>\n';
    } else {
      /* Externo: logo na faixa branca, nunca sobre o laranja (MS.139 p.10); faixa do tema com o nome da área. */
      topo = '' +
        '<tr><td style="padding:26px 32px 22px;"><img data-x="img" src="' + esc(url(base, logo.claro)) + '" width="' + larguraLogo + '" height="' + alturaLogo + '" alt="' + esc(logo.nome) + '" style="display:block;border:0;"></td></tr>\n' +
        '<tr><td ' + CX + ' bgcolor="' + plano.tema.faixa + '" style="background:' + plano.tema.faixa + ';padding:20px 32px;">' +
        '<p ' + TX + ' style="margin:0;font-family:' + F + ';font-size:24px;font-weight:bold;line-height:1.15;letter-spacing:-0.3px;color:' + corFaixaTexto + ';">' + esc(plano.cabecalho) + '</p></td></tr>\n';
    }

    /* Responsivo: em telas até 620px o respiro lateral diminui, o título encolhe e as imagens empilham. */
    var responsivo = '<style>\n' +
      'body{-webkit-text-size-adjust:100%;}\n' +
      '@media only screen and (max-width:620px){\n' +
      '  .px{padding-left:20px!important;padding-right:20px!important;}\n' +
      '  .t1{font-size:28px!important;line-height:1.15!important;}\n' +
      '  .col{display:block!important;width:100%!important;max-width:100%!important;}\n' +
      '  .col + .vao{display:block!important;width:100%!important;height:8px!important;}\n' +
      '  .col img{width:100%!important;max-width:100%!important;height:auto!important;}\n' +
      '  .logo{width:190px!important;height:auto!important;}\n' +
      '  .mosaico{width:72px!important;}.mosaico img{width:72px!important;height:auto!important;}\n' +
      '}\n</style>\n';

    var saida = '' +
'<!doctype html>\n<!-- Peça ' + esc(codigo) + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="x-unimed-codigo" content="' + esc(codigo) + '">\n' + fontes + '<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="x-apple-disable-message-reformatting">\n<title>' + esc(puro(dados.titulo)) + '</title>\n' + responsivo + '</head>\n' +
'<body style="margin:0;padding:0;background:' + c.fundoPagina + ';">\n' +
'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + preheader + '</div>\n' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + c.fundoPagina + '" style="background:' + c.fundoPagina + ';"><tr><td align="center" style="padding:24px 12px;">\n' +
'<table data-x="email" ' + CX + ' role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;">\n' +
topo +

'<tr><td style="padding:30px 32px 6px;">' + conteudo + '</td></tr>\n' +
/* Fechamento: mote da marca + site (ANS só no externo). O código da peça fica só no HTML. */
'<tr><td ' + CX + ' bgcolor="' + c.verdeEscuro + '" style="background:' + c.verdeEscuro + ';padding:28px 0 28px;">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
'<tr><td style="padding:0 32px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td ' + CX + ' width="28" height="4" bgcolor="' + c.citrico + '" style="width:28px;height:4px;line-height:4px;font-size:0;background:' + c.citrico + ';">&nbsp;</td></tr></table></td></tr>' +
'<tr><td ' + TX + ' style="padding:0 32px;font-family:' + F + ';font-size:22px;font-weight:bold;line-height:1.2;letter-spacing:-0.3px;color:#ffffff;">' + esc(marca.rodape.mote || '') + '</td></tr>' +
'<tr><td style="padding:6px 32px 0;font-family:' + F + ';font-size:14px;line-height:1.5;"><a ' + TX + ' href="https://' + esc(marca.rodape.site) + '" target="_blank" style="color:' + c.citrico + ';text-decoration:none;font-weight:bold;">' + esc(marca.rodape.site) + '</a></td></tr>' +
ans +
'</table></td></tr>\n' +
'</table>\n</td></tr></table>\n</body>\n</html>\n';
    return saida.replace(/<td((?:(?!class=)[^>])*?)style="([^"]*?padding:[^";]*32px[^"]*)"/g, '<td class="px"$1style="$2"');
  }

  /* Cantos das fotos gravados no recorte (moldura box): o e-mail tem fundo branco atrás das fotos. */
  function formaImagem(plano) {
    return plano.flags && plano.flags.molduraBox ? { raio: [12, 12, 0, 12], fundo: '#ffffff' } : null;
  }

  var api = { render: render, esc: esc, formaImagem: formaImagem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { raiz.UnimedModelos = raiz.UnimedModelos || {}; raiz.UnimedModelos['email-marketing'] = api; }
})(typeof window !== 'undefined' ? window : this);
