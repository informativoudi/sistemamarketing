/* ============================================================
   Modelo · Cartilha padrão Unimed (documentos, políticas, manuais)
   Regras do projeto "Cartilha Padrão Unimed":
   - não muda nem interpreta o texto: só aplica o padrão visual;
   - a tabela de cabeçalho aparece em todas as páginas;
   - entrega em Word (.docx) e PDF.
   A prévia/PDF é paginada em A4 (794 × 1123 px); o Word é gerado
   direto em WordprocessingML, com a tabela no cabeçalho da página.
   ============================================================ */
(function (raiz) {
  'use strict';
  var M = raiz.UnimedMotor;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function url(base, caminho) {
    if (!caminho) return '';
    if (/^(https?:|data:)/.test(caminho)) return caminho;
    return (base || '').replace(/\/?$/, '/') + caminho.replace(/^\//, '');
  }
  function limpar(v) { return String(v == null ? '' : v).replace(/[ \t]+/g, ' ').trim(); }
  function dataBR(v) { var d = String(v || '').split('-'); return d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : (v || '—'); }

  /* ---------- Estrutura: seções numeradas, parágrafos, listas e conceitos ---------- */
  var NUM = /^(\d+(?:\.\d+)*)[.)\-–]?\s+/;
  /* Título de seção: parágrafo de uma linha só, curto, sem ponto final (pode começar com 1., 2.1…).
     Vem antes da regra de lista, para "1. Objetivo" não virar item numerado. */
  function separar(texto, max) {
    var partes = String(texto || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    var blocos = [];
    partes.forEach(function (p, i) {
      var fig = /^\[\[\s*imagem\s+(\d+)\s*\]\]$/i.exec(p);
      if (fig) { blocos.push({ tipo: 'imagem', n: Number(fig[1]) }); return; }
      var umaLinha = p.indexOf('\n') < 0;
      var puro = M.semMarcas(p).trim();
      var curto = puro.length <= max && !/[.!?;,…:]$/.test(puro) && !/^>>/.test(p);
      var pareceItem = /^[-•*]\s/.test(puro);
      if (umaLinha && curto && !pareceItem && (NUM.test(puro) || i < partes.length - 1)) blocos.push({ tipo: 'intertitulo', texto: p });
      else blocos = blocos.concat(M.dividirTexto(p, 0, false));
    });
    return blocos;
  }

  function decidir(formato, marca, tendencias, dados) {
    var blocos = separar(dados.texto, (formato.arvore && formato.arvore.secaoMaxCaracteres) || 90);
    var n = 0;
    var itens = blocos.map(function (b) {
      if (b.tipo !== 'intertitulo') return b;
      var puro = M.semMarcas(b.texto);
      var m = NUM.exec(puro);
      var numero, titulo;
      if (m) { numero = m[1]; titulo = puro.slice(m[0].length); if (numero.indexOf('.') < 0) n = Number(numero); }
      else { n += 1; numero = String(n); titulo = puro; }
      return { tipo: 'secao', numero: numero, sub: numero.indexOf('.') > 0, titulo: titulo };
    });
    // Imagens do computador no meio do texto: largura do texto, altura pela proporção (até 460 px).
    var LARG = 674, MAXH = 460;
    var envios = Array.isArray(dados.imagensDoc) ? dados.imagensDoc : [];
    var figuras = [];
    itens = itens.map(function (b) {
      if (b.tipo !== 'imagem') return b;
      var im = envios[b.n - 1];
      if (!im) return { tipo: 'paragrafo', texto: '[[imagem ' + b.n + ']]' };
      var h = Math.round(LARG * im.h / im.w), w = LARG;
      if (h > MAXH) { w = Math.round(LARG * MAXH / h); h = MAXH; }
      var f = { arquivo: im.arquivo, descricao: im.nome || ('Imagem ' + b.n), w: w, h: h, x: 0.5, y: 0.5, zoom: 1, n: b.n };
      figuras.push(f);
      return { tipo: 'imagem', figura: f };
    });
    var faltando = itens.filter(function (b) { return b.tipo === 'paragrafo' && /^\[\[imagem \d+\]\]$/.test(b.texto); }).length;
    var comTabela = dados.tabelaCabecalho !== 'Sem tabela de cabeçalho';
    var secoes = itens.filter(function (b) { return b.tipo === 'secao'; }).length;
    var caracteres = M.contar(dados.texto);
    return {
      variante: 'documento', caracteres: caracteres, blocos: itens, figuras: figuras, comTabela: comTabela,
      ficha: {
        titulo: limpar(dados.titulo), area: limpar(dados.area) || '—', classificacao: dados.classificacao || 'Interno',
        dataAprovacao: dataBR(dados.dataAprovacao), dataRevisao: dataBR(dados.dataRevisao), versao: limpar(dados.versao) || '1.0'
      },
      realces: (formato.formatacao && formato.formatacao.realces) || [],
      chips: ['Cartilha padrão', comTabela ? 'Com tabela de cabeçalho' : 'Sem tabela de cabeçalho', secoes + (secoes === 1 ? ' seção' : ' seções')].concat(figuras.length ? [figuras.length + (figuras.length === 1 ? ' imagem' : ' imagens')] : []),
      porque: [
        'Documento → padrão "Cartilha Padrão Unimed" (não o visual das peças).',
        'O texto entra exatamente como veio: só o visual muda.',
        secoes ? secoes + ' títulos de seção encontrados → numerados no quadro verde.' : 'Nenhum título de seção encontrado: linhas curtas sozinhas, sem ponto final, viram seção.',
        comTabela ? 'Com tabela de cabeçalho → ela se repete em todas as páginas (no Word, fica no cabeçalho da página).' : 'Sem tabela de cabeçalho → só a faixa de formas no topo das páginas; os dados do documento ficam na capa e no rodapé.',
        figuras.length ? figuras.length + ' imagem(ns) do computador no meio do texto, na largura do texto e com os cantos da marca.' : 'Sem imagens no texto.'
      ].concat(faltando ? ['Atenção: ' + faltando + ' marcação(ões) [[imagem N]] sem imagem enviada com esse número.'] : [])
    };
  }

  /* ---------- Formatação simples dentro do texto ---------- */
  function segmentos(t) {
    // devolve [{t, b, i, h}] a partir de **negrito**, *itálico* e ==(cor)realce==
    var out = [];
    var re = /\*\*([\s\S]+?)\*\*|==\(([a-z0-9-]+)\)([\s\S]+?)==|==([\s\S]+?)==|(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g;
    var i = 0, m;
    while ((m = re.exec(t))) {
      var ini = m.index + (m[5] ? m[5].length : 0);
      if (ini > i) out.push({ t: t.slice(i, ini) });
      if (m[1] != null) out.push({ t: m[1], b: true });
      else if (m[3] != null) out.push({ t: m[3], h: m[2] });
      else if (m[4] != null) out.push({ t: m[4], h: 'citrico' });
      else out.push({ t: m[6], i: true });
      i = re.lastIndex;
    }
    if (i < t.length) out.push({ t: t.slice(i) });
    return out;
  }

  function corRealce(plano, marca, id) {
    var r = (plano.realces || []).filter(function (x) { return x.id === id; })[0] || (plano.realces || [])[0];
    return r ? (marca.cores[r.cor] || r.cor) : marca.cores.citrico;
  }

  function fontes(marca, base) {
    var a = (marca.tipografia && marca.tipografia.arquivos) || [];
    return a.map(function (x) {
      return '@font-face{font-family:"' + x.familia + '";src:url(' + url(base, x.arquivo) + ') format("woff2");font-weight:' + x.peso + ';font-style:' + (x.estilo || 'normal') + ';}';
    }).join('');
  }

  /* ---------- Prévia e PDF: páginas A4 ---------- */
  function render(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var base = opcoes.baseUrl || '';
    var c = marca.cores, F = marca.tipografia.familia;
    var f = plano.ficha;
    var r27 = marca.recursos2027 || {};
    function rico(t) {
      return segmentos(t).map(function (s) {
        var x = esc(s.t);
        if (s.b) return '<strong>' + x + '</strong>';
        if (s.i) return '<em>' + x + '</em>';
        if (s.h) return '<span style="background:' + corRealce(plano, marca, s.h) + ';color:' + c.verdeEscuro + ';border-radius:999px;padding:0 6px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">' + x + '</span>';
        return x;
      }).join('');
    }
    var blocos = plano.blocos.map(function (b) {
      if (b.tipo === 'secao') {
        return '<div class="bl sec' + (b.sub ? ' sub' : '') + '"><span class="num" data-x="caixa">' + esc(b.numero) + '</span><h2 data-x="texto">' + esc(b.titulo) + '</h2></div>';
      }
      if (b.tipo === 'imagem') {
        var fg = b.figura;
        return '<figure class="bl figura"><img data-x="img" src="' + esc(fg.src || fg.arquivo) + '" alt="' + esc(fg.descricao) + '" style="width:' + fg.w + 'px;height:' + fg.h + 'px;border-radius:14px 14px 0 14px;"></figure>';
      }
      if (b.tipo === 'lista') return '<ul class="bl">' + b.itens.map(function (i) { return '<li data-x="texto">' + rico(i) + '</li>'; }).join('') + '</ul>';
      if (b.tipo === 'box') {
        var puro = M.semMarcas(b.texto);
        var m = /^([^:]{2,60}):\s+([\s\S]+)$/.exec(b.texto);
        return '<div class="bl conceito" data-x="caixa">' + (m && puro.indexOf(':') < 62 ? '<p data-x="texto"><b class="termo">' + esc(M.semMarcas(m[1])) + '</b><b class="termo">:</b> ' + rico(m[2]) + '</p>' : '<p data-x="texto">' + rico(b.texto) + '</p>') + '</div>';
      }
      return '<p class="bl" data-x="texto">' + rico(b.texto) + '</p>';
    }).join('');

    var cab = '<div class="cabeca">' +
      (r27.mosaico ? '<img class="formas" data-x="img" src="' + esc(url(base, r27.mosaico)) + '" alt="">' : '') +
      (plano.comTabela === false ? '</div>' : '') +
      (plano.comTabela === false ? '' : '<table class="ficha"><tr><td colspan="6" class="destaque"><span class="rot">Nominação do documento</span><span class="val">' + esc(f.titulo) + '</span></td></tr>' +
      '<tr><td colspan="3"><span class="rot">Área | Dono do processo</span><span class="val">' + esc(f.area) + '</span></td><td colspan="3"><span class="rot">Classificação da informação</span><span class="val">' + esc(f.classificacao) + '</span></td></tr>' +
      '<tr><td colspan="2"><span class="rot">Data da 1ª aprovação</span><span class="val">' + esc(f.dataAprovacao) + '</span></td><td colspan="2"><span class="rot">Data da última revisão</span><span class="val">' + esc(f.dataRevisao) + '</span></td><td colspan="2"><span class="rot">Versão</span><span class="val">' + esc(f.versao) + '</span></td></tr></table></div>');

    var capa = '<div class="pagina capa" data-x="pagina"><div class="capa-card" data-x="caixa">' +
      '<img class="capa-logo" data-x="img" src="' + esc(url(base, 'assets/logos/unimed-box-branco.png')) + '" alt="Unimed Uberlândia">' +
      '<div class="capa-miolo"><p class="capa-chapeu" data-x="texto">' + esc(f.area) + '</p><h1 data-x="texto">' + esc(f.titulo) + '</h1><div class="capa-barra" data-x="caixa"></div></div>' +
      '<p class="capa-rodape" data-x="texto">Versão ' + esc(f.versao) + ' · ' + esc(f.classificacao) + '<br><b>Unimed Uberlândia</b></p></div></div>';

    var css = fontes(marca, base) +
      'html,body{margin:0;padding:0;background:#e8e4de;}*{box-sizing:border-box;}' +
      'body{font-family:' + F + ';color:' + c.texto + ';padding:20px;}' +
      '.pagina{position:relative;width:794px;height:1123px;margin:0 auto 20px;background:#fff;overflow:hidden;}' +
      '.capa{padding:40px;}.capa-card{position:relative;height:100%;border-radius:4px 28px 28px 28px;background:linear-gradient(160deg,' + c.institucional + ' 0%,' + c.verdeEscuro + ' 100%);background-color:' + c.verdeEscuro + ';color:#fff;padding:64px 60px;}' +
      '.capa-logo{width:170px;height:auto;display:block;}.capa-miolo{position:absolute;left:60px;right:60px;top:42%;}' +
      '.capa-chapeu{margin:0 0 16px;font-size:14px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:' + c.citrico + ';}' +
      '.capa h1{margin:0;font-size:44px;line-height:1.02;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;color:#fff;}' +
      '.capa-barra{width:84px;height:5px;background:' + c.citrico + ';margin-top:26px;}' +
      '.capa-rodape{position:absolute;left:60px;bottom:52px;margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.85);}.capa-rodape b{color:#fff;}' +
      '.corpo{padding:60px 60px 70px;}.cabeca{margin-bottom:26px;}.formas{display:block;height:34px;width:auto;margin:0 0 10px auto;}' +
      '.ficha{width:100%;border-collapse:separate;border-spacing:0;border:1px solid ' + c.borda + ';border-radius:4px 12px 12px 12px;overflow:hidden;table-layout:fixed;}' +
      '.ficha td{border-top:1px solid ' + c.borda + ';border-left:1px solid ' + c.borda + ';padding:6px 10px 7px;vertical-align:top;}.ficha tr:first-child td{border-top:0;}.ficha td:first-child{border-left:0;}' +
      '.ficha td.destaque{background:' + c.apoioVerde + ';}' +
      '.rot{display:block;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + c.textoSuave + ';}' +
      '.val{display:block;margin-top:2px;font-size:11px;font-weight:800;text-transform:uppercase;color:' + c.verdeEscuro + ';line-height:1.3;}' +
      '.conteudo{position:absolute;left:60px;right:60px;bottom:70px;overflow:hidden;}' +
      '.rodape{position:absolute;left:60px;right:60px;bottom:30px;font-size:10px;color:' + c.textoSuave + ';display:flex;justify-content:space-between;}' +
      '.bl{margin:0 0 14px;}p.bl,.conceito p{font-size:15px;line-height:1.65;text-align:justify;}' +
      '.sec{display:flex;align-items:center;gap:12px;margin:22px 0 12px;}.sec:first-child{margin-top:0;}' +
      '.num{flex:none;width:34px;height:34px;border-radius:10px 10px 10px 3px;background:' + c.institucional + ';color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;}' +
      '.sec h2{margin:0;font-size:22px;line-height:1.2;font-weight:800;color:' + c.verdeEscuro + ';}' +
      '.sec.sub .num{width:auto;min-width:34px;height:26px;padding:0 6px;font-size:12px;background:' + c.apoioVerde + ';color:' + c.verdeEscuro + ';}.sec.sub h2{font-size:17px;}' +
      'ul.bl{padding:0;list-style:none;}ul.bl li{position:relative;padding-left:20px;font-size:15px;line-height:1.6;margin-bottom:6px;text-align:justify;}' +
      'ul.bl li:before{content:"";position:absolute;left:2px;top:9px;width:7px;height:7px;background:' + c.institucional + ';border-radius:2px 2px 0 2px;}' +
      '.conceito{background:' + c.apoioAreia + ';border-radius:4px 14px 14px 14px;padding:16px 20px;}.conceito p{margin:0;font-size:14px;}' +
      '.termo{font-weight:800;color:' + c.verdeEscuro + ';}strong{font-weight:700;color:' + c.verdeEscuro + ';}' +
      '.figura{margin:6px 0 18px;text-align:center;}.figura img{display:inline-block;}' +
      '#fonte{position:absolute;left:-9999px;top:0;width:674px;}';

    // Paginação no navegador: mede cada bloco e abre página nova quando não cabe.
    var script = '(function(){if(window.frameElement&&/html2canvas/.test(window.frameElement.className||""))return;' +
      'var fonte=document.getElementById("fonte"),molde=document.getElementById("molde"),lugar=document.getElementById("paginas");' +
      'function pagina(){var p=molde.firstElementChild.cloneNode(true);lugar.appendChild(p);var c=p.querySelector(".conteudo");c.style.top=(p.querySelector(".cabeca").offsetTop+p.querySelector(".cabeca").offsetHeight)+"px";return c;}' +
      'function montar(){lugar.innerHTML="";var bl=Array.prototype.slice.call(fonte.children).map(function(b){return b.cloneNode(true);});var c=pagina();' +
      'bl.forEach(function(b){c.appendChild(b);if(c.scrollHeight>c.clientHeight+1&&c.children.length>1){c.removeChild(b);' +
      'var ant=c.lastElementChild;var leva=ant&&ant.classList.contains("sec");if(leva)c.removeChild(ant);c=pagina();if(leva)c.appendChild(ant);c.appendChild(b);}});' +
      'var ps=lugar.querySelectorAll(".pagina");for(var i=0;i<ps.length;i++){ps[i].querySelector(".pg").textContent="Página "+(i+2)+" de "+(ps.length+1);}' +
      'try{parent.postMessage({tipo:"unimed-paginado"},"*");}catch(e){}}' +
      'montar();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(montar);})();';

    return '<!doctype html>\n<!-- Documento ' + esc(opcoes.codigo || '') + ' · Cartilha padrão Unimed -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(f.titulo) + '</title><style>' + css + '</style></head><body>' +
      '<div data-x="peca" style="width:794px;margin:0 auto;">' + capa +
      '<div id="paginas"></div></div>' +
      '<div id="molde" hidden><div class="pagina corpo" data-x="pagina">' + cab + '<div class="conteudo"></div><div class="rodape"><span>Unimed Uberlândia · ' + esc(f.classificacao) + '</span><span class="pg"></span></div></div></div>' +
      '<div id="fonte">' + blocos + '</div>' +
      '<script>' + script + '<\/script></body></html>';
  }

  /* ---------- Word (.docx) ---------- */
  var TW_MM = 56.6929; // twips por mm
  var EMU_PX = 9525;
  function x(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hex(c) { return String(c || '').replace('#', '').toUpperCase(); }

  async function docx(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var base = opcoes.baseUrl || '';
    var c = marca.cores, f = plano.ficha;
    var FONTE = 'Unimed Sans';
    var zip = new raiz.JSZip();

    async function png(caminho) {
      var r = await fetch(url(base, caminho));
      if (!r.ok) throw new Error('imagem ' + caminho);
      var b = await r.arrayBuffer();
      var v = new DataView(b);
      return { dados: b, w: v.getUint32(16), h: v.getUint32(20) };
    }
    var imgs = {};
    try { imgs.logo = await png('assets/logos/unimed-box-branco.png'); } catch (e) { /* segue sem */ }
    try { if (marca.recursos2027 && marca.recursos2027.mosaico) imgs.formas = await png(marca.recursos2027.mosaico); } catch (e) { /* segue sem */ }

    function run(t, o) {
      o = o || {};
      var face = o.face || FONTE;
      return '<w:r><w:rPr><w:rFonts w:ascii="' + face + '" w:hAnsi="' + face + '" w:cs="' + face + '"/>' + (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.caps ? '<w:caps/>' : '') +
        (o.esp ? '<w:spacing w:val="' + o.esp + '"/>' : '') + '<w:color w:val="' + (o.cor || hex(c.texto)) + '"/><w:sz w:val="' + (o.sz || 24) + '"/><w:szCs w:val="' + (o.sz || 24) + '"/>' +
        (o.fundo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fundo + '"/>' : '') + '</w:rPr><w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
    }
    function runsRicos(t, o) {
      return segmentos(t).map(function (s) {
        return run(s.t, Object.assign({}, o, { b: s.b || (o && o.b), i: s.i, fundo: s.h ? hex(corRealce(plano, marca, s.h)) : null, cor: s.b || s.h ? hex(c.verdeEscuro) : (o && o.cor) }));
      }).join('');
    }
    function par(conteudo, o) {
      o = o || {};
      return '<w:p><w:pPr>' + (o.estilo ? '<w:pStyle w:val="' + o.estilo + '"/>' : '') + (o.keep ? '<w:keepNext/>' : '') +
        '<w:spacing w:before="' + (o.antes || 0) + '" w:after="' + (o.depois == null ? 200 : o.depois) + '" w:line="' + (o.linha || 396) + '" w:lineRule="auto"/>' +
        (o.ind ? '<w:ind w:left="' + o.ind[0] + '" w:hanging="' + o.ind[1] + '"/>' : '') + (o.dir ? '<w:ind w:right="' + o.dir + '"/>' : '') +
        (o.borda ? '<w:pBdr><w:top w:val="single" w:sz="' + o.borda[0] + '" w:space="1" w:color="' + o.borda[1] + '"/></w:pBdr>' : '') +
        '<w:jc w:val="' + (o.jc || 'both') + '"/></w:pPr>' + conteudo + '</w:p>';
    }
    var idImg = 1;
    function desenho(rid, wPx, hPx, nome) {
      var cx = Math.round(wPx * EMU_PX), cy = Math.round(hPx * EMU_PX), id = idImg++;
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="' + nome + '"/>' +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + nome + '.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }
    function celula(w, conteudo, o) {
      o = o || {};
      return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : '') +
        (o.fundo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fundo + '"/>' : '') + (o.v ? '<w:vAlign w:val="' + o.v + '"/>' : '') +
        (o.mar ? '<w:tcMar><w:top w:w="' + o.mar[0] + '" w:type="dxa"/><w:left w:w="' + o.mar[1] + '" w:type="dxa"/><w:bottom w:w="' + o.mar[0] + '" w:type="dxa"/><w:right w:w="' + o.mar[1] + '" w:type="dxa"/></w:tcMar>' : '') +
        '</w:tcPr>' + conteudo + '</w:tc>';
    }
    function tabela(larguras, linhas, o) {
      o = o || {};
      var bd = o.borda ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (k) { return '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="' + o.borda + '"/>'; }).join('') + '</w:tblBorders>'
        : '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (k) { return '<w:' + k + ' w:val="nil"/>'; }).join('') + '</w:tblBorders>';
      return '<w:tbl><w:tblPr><w:tblW w:w="' + larguras.reduce(function (a, b) { return a + b; }, 0) + '" w:type="dxa"/>' + bd + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
        '<w:tblGrid>' + larguras.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' + linhas + '</w:tbl>';
    }
    function linha(celulas, o) { return '<w:tr>' + (o && o.altura ? '<w:trPr><w:trHeight w:val="' + o.altura + '" w:hRule="exact"/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>') + celulas + '</w:tr>'; }

    var LARG = Math.round((210 - 2 * 16) * TW_MM); // área útil: A4 com margem de 16 mm
    var col = Math.floor(LARG / 6), grid = [col, col, col, col, col, LARG - col * 5];

    // Cabeçalho (todas as páginas, menos a capa): faixa de formas + tabela da ficha.
    function campoFicha(rot, val) {
      return par(run(rot, { b: true, caps: true, sz: 14, esp: 8, cor: hex(c.textoSuave) }), { depois: 0, linha: 240, jc: 'left' }) +
        par(run(val, { face: 'Unimed Sans ExtraBold', caps: true, sz: 18, cor: hex(c.verdeEscuro) }), { depois: 0, linha: 260, jc: 'left' });
    }
    var mar = [70, 140];
    var ficha = tabela(grid,
      linha(celula(LARG, campoFicha('Nominação do documento', f.titulo), { span: 6, fundo: hex(c.apoioVerde), mar: mar })) +
      linha(celula(col * 3, campoFicha('Área | Dono do processo', f.area), { span: 3, mar: mar }) + celula(LARG - col * 3, campoFicha('Classificação da informação', f.classificacao), { span: 3, mar: mar })) +
      linha(celula(col * 2, campoFicha('Data da 1ª aprovação', f.dataAprovacao), { span: 2, mar: mar }) + celula(col * 2, campoFicha('Data da última revisão', f.dataRevisao), { span: 2, mar: mar }) + celula(LARG - col * 4, campoFicha('Versão', f.versao), { span: 2, mar: mar })),
      { borda: hex(c.borda) });
    var formas = imgs.formas ? par(desenho('rIdFormas', Math.round(34 * imgs.formas.w / imgs.formas.h), 34, 'formas'), { depois: 100, linha: 240, jc: 'right' }) : '';
    var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    var header1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' + formas + (plano.comTabela === false ? '' : ficha) + par('', { depois: 0, linha: 240 }) + '</w:hdr>';
    var header2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' + par('', { depois: 0 }) + '</w:hdr>';
    var footer1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' +
      par(run('Unimed Uberlândia · ' + f.classificacao + ' · Página ', { sz: 16, cor: hex(c.textoSuave) }) + '<w:fldSimple w:instr="PAGE">' + run('1', { sz: 16, cor: hex(c.textoSuave) }) + '</w:fldSimple>' + run(' de ', { sz: 16, cor: hex(c.textoSuave) }) + '<w:fldSimple w:instr="NUMPAGES">' + run('1', { sz: 16, cor: hex(c.textoSuave) }) + '</w:fldSimple>', { depois: 0, linha: 240, jc: 'right' }) + '</w:ftr>';
    var footer2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' + par('', { depois: 0 }) + '</w:ftr>';

    // Capa: bloco verde petróleo (o Word não faz degradê em tabela), logo box branco, área, título e barra cítrico.
    var corpoCapa = (imgs.logo ? par(desenho('rIdLogo', 170, Math.round(170 * imgs.logo.h / imgs.logo.w), 'logo'), { depois: 0, linha: 240, jc: 'left' }) : '') +
      par('', { antes: 4200, depois: 0 }) +
      par(run(f.area, { b: true, caps: true, sz: 21, esp: 30, cor: hex(c.citrico) }), { depois: 200, linha: 260, jc: 'left' }) +
      par(run(f.titulo, { face: 'Unimed Sans Black', caps: true, sz: 64, cor: 'FFFFFF' }), { depois: 300, linha: 240, jc: 'left' }) +
      par('', { borda: [36, hex(c.citrico)], dir: LARG - 2 * 900 - Math.round(84 * 15), depois: 0, linha: 240, jc: 'left' }) +
      par('', { antes: 3000, depois: 0 }) +
      par(run('Versão ' + f.versao + ' · ' + f.classificacao, { sz: 19, cor: 'E6F0EC' }), { depois: 0, linha: 300, jc: 'left' }) +
      par(run('Unimed Uberlândia', { b: true, sz: 19, cor: 'FFFFFF' }), { depois: 0, linha: 300, jc: 'left' });
    var capa = tabela([LARG], linha(celula(LARG, corpoCapa, { fundo: hex(c.verdeEscuro), mar: [900, 900] }), { altura: Math.round(250 * TW_MM) })) +
      '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

    // Imagens do computador: entram como arquivos do Word (com os cantos já gravados no recorte).
    var figs = [];
    async function bytes(src) { var r = await fetch(src); return r.arrayBuffer(); }
    for (var k = 0; k < (plano.figuras || []).length; k++) {
      var fg = plano.figuras[k];
      try { figs.push({ f: fg, dados: await bytes(fg.src || fg.arquivo), rid: 'rIdFig' + (k + 1), arq: 'fig' + (k + 1) + '.jpg' }); } catch (e) { /* segue sem */ }
    }

    // Corpo.
    var corpo = plano.blocos.map(function (b) {
      if (b.tipo === 'imagem') {
        var it = figs.filter(function (q) { return q.f === b.figura; })[0];
        if (!it) return '';
        return par(desenho(it.rid, b.figura.w, b.figura.h, 'imagem' + it.rid), { depois: 240, linha: 240, jc: 'center' });
      }
      if (b.tipo === 'secao') {
        var lado = b.sub ? 820 : 680;
        return par('', { depois: 0, linha: 120 }) + tabela([lado, 180, LARG - lado - 180], linha(
          celula(lado, par(run(b.numero, { b: true, sz: b.sub ? 18 : 24, cor: b.sub ? hex(c.verdeEscuro) : 'FFFFFF' }), { depois: 0, linha: 240, jc: 'center' }), { fundo: hex(b.sub ? c.apoioVerde : c.institucional), v: 'center', mar: [80, 40] }) +
          celula(180, par('', { depois: 0 })) +
          celula(LARG - lado - 180, par(run(b.titulo, { face: 'Unimed Sans ExtraBold', sz: b.sub ? 26 : 33, cor: hex(c.verdeEscuro) }), { depois: 0, linha: 260, jc: 'left', keep: true }), { v: 'center' })
        )) + par('', { depois: 0, linha: 160, keep: true });
      }
      if (b.tipo === 'lista') {
        return b.itens.map(function (i) {
          return par(run('■', { sz: 14, cor: hex(c.institucional) }) + run('\t') + runsRicos(i, {}), { ind: [400, 400], depois: 100 });
        }).join('');
      }
      if (b.tipo === 'box') {
        var m = /^([^:]{2,60}):\s+([\s\S]+)$/.exec(b.texto);
        var miolo = m ? run(M.semMarcas(m[1]) + ': ', { face: 'Unimed Sans ExtraBold', sz: 21, cor: hex(c.verdeEscuro) }) + runsRicos(m[2], { sz: 21 }) : runsRicos(b.texto, { sz: 21 });
        return tabela([LARG], linha(celula(LARG, par(miolo, { depois: 0, linha: 360 }), { fundo: hex(c.apoioAreia), mar: [200, 280] }))) + par('', { depois: 0, linha: 200 });
      }
      return par(runsRicos(b.texto, {}), {});
    }).join('');

    var sect = '<w:sectPr><w:headerReference w:type="default" r:id="rIdH1"/><w:headerReference w:type="first" r:id="rIdH2"/>' +
      '<w:footerReference w:type="default" r:id="rIdF1"/><w:footerReference w:type="first" r:id="rIdF2"/>' +
      '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="' + Math.round(16 * TW_MM) + '" w:right="' + Math.round(16 * TW_MM) + '" w:bottom="' + Math.round(18 * TW_MM) + '" w:left="' + Math.round(16 * TW_MM) + '" w:header="' + Math.round(10 * TW_MM) + '" w:footer="' + Math.round(8 * TW_MM) + '" w:gutter="0"/><w:titlePg/></w:sectPr>';
    var documento = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + capa + corpo + sect + '</w:body></w:document>';

    var estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + FONTE + '" w:hAnsi="' + FONTE + '" w:cs="' + FONTE + '" w:eastAsia="' + FONTE + '"/><w:color w:val="' + hex(c.texto) + '"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="396" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';

    var relsImg = function (lista) {
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + lista.join('') + '</Relationships>';
    };
    var IMG_T = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels', relsImg([
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>']));
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + x(f.titulo) + '</dc:title><dc:creator>Unimed Uberlândia</dc:creator><cp:keywords>' + x(opcoes.codigo || '') + '</cp:keywords><dc:description>Cartilha padrão Unimed · Gerador de Peças</dc:description></cp:coreProperties>');
    var relDoc = [
      '<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
      '<Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
      '<Relationship Id="rIdH2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>',
      '<Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
      '<Relationship Id="rIdF2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>'];
    if (imgs.logo) { zip.file('word/media/logo.png', imgs.logo.dados); relDoc.push('<Relationship Id="rIdLogo" Type="' + IMG_T + '" Target="media/logo.png"/>'); }
    figs.forEach(function (q) { zip.file('word/media/' + q.arq, q.dados); relDoc.push('<Relationship Id="' + q.rid + '" Type="' + IMG_T + '" Target="media/' + q.arq + '"/>'); });
    zip.file('word/_rels/document.xml.rels', relsImg(relDoc));
    if (imgs.formas) {
      zip.file('word/media/formas.png', imgs.formas.dados);
      zip.file('word/_rels/header1.xml.rels', relsImg(['<Relationship Id="rIdFormas" Type="' + IMG_T + '" Target="media/formas.png"/>']));
    }
    zip.file('word/document.xml', documento);
    zip.file('word/styles.xml', estilos);
    zip.file('word/header1.xml', header1);
    zip.file('word/header2.xml', header2);
    zip.file('word/footer1.xml', footer1);
    zip.file('word/footer2.xml', footer2);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  raiz.UnimedModelos = raiz.UnimedModelos || {};
  function formaImagem() { return { raio: [14, 14, 0, 14], fundo: '#ffffff' }; }
  raiz.UnimedModelos.cartilha = { render: render, decidir: decidir, docx: docx, formaImagem: formaImagem };
})(window);
