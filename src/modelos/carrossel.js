/* ============================================================
   Carrossel (Instagram / LinkedIn) · capa + até 9 cards + fechamento
   Cada card é uma peça de tamanho fixo (peca-fixa) com o mesmo visual.
   A prévia mostra todos os cards lado a lado; o download sai em .zip.
   ============================================================ */
(function (raiz) {
  'use strict';
  function PF() { return raiz.UnimedModelos['peca-fixa']; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function limpar(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function url(base, caminho) { if (!caminho || /^(data:|https?:)/.test(caminho)) return caminho; return (base || '') + caminho; }

  function cardsDe(dados) {
    return (dados.noticias || []).filter(function (n) { return n && limpar(n.titulo); });
  }

  /* Os dados de cada card: a capa usa título e apoio; os cards, o título e o texto de cada item. */
  function dadosDosCards(dados) {
    var cards = cardsDe(dados);
    var total = 1 + cards.length + (limpar(dados.chamada) ? 1 : 0);
    var lista = [];
    var base = Object.assign({}, dados, { chamada: '', data: '', hora: '' });
    lista.push({ id: 'capa', nome: 'Capa', d: Object.assign({}, base, { cabecalho: (limpar(dados.cabecalho) || limpar(dados.area)) + ' · 1/' + total, data: dados.data, hora: dados.hora }) });
    cards.forEach(function (n, i) {
      lista.push({ id: 'card-' + (i + 2), nome: 'Card ' + (i + 2), d: Object.assign({}, base, {
        titulo: n.titulo, subtitulo: n.texto || '',
        cabecalho: (limpar(dados.cabecalho) || limpar(dados.area)) + ' · ' + (i + 2) + '/' + total,
        imagens: n.imagem ? [{ id: n.imagem, x: n.x == null ? 0.5 : n.x, y: n.y == null ? 0.5 : n.y, zoom: n.zoom || 1 }] : []
      }) });
    });
    if (limpar(dados.chamada)) {
      lista.push({ id: 'fechamento', nome: 'Fechamento', d: Object.assign({}, base, {
        titulo: limpar(dados.textoFinal) || 'Ficou com alguma dúvida?', subtitulo: '', chamada: dados.chamada, imagens: [],
        cabecalho: (limpar(dados.cabecalho) || limpar(dados.area)) + ' · ' + total + '/' + total
      }) });
    }
    return lista;
  }

  function slots(formato, qtd, dados) { return PF().slots(formato, qtd, dados); }

  function decidir(formato, marca, tendencias, dados) {
    var porque = [];
    var todas = [];
    var pecas = dadosDosCards(dados).map(function (c) {
      var sub = PF().decidir(formato, marca, tendencias, c.d);
      if (sub.imagens) sub.imagens.itens.forEach(function (it) { it._forma = PF().formaImagem(sub, it, marca); todas.push(it); });
      return { id: c.id, nome: c.nome, tipo: 'imagem', largura: formato.largura, altura: formato.altura, exportar: formato.exportar || ['png', 'jpg'], destaque: c.id === 'capa', plano: sub, dados: c.d, uso: c.id === 'capa' ? 'Primeira imagem do carrossel' : '' };
    });
    var capa = pecas[0].plano;
    porque.push('Carrossel de ' + pecas.length + ' cards de ' + formato.largura + ' × ' + formato.altura + ' px, todos com o mesmo visual.');
    porque.push('A capa leva o título e a frase de apoio; cada card leva o título e o texto do item' + (limpar(dados.chamada) ? '; o último card fecha com a chamada.' : '.'));
    return {
      kit: true, variante: 'carrossel', varianteNome: 'CARROSSEL',
      pecas: pecas, publico: capa.publico, tema: capa.tema, campanha: capa.campanha,
      imagens: todas.length ? { quantidade: todas.length, itens: todas } : null,
      caracteres: limpar(dados.titulo).length,
      porque: porque.concat(capa.porque || []),
      chips: ['Carrossel', pecas.length + ' cards', formato.largura + ' × ' + formato.altura, dados.publico || 'Interno']
    };
  }

  function formaImagem(plano, it) { return it && it._forma ? it._forma : null; }

  function pecasHtml(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    return plano.pecas.map(function (p) {
      var o = Object.assign({}, opcoes, { codigo: (opcoes.codigo || '') + (opcoes.codigo ? '-' + p.id.toUpperCase() : '') });
      var aj = dados.ajustes || {};
      var dp = Object.assign({}, p.dados, { _aj: Object.assign({}, aj.todas || {}, (aj.porPeca || {})[p.id] || {}) });
      var html = PF().render(p.plano, dp, marca, o);
      return { id: p.id, nome: p.nome, uso: p.uso, tipo: 'imagem', largura: p.largura, altura: p.altura, exportar: p.exportar, destaque: p.destaque, html: html };
    });
  }

  /* Prévia: os cards em fileira, na ordem em que aparecem no carrossel. */
  function render(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var c = marca.cores, F = marca.tipografia.familia;
    var lista = pecasHtml(plano, dados, marca, opcoes);
    var LARG = 1200, PAD = 32, GAP = 20, COL = 3;
    var w = Math.floor((LARG - 2 * PAD - GAP * (COL - 1)) / COL);
    var cards = lista.map(function (p) {
      var s = w / p.largura, h = Math.round(p.altura * s);
      return '<figure style="margin:0;width:' + w + 'px;"><div style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;border-radius:12px 12px 0 12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,78,76,.08);">' +
        '<iframe scrolling="no" title="' + esc(p.nome) + '" style="border:0;display:block;width:' + p.largura + 'px;height:' + p.altura + 'px;transform:scale(' + s + ');transform-origin:0 0;" srcdoc="' + esc(p.html) + '"></iframe></div>' +
        '<figcaption style="margin:8px 0 0;font-size:13px;color:' + c.textoSuave + ';"><b style="color:' + c.verdeEscuro + ';">' + esc(p.nome) + '</b> · ' + p.largura + ' × ' + p.altura + ' px</figcaption></figure>';
    });
    var fontes = ((marca.tipografia && marca.tipografia.arquivos) || []).map(function (x) {
      return '@font-face{font-family:"' + x.familia + '";src:url(' + url(opcoes.baseUrl || '', x.arquivo) + ') format("woff2");font-weight:' + x.peso + ';font-style:' + (x.estilo || 'normal') + ';}';
    }).join('');
    return '<!doctype html>\n<!-- Carrossel ' + esc(opcoes.codigo || '') + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(limpar(dados.titulo)) + '</title>' +
      '<style>' + fontes + 'html,body{margin:0;padding:0;background:' + c.fundoPagina + ';}*{box-sizing:border-box;}</style></head>' +
      '<body><div data-x="mural" style="width:' + LARG + 'px;padding:' + PAD + 'px;font-family:' + F + ';">' +
      '<p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:' + c.institucional + ';">Carrossel · ' + lista.length + ' cards · na ordem de publicação</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:' + GAP + 'px;">' + cards.join('') + '</div></div></body></html>';
  }

  raiz.UnimedModelos = raiz.UnimedModelos || {};
  raiz.UnimedModelos.carrossel = { render: render, decidir: decidir, slots: slots, formaImagem: formaImagem, pecasHtml: pecasHtml };
})(window);
