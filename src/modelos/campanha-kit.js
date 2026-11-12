/* ============================================================
   Modelo · Kit de campanha (KV + desdobramentos)
   Uma campanha começa pelo KV (key visual) e se desdobra em peças
   que repetem o mesmo título, a mesma foto e as mesmas cores.
   A linha (externa ou interna) vem do Radar ("campanhas"):
   - externa: forte, fundo escuro, Tendências 2027 completas, Unimed + ANS;
   - interna: próxima, fundo claro, 2027 sutil, marca do Grupo.
   As peças de imagem usam o desenho das peças de tamanho fixo;
   o e-mail da campanha tem desenho próprio (HTML responsivo).
   A lista de peças de cada linha fica em config/formatos/campanha-kit.json.
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
      .replace(/^>>(\([a-z0-9-]+\))?\s*/gm, '')
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1$2');
  }
  function rico(t) {
    return esc(String(t || '').replace(/^>>(\([a-z0-9-]+\))?\s*/gm, ''))
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1').replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight:700;">$1</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1<em style="font-style:italic;">$2</em>');
  }
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function PF() { return raiz.UnimedModelos['peca-fixa']; }

  function linhaDe(dados) { return /intern/i.test((dados && dados.publico) || '') ? 'interna' : 'externa'; }
  function pecasDa(formato, linha) { return ((formato.kit || {})[linha] || []).slice(); }

  /* Formato de uma peça de imagem: o do kit, com medidas e margens da peça. */
  function formatoDaPeca(formato, p) {
    return Object.assign({}, formato, {
      id: formato.id + '-' + p.id, sigla: formato.sigla, largura: p.largura, altura: p.altura,
      margem: p.margem, margens: p.margens || null, quadro: p.largura
    });
  }

  /* Editor de enquadramento: usa o quadro do KV (as outras peças seguem o mesmo ponto focal). */
  function slots(formato, qtd, dados) {
    if (!qtd) return [];
    var kv = pecasDa(formato, linhaDe(dados)).filter(function (p) { return p.tipo !== 'email'; })[0];
    if (!kv) return [];
    return PF().slots(formatoDaPeca(formato, kv), qtd, dados);
  }

  /* ---------- Decisão ---------- */
  function decidir(formato, marca, tendencias, dados) {
    var linha = linhaDe(dados);
    var d = Object.assign({ tema: 'Institucional' }, dados);
    var porque = [];
    var cp = PF().linhaCampanha(marca, tendencias, d, porque);
    var logo = marca.logos[cp.marca] || marca.logos.interno;
    porque.push('Marca: ' + logo.nome + (cp.ans ? ' + registro ANS' : ', sem ANS') + '.');
    var ap = (dados.imagens || [])[0];
    var aprovada = ap && (marca.imagensAprovadas || []).filter(function (a) { return a.id === ap.id; })[0];
    var todas = [];
    var pecas = pecasDa(formato, linha).map(function (p) {
      var item = { id: p.id, nome: p.nome, uso: p.uso || '', tipo: p.tipo || 'imagem', largura: p.largura, altura: p.altura || null, exportar: p.exportar || ['png', 'jpg'], destaque: !!p.kv };
      if (item.tipo === 'email') {
        item.email = { foto: aprovada ? Object.assign({ arquivo: aprovada.arquivo, descricao: aprovada.descricao, w: 600, h: 320 }, ap) : null };
        if (item.email.foto) { item.email.foto._forma = { raio: [56, 0, 0, 0], fundo: cp.fundo }; todas.push(item.email.foto); }
        return item;
      }
      var f = formatoDaPeca(formato, p);
      var sub = PF().decidir(f, marca, tendencias, d);
      item.formato = f; item.plano = sub;
      if (sub.imagens) sub.imagens.itens.forEach(function (it) { it._forma = PF().formaImagem(sub, it, marca); todas.push(it); });
      return item;
    });
    porque.push('Kit da ' + cp.nome.toLowerCase() + ': ' + pecas.map(function (p) { return p.nome + (p.altura ? ' (' + p.largura + ' × ' + p.altura + ')' : ''); }).join(', ') + '.');
    porque.push(aprovada ? 'A mesma foto e o mesmo enquadramento em todas as peças.' : 'Sem foto: as peças ficam só com tipografia e cores da linha.');
    var dataInfo = null;
    if (dados.data) {
      var dt = String(dados.data).split('-');
      if (dt.length === 3) dataInfo = { dia: Number(dt[2]), mes: MESES[Number(dt[1]) - 1] || '', hora: limpar(dados.hora) };
    }
    return {
      kit: true, variante: 'kit-' + linha, varianteNome: 'KIT',
      linha: linha, campanha: cp, pecas: pecas, selo: cp.selo || '',
      publico: { nome: dados.publico, logo: logo, ans: cp.ans },
      imagens: todas.length ? { quantidade: 1, itens: todas } : null,
      caracteres: puro(limpar(dados.titulo)).length,
      data: dataInfo, botao: !!limpar(dados.chamada),
      porque: porque,
      chips: [cp.nome + ' ' + (cp.ciclo || ''), pecas.length + ' peças', 'KV ' + ((pecas[0] && pecas[0].altura) ? pecas[0].largura + ' × ' + pecas[0].altura : '')]
    };
  }

  function formaImagem(plano, it) { return it && it._forma ? it._forma : null; }

  function fontes(marca, base) {
    var a = (marca.tipografia && marca.tipografia.arquivos) || [];
    return a.map(function (x) {
      return '@font-face{font-family:"' + x.familia + '";src:url(' + url(base, x.arquivo) + ') format("woff2");font-weight:' + x.peso + ';font-style:' + (x.estilo || 'normal') + ';}';
    }).join('');
  }

  /* ---------- E-mail da campanha (HTML responsivo, 600 px) ---------- */
  function renderEmail(plano, item, dados, marca, opcoes) {
    var base = opcoes.baseUrl || '';
    var c = marca.cores, cp = plano.campanha, F = marca.tipografia.familia;
    var logo = plano.publico.logo;
    var logoSrc = cp.escuro ? (logo.escuro || logo.claro) : logo.claro;
    var logoW = Math.min(logo.larguraEmail || 160, 220);
    var titulo = esc(puro(limpar(dados.titulo)));
    var chapeu = esc(limpar(dados.cabecalho) || cp.nome);
    var P = cp.P || {};
    var corChapeu = cp.escuro ? (P.citrico || c.citrico) : (P.institucional || c.institucional);
    var corApoio = cp.escuro ? 'rgba(255,255,255,0.88)' : (P.petroleo || c.verdeEscuro);
    var mosaico = cp.elementos && marca.recursos2027 ? marca.recursos2027.mosaico : '';
    var foto = item.email.foto;
    var paragrafos = String(dados.texto || '').split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
    var corpo = paragrafos.map(function (b) {
      var linhas = b.split('\n');
      if (linhas.every(function (l) { return /^\s*-\s+/.test(l); })) {
        return '<ul style="margin:0 0 18px;padding-left:22px;">' + linhas.map(function (l) { return '<li style="margin:0 0 6px;font-size:16px;line-height:1.55;color:' + c.texto + ';">' + rico(l.replace(/^\s*-\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      return '<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:' + c.texto + ';">' + rico(linhas.join(' ')) + '</p>';
    }).join('');
    var data = plano.data ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="background:' + cp.destaque + ';border-radius:10px 10px 0 10px;padding:10px 16px;font-size:15px;font-weight:800;color:' + c.verdeEscuro + ';">' +
      plano.data.dia + ' de ' + esc(plano.data.mes) + (plano.data.hora ? ' · ' + esc(plano.data.hora.replace(':00', 'h').replace(':', 'h')) : '') + '</td></tr></table>' : '';
    var link = limpar(dados.linkEmail);
    var botao = limpar(dados.chamada) && link ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;"><tr><td style="background:' + c.laranja + ';border-radius:14px 14px 0 14px;">' +
      '<a href="' + esc(link) + '" style="display:inline-block;padding:15px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;font-family:' + F + ';">' + esc(limpar(dados.chamada)) + ' &rarr;</a></td></tr></table>' : '';
    var ans = cp.ans && marca.ans ? '<img src="' + esc(url(base, marca.ans.selo)) + '" alt="ANS - nº ' + esc(marca.ans.numero) + '" width="' + Math.round(22 * marca.ans.proporcao) + '" height="22" style="display:block;border:0;">' : '';
    var site = (marca.rodape && marca.rodape.site) || '';
    return '<!doctype html>\n<!-- Peça ' + esc(opcoes.codigo || '') + ' · ' + esc(item.nome) + ' · Gerador de Peças Unimed Uberlândia -->\n' +
      '<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-peca" content="' + esc(opcoes.codigo || '') + '"><title>' + titulo + '</title>' +
      '<style>' + fontes(marca, base) + 'html,body{margin:0;padding:0;}body{background:' + c.fundoPagina + ';}' +
      '@media (max-width:620px){.cx{width:100%!important;}.px{padding-left:24px!important;padding-right:24px!important;}.t1{font-size:30px!important;}.foto img{width:100%!important;height:auto!important;}}</style></head>' +
      '<body style="margin:0;padding:0;background:' + c.fundoPagina + ';font-family:' + F + ';">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + c.fundoPagina + ';"><tr><td align="center" style="padding:24px 0;">' +
      '<table role="presentation" class="cx" data-x="email" width="600" cellpadding="0" cellspacing="0" style="width:600px;background:#ffffff;font-family:' + F + ';">' +
      // Topo na cor da linha
      '<tr><td class="px" style="background:' + cp.fundo + ';padding:36px 40px ' + (foto ? '30' : '40') + 'px;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 34px;"><tr><td valign="middle"><img src="' + esc(url(base, logoSrc)) + '" alt="' + esc(logo.nome) + '" width="' + logoW + '" height="' + Math.round(logoW / logo.proporcao) + '" style="display:block;border:0;"></td>' +
        (mosaico ? '<td align="right" valign="middle"><img src="' + esc(url(base, mosaico)) + '" alt="" width="120" height="30" style="display:block;border:0;"></td>' : '') + '</tr></table>' +
        '<p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:' + corChapeu + ';">' + (plano.selo ? esc(plano.selo) + ' · ' : '') + chapeu + '</p>' +
        '<h1 class="t1" style="margin:0;font-size:42px;line-height:.95;font-weight:900;letter-spacing:-1.4px;' + (cp.caixaAlta ? 'text-transform:uppercase;' : '') + 'color:' + cp.texto + ';">' + raiz.UnimedKeyArt.tituloMisto(dados.titulo, cp, marca.tipografia.familiaSlab || 'Georgia, serif') + (cp.ponto ? '<span style="color:' + c.laranja + ';">&#9632;</span>' : '') + '</h1>' +
        (limpar(dados.subtitulo) ? '<p style="margin:16px 0 0;font-size:18px;line-height:1.4;color:' + corApoio + ';">' + rico(limpar(dados.subtitulo)) + '</p>' : '') +
      '</td></tr>' +
      (foto ? '<tr><td class="foto" style="background:' + cp.fundo + ';line-height:0;font-size:0;"><img data-x="img" src="' + esc(foto.src || url(base, foto.arquivo)) + '" alt="' + esc(foto.descricao) + '" width="600" height="320" style="display:block;width:600px;height:320px;border:0;object-fit:cover;"></td></tr>' : '') +
      // Corpo
      '<tr><td class="px" style="padding:36px 40px 30px;">' + data + corpo + botao + '</td></tr>' +
      // Fechamento: mote + site (+ ANS na externa)
      '<tr><td class="px" style="padding:0 40px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ' + c.borda + ';"><tr>' +
        '<td style="padding-top:20px;"><p style="margin:0;font-size:17px;font-weight:800;color:' + c.verdeEscuro + ';">' + esc(cp.mote) + '<span style="color:' + c.laranja + ';">&#9632;</span></p>' +
        '<p style="margin:4px 0 0;font-size:13px;color:' + c.textoSuave + ';">' + esc(site) + '</p></td>' +
        (ans ? '<td align="right" valign="bottom" style="padding-top:20px;">' + ans + '</td>' : '') +
      '</tr></table></td></tr>' +
      '</table></td></tr></table></body></html>';
  }

  /* HTML de cada peça do kit (para a prévia e para os downloads). */
  function pecasHtml(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var d = Object.assign({ tema: 'Institucional' }, dados);
    return plano.pecas.map(function (p) {
      var o = Object.assign({}, opcoes, { codigo: (opcoes.codigo || '') + (opcoes.codigo ? '-' + p.id.toUpperCase() : '') });
      var html;
      if (p.tipo === 'email') html = renderEmail(plano, p, d, marca, o);
      else html = PF().render(p.plano, d, marca, o);
      if (opcoes.leve) html = html.replace(/src="data:[^"]+"/g, 'src=""');
      return { id: p.id, nome: p.nome, uso: p.uso, tipo: p.tipo, largura: p.largura, altura: p.altura, exportar: p.exportar, destaque: p.destaque, html: html };
    });
  }

  /* ---------- Prévia: mural com o KV e os desdobramentos ---------- */
  function render(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var c = marca.cores, F = marca.tipografia.familia, cp = plano.campanha;
    var LARG = 1200, PAD = 32, IN = LARG - 2 * PAD;
    var lista = pecasHtml(plano, dados, marca, opcoes);
    function quadro(p, w) {
      var s = w / p.largura;
      var h = p.altura ? Math.round(p.altura * s) : 400;
      var raio = p.tipo === 'email' ? '' : 'border-radius:12px 12px 0 12px;';
      return '<figure style="margin:0;width:' + w + 'px;">' +
        '<div class="moldura" data-escala="' + s + '"' + (p.tipo === 'email' ? ' data-auto="1"' : '') + ' style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;' + raio + 'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,78,76,.08);">' +
        '<iframe scrolling="no" title="' + esc(p.nome) + '" style="border:0;display:block;width:' + p.largura + 'px;height:' + (p.altura || 2000) + 'px;transform:scale(' + s + ');transform-origin:0 0;" srcdoc="' + esc(p.html) + '"></iframe></div>' +
        '<figcaption style="margin:10px 0 0;font-size:13px;line-height:1.35;color:' + c.textoSuave + ';"><b style="color:' + c.verdeEscuro + ';font-size:14px;">' + esc(p.nome) + '</b> · ' + (p.altura ? p.largura + ' × ' + p.altura + ' px' : p.largura + ' px de largura') + (p.uso ? '<br>' + esc(p.uso) : '') + '</figcaption></figure>';
    }
    var kv = lista.filter(function (p) { return p.destaque; })[0] || lista[0];
    var resto = lista.filter(function (p) { return p !== kv; });
    var verticais = resto.filter(function (p) { return p.tipo !== 'email' && p.altura && p.largura / p.altura < 1.6; });
    var largos = resto.filter(function (p) { return p.tipo !== 'email' && p.altura && p.largura / p.altura >= 1.6; });
    var emails = resto.filter(function (p) { return p.tipo === 'email'; });
    var h = [];
    h.push('<header style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:0 0 20px;">' +
      '<div><p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:' + c.institucional + ';">' + esc(cp.nome) + ' · ciclo ' + esc(cp.ciclo || '') + '</p>' +
      '<p style="margin:0;font-size:24px;font-weight:800;color:' + c.verdeEscuro + ';">' + esc(puro(limpar(dados.cabecalho)) || 'KV e desdobramentos') + '</p></div>' +
      '<p style="margin:0;font-size:13px;color:' + c.textoSuave + ';text-align:right;max-width:420px;">' + esc(cp.tom) + '</p></header>');
    h.push('<section style="margin:0 0 28px;"><p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + c.textoSuave + ';">KV principal</p>' + quadro(kv, IN) + '</section>');
    if (verticais.length || emails.length) {
      h.push('<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + c.textoSuave + ';">Desdobramentos</p>');
      // Redes sociais (na mesma altura) e o e-mail ao lado.
      var alturaLinha = 560, gap = 24;
      var ws = verticais.map(function (p) { return Math.round(alturaLinha * p.largura / p.altura); });
      var soma = ws.reduce(function (a, b) { return a + b; }, 0) + gap * Math.max(0, verticais.length - 1);
      var sobra = IN - soma - (emails.length ? gap : 0);
      var wEmail = emails.length ? Math.max(360, Math.min(600, sobra)) : 0;
      if (emails.length && soma + gap + wEmail > IN) { var k = (IN - gap - wEmail - gap * Math.max(0, verticais.length - 1)) / (soma - gap * Math.max(0, verticais.length - 1)); ws = ws.map(function (w) { return Math.round(w * k); }); }
      h.push('<section style="display:flex;gap:' + gap + 'px;align-items:flex-start;margin:0 0 28px;">' +
        verticais.map(function (p, i) { return quadro(p, ws[i]); }).join('') +
        emails.map(function (p) { return quadro(p, wEmail); }).join('') + '</section>');
    }
    largos.forEach(function (p) { h.push('<section style="margin:0 0 28px;">' + quadro(p, IN) + '</section>'); });
    return '<!doctype html>\n<!-- Kit de campanha ' + esc(opcoes.codigo || '') + ' · Gerador de Peças Unimed Uberlândia -->\n<html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(puro(dados.titulo)) + '</title>' +
      '<style>' + fontes(marca, opcoes.baseUrl || '') + 'html,body{margin:0;padding:0;background:' + c.fundoPagina + ';}*{box-sizing:border-box;}</style></head>' +
      '<body><div data-x="mural" style="width:' + LARG + 'px;padding:' + PAD + 'px;font-family:' + F + ';">' + h.join('') + '</div>' +
      /* O e-mail tem altura variável: depois de montar, a moldura acompanha o conteúdo. */
      '<script>(function(){function medir(){var mudou=false;Array.prototype.forEach.call(document.querySelectorAll(".moldura[data-auto]"),function(m){var f=m.querySelector("iframe"),d;try{d=f.contentDocument;}catch(e){return;}if(!d||!d.body)return;var s=parseFloat(m.getAttribute("data-escala"))||1;var alto=d.body.scrollHeight;if(!alto)return;f.style.height=alto+"px";var nh=Math.ceil(alto*s)+"px";if(m.style.height!==nh){m.style.height=nh;mudou=true;}});if(mudou&&parent!==window)parent.postMessage({tipo:"unimed-paginado"},"*");}' +
      'Array.prototype.forEach.call(document.querySelectorAll("iframe"),function(f){f.addEventListener("load",function(){setTimeout(medir,80);setTimeout(medir,700);});});setTimeout(medir,300);setTimeout(medir,1500);})();<\/script>' +
      '</body></html>';
  }

  raiz.UnimedModelos = raiz.UnimedModelos || {};
  raiz.UnimedModelos['campanha-kit'] = { render: render, decidir: decidir, slots: slots, formaImagem: formaImagem, pecasHtml: pecasHtml };
})(window);
