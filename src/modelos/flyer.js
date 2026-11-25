/* ============================================================
   Flyer · frente (peça fixa) + verso opcional
   Sem verso, é a peça fixa de sempre. Com verso, vira um par:
   frente e verso no mesmo tamanho, mesma marca e mesmas cores,
   e o PDF da gráfica sai com as duas páginas (sangria e corte).
   ============================================================ */
(function (raiz) {
  'use strict';
  function PF() { return raiz.UnimedModelos['peca-fixa']; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function limpar(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function url(base, caminho) { if (!caminho) return ''; if (/^(https?:|data:)/.test(caminho)) return caminho; return (base || '').replace(/\/?$/, '/') + caminho.replace(/^\//, ''); }
  function puro(t) { return String(t == null ? '' : t).replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1').replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1$2'); }
  function rico(t) {
    return esc(t).replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight:800;">$1</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  }
  function temVerso(dados) { return /^Com verso/i.test(dados.verso || '') && (limpar(dados.versoTitulo) || limpar(dados.versoTexto)); }

  function decidir(formato, marca, tendencias, dados) {
    var frente = PF().decidir(formato, marca, tendencias, dados);
    if (!temVerso(dados)) return frente;
    var pecaBase = { largura: formato.largura, altura: formato.altura, exportar: formato.exportar || ['pdf', 'png', 'jpg'], tipo: 'imagem' };
    return {
      kit: true, variante: 'frente-verso', varianteNome: 'FRENTE E VERSO',
      pecas: [
        Object.assign({ id: 'frente', nome: 'Frente', destaque: true, plano: frente, dados: dados, uso: 'Lado da capa' }, pecaBase),
        Object.assign({ id: 'verso', nome: 'Verso', plano: frente, dados: dados, uso: 'Lado das informações' }, pecaBase)
      ],
      publico: frente.publico, tema: frente.tema, campanha: frente.campanha, imagens: frente.imagens, geo: frente.geo,
      caracteres: frente.caracteres, data: frente.data, botao: frente.botao,
      porque: frente.porque.concat(['Com verso → par frente e verso no mesmo tamanho; o PDF para a gráfica sai com as duas páginas, sangria e marcas de corte.']),
      chips: frente.chips.concat(['Frente e verso'])
    };
  }

  /* ---------- Verso: título, texto (parágrafos e tópicos) e faixa de contato ---------- */
  function renderVerso(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var base = opcoes.baseUrl || '';
    var c = marca.cores, F = marca.tipografia.familia;
    var g = plano.geo, W = g.W, H = g.H, m = g.m, U = Math.min(W, H);
    var cp = plano.campanha;
    var fundo = cp ? cp.fundo : (plano.tema.fundoInterno ? (c[plano.tema.fundoInterno] || plano.tema.fundoInterno) : c.apoioAreia);
    var escuro = cp ? !!cp.escuro : false;
    var corTitulo = cp ? (cp.texto || c.verdeEscuro) : c.verdeEscuro;
    var corTexto = cp ? (cp.texto || c.texto) : c.texto;
    var corChapeu = cp ? (cp.destaque || c.citrico) : c.institucional;
    var logo = plano.publico.logo;
    var logoW = Math.max(Math.round(W * 0.3), marca.logos.minimoPx || 70), logoH = Math.round(logoW / logo.proporcao);
    var s = function (k) { return Math.round(U * k); };
    var r27 = marca.recursos2027 || {};
    var grade = !cp && r27.grade ? 'background-image:url(' + url(base, r27.grade) + ');background-size:100% auto;background-repeat:repeat-y;' : '';

    // Texto: linhas com "- " viram tópicos com o quadrado laranja; o resto, parágrafos.
    var blocos = [], lista = [];
    var fecha = function () { if (lista.length) { blocos.push('<ul data-x="texto" style="margin:0 0 ' + s(0.022) + 'px;padding:0;list-style:none;">' + lista.join('') + '</ul>'); lista = []; } };
    String(dados.versoTexto || '').split(/\n/).forEach(function (l) {
      var t = l.trim();
      if (!t) { fecha(); return; }
      var mt = /^[-•*]\s+(.*)$/.exec(t);
      if (mt) { lista.push('<li style="position:relative;padding-left:' + s(0.04) + 'px;margin:0 0 ' + s(0.012) + 'px;"><span style="position:absolute;left:0;top:.42em;width:' + s(0.014) + 'px;height:' + s(0.014) + 'px;background:' + c.laranja + ';"></span>' + rico(mt[1]) + '</li>'); return; }
      fecha();
      blocos.push('<p data-x="texto" style="margin:0 0 ' + s(0.022) + 'px;">' + rico(t) + '</p>');
    });
    fecha();

    var html = [];
    html.push('<img data-x="img" src="' + esc(url(base, logo.claro)) + '" alt="' + esc(logo.nome) + '" style="position:absolute;left:' + m + 'px;top:' + m + 'px;width:' + logoW + 'px;height:' + logoH + 'px;">');
    var contato = limpar(dados.versoContato);
    var faixaH = contato ? s(0.11) : 0;
    var topo = m + logoH + s(0.07), fim = H - m - (faixaH ? faixaH + s(0.04) : 0);
    html.push('<div data-encaixe style="position:absolute;left:' + m + 'px;top:' + topo + 'px;width:' + (W - 2 * m) + 'px;height:' + (fim - topo) + 'px;overflow:hidden;">' +
      '<div data-x="caixa" style="width:' + s(0.07) + 'px;height:' + Math.max(3, s(0.009)) + 'px;background:' + c.citrico + ';margin-bottom:' + s(0.025) + 'px;"></div>' +
      (limpar(dados.versoTitulo) ? '<h2 data-x="texto" style="margin:0 0 ' + s(0.035) + 'px;font-size:' + s(0.07) + 'px;font-weight:800;line-height:1.05;letter-spacing:-' + (U * 0.001).toFixed(1) + 'px;color:' + corTitulo + ';">' + esc(puro(limpar(dados.versoTitulo))) + '</h2>' : '') +
      '<div data-corpo style="font-size:' + s(0.036) + 'px;line-height:1.4;color:' + corTexto + ';">' + blocos.join('') + '</div></div>');
    if (contato) {
      html.push('<div data-x="caixa" style="position:absolute;left:' + m + 'px;top:' + (H - m - faixaH) + 'px;width:' + (W - 2 * m) + 'px;height:' + faixaH + 'px;background:' + (escuro ? c.citrico : c.verdeEscuro) + ';border-radius:' + s(0.03) + 'px ' + s(0.03) + 'px 0 ' + s(0.03) + 'px;display:flex;align-items:center;padding:0 ' + s(0.045) + 'px;">' +
        '<p data-x="texto" style="margin:0;font-size:' + s(0.036) + 'px;font-weight:700;line-height:1.2;color:' + (escuro ? c.verdeEscuro : '#ffffff') + ';">' + rico(contato) + '</p></div>');
    }
    if (plano.publico.ans && marca.ans) {
      var ah = Math.max(14, s(0.03)), aw = Math.round(ah * marca.ans.proporcao);
      html.push('<img data-x="img" src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" style="position:absolute;left:' + (W - m - aw) + 'px;top:' + (m + Math.round((logoH - ah) / 2)) + 'px;width:' + aw + 'px;height:' + ah + 'px;">');
    }
    var fontes = ((marca.tipografia && marca.tipografia.arquivos) || []).map(function (x) {
      return '@font-face{font-family:"' + x.familia + '";src:url(' + url(base, x.arquivo) + ') format("woff2");font-weight:' + x.peso + ';font-style:' + (x.estilo || 'normal') + ';}';
    }).join('');
    return '<!doctype html>\n<!-- Verso ' + esc(opcoes.codigo || '') + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>Verso · ' + esc(puro(dados.titulo)) + '</title><style>' + fontes + 'html,body{margin:0;padding:0;background:#fff;}*{box-sizing:border-box;}</style></head><body>' +
      '<div data-x="peca" style="position:relative;overflow:hidden;width:' + W + 'px;height:' + H + 'px;background:' + fundo + ';' + grade + 'font-family:' + F + ';">' + html.join('') + '</div>' +
      // Encaixe: texto longo diminui um pouco por vez até caber na área segura.
      '<script>(function(){var b=document.querySelector("[data-encaixe]");if(!b)return;var c=b.querySelector("[data-corpo]"),h=b.querySelector("h2");' +
      'function ajusta(){var n=0;while(b.scrollHeight>b.clientHeight+2&&n<24){c.style.fontSize=(parseFloat(c.style.fontSize)*0.95)+"px";if(h&&n%3===2)h.style.fontSize=(parseFloat(h.style.fontSize)*0.95)+"px";n++;}}' +
      'ajusta();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ajusta);})();<\/script></body></html>';
  }

  function pecasHtml(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var aj = dados.ajustes || {};
    return plano.pecas.map(function (p) {
      var o = Object.assign({}, opcoes, { codigo: (opcoes.codigo || '') + (opcoes.codigo ? '-' + p.id.toUpperCase() : '') });
      var html = p.id === 'frente'
        ? PF().render(p.plano, Object.assign({}, dados, { _aj: Object.assign({}, aj.todas || {}, (aj.porPeca || {}).frente || {}) }), marca, o)
        : renderVerso(p.plano, dados, marca, o);
      return { id: p.id, nome: p.nome, uso: p.uso, tipo: 'imagem', largura: p.largura, altura: p.altura, exportar: p.exportar, destaque: p.destaque, html: html };
    });
  }

  /* Prévia: frente e verso lado a lado. */
  function render(plano, dados, marca, opcoes) {
    if (!plano.kit) return PF().render(plano, dados, marca, opcoes);
    opcoes = opcoes || {};
    var c = marca.cores, F = marca.tipografia.familia;
    var lista = pecasHtml(plano, dados, marca, opcoes);
    var LARG = 874, PAD = 24, GAP = 20;
    var w = Math.floor((LARG - 2 * PAD - GAP) / 2);
    var cards = lista.map(function (p) {
      var s = w / p.largura, h = Math.round(p.altura * s);
      return '<figure style="margin:0;width:' + w + 'px;"><div style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,78,76,.08);">' +
        '<iframe scrolling="no" title="' + esc(p.nome) + '" style="border:0;display:block;width:' + p.largura + 'px;height:' + p.altura + 'px;transform:scale(' + s + ');transform-origin:0 0;" srcdoc="' + esc(p.html) + '"></iframe></div>' +
        '<figcaption style="margin:8px 0 0;font-size:13px;color:' + c.textoSuave + ';"><b style="color:' + c.verdeEscuro + ';">' + esc(p.nome) + '</b> · ' + esc(p.uso || '') + '</figcaption></figure>';
    });
    return '<!doctype html>\n<!-- Flyer ' + esc(opcoes.codigo || '') + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(puro(limpar(dados.titulo))) + '</title><style>html,body{margin:0;padding:0;background:' + c.fundoPagina + ';}*{box-sizing:border-box;}</style></head>' +
      '<body><div data-x="mural" style="width:' + LARG + 'px;padding:' + PAD + 'px;font-family:' + F + ';">' +
      '<p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:' + c.institucional + ';">Flyer · frente e verso</p>' +
      '<div style="display:flex;gap:' + GAP + 'px;align-items:flex-start;">' + cards.join('') + '</div></div></body></html>';
  }

  function slots(formato, qtd, dados) { return PF().slots(formato, qtd, dados); }
  function formaImagem(plano, it, marca) { return PF().formaImagem(plano.kit ? plano.pecas[0].plano : plano, it, marca); }

  raiz.UnimedModelos = raiz.UnimedModelos || {};
  raiz.UnimedModelos.flyer = { render: render, decidir: decidir, slots: slots, formaImagem: formaImagem, pecasHtml: pecasHtml };
})(window);
