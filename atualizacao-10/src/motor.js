/* ============================================================
   Motor de regras · Unimed Uberlândia
   Sem IA: valida o que a pessoa preencheu, aplica a árvore de
   decisão do formato e devolve um "plano" que o modelo desenha.
   Funciona no navegador (window.UnimedMotor) e no Node (testes).
   ============================================================ */
(function (raiz) {
  'use strict';

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var NOMES_VARIANTE = { curto: 'CURTO', medio: 'MÉDIO', longo: 'LONGO' };
  var SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  function limpar(v) {
    return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  }

  /* Tira as marcas de formatação (**negrito**, *itálico*, ==(cor)realce==) para contar e decidir. */
  var MARCA_BOX = /^>>(?:\(([a-z0-9-]+)\))?\s*/i;
  function semMarcas(texto) {
    return String(texto == null ? '' : texto)
      .replace(/(^|\n)[ \t]*>>(?:\([a-z0-9-]+\))?[ \t]*/gi, '$1')
      .replace(/==\([a-z0-9-]+\)([\s\S]+?)==/gi, '$1')
      .replace(/==([\s\S]+?)==/g, '$1')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1$2');
  }

  function contar(texto) {
    return semMarcas(limpar(texto)).replace(/\s+/g, ' ').length;
  }

  /* Ativa = status "ativa" no Radar de Tendências. */
  function tendenciasAtivas(tendencias) {
    var ativas = {};
    ((tendencias && tendencias.tendencias) || []).forEach(function (t) {
      if (t.status === 'ativa') ativas[t.id] = true;
    });
    return ativas;
  }

  var MARCA_LISTA = /^\s*(?:[-•*–]|\d+[.)])\s+/;

  /* Quebra o texto em blocos: parágrafo, intertítulo (linha curta sem ponto final) e lista (linhas com "- "). */
  function dividirTexto(texto, maxIntertitulo, permitirIntertitulo) {
    var blocos = [];
    var partes = limpar(texto).split(/\n\s*\n/).filter(function (p) { return p.trim(); });
    partes.forEach(function (parte) {
      var linhas = parte.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      // Parágrafo inteiro em destaque: começa com >>(cor). Vira um box.
      var mb = linhas.length && MARCA_BOX.exec(linhas[0]);
      if (mb) {
        linhas[0] = linhas[0].replace(MARCA_BOX, '');
        var txt = linhas.join(' ').trim();
        if (txt) blocos.push({ tipo: 'box', cor: mb[1] || null, texto: txt });
        return;
      }
      var prosa = [];
      var itens = [];
      function fecharProsa() { if (prosa.length) { blocos.push({ tipo: 'paragrafo', texto: prosa.join(' ') }); prosa = []; } }
      function fecharLista() { if (itens.length) { blocos.push({ tipo: 'lista', itens: itens }); itens = []; } }
      linhas.forEach(function (l) {
        if (MARCA_LISTA.test(l)) { fecharProsa(); itens.push(l.replace(MARCA_LISTA, '')); }
        else { fecharLista(); prosa.push(l); }
      });
      fecharProsa(); fecharLista();
    });
    return blocos.map(function (b, i) {
      if (b.tipo !== 'paragrafo') return b;
      var puro = semMarcas(b.texto);
      var curta = puro.length <= maxIntertitulo && !/[.!?:;,…]$/.test(puro);
      var temSeguinte = i < blocos.length - 1;
      if (permitirIntertitulo && curta && temSeguinte) return { tipo: 'intertitulo', texto: b.texto };
      return b;
    });
  }

  /* Regras de linguagem do Manual (MS.138): só avisam, não bloqueiam. */
  function revisarLinguagem(dados, ling) {
    var avisos = [];
    if (!ling) return avisos;
    var titulo = semMarcas(limpar(dados.titulo));
    var letras = titulo.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letras.length >= 4 && letras === letras.toUpperCase()) {
      avisos.push({ campo: 'titulo', msg: 'Título todo em maiúsculas. O manual pede maiúsculas e minúsculas, que leem melhor.' });
    }
    var tudo = semMarcas([titulo, limpar(dados.subtitulo), limpar(dados.texto), limpar(dados.ctaTexto)].join('\n'));
    var exclam = (tudo.match(/!/g) || []).length;
    if (ling.maxExclamacoes != null && exclam > ling.maxExclamacoes) {
      avisos.push({ campo: 'texto', msg: 'São ' + exclam + ' pontos de exclamação. Use no máximo ' + ling.maxExclamacoes + '; o tom é próximo, sem exagero.' });
    }
    var frases = semMarcas(limpar(dados.texto)).replace(/\n+/g, ' ').split(/(?<=[.!?…])\s+/);
    var longas = frases.filter(function (f) { return f.split(/\s+/).filter(Boolean).length > ling.frasesLongasPalavras; }).length;
    if (longas) avisos.push({ campo: 'texto', msg: longas + (longas > 1 ? ' frases têm' : ' frase tem') + ' mais de ' + ling.frasesLongasPalavras + ' palavras. Frases curtas, em ordem direta, ficam mais claras.' });

    var achados = [];
    Object.keys(ling.estrangeirismos || {}).forEach(function (termo) {
      var re = new RegExp('(^|[^A-Za-zÀ-ÿ])' + termo.replace(/[-]/g, '[- ]?') + '(?=$|[^A-Za-zÀ-ÿ])', 'i');
      if (re.test(tudo)) achados.push('"' + termo + '"' + (ling.estrangeirismos[termo] ? ' → ' + ling.estrangeirismos[termo] : ''));
    });
    if (achados.length) avisos.push({ campo: 'texto', msg: 'Evite estrangeirismos: ' + achados.join(', ') + '.' });

    var cta = limpar(dados.ctaTexto).toLowerCase();
    if (/^(clique aqui|clique|saiba mais|acesse|aqui|link)$/.test(cta)) {
      avisos.push({ campo: 'ctaTexto', msg: 'Botão genérico. Diga a ação: "Faça sua inscrição", "Confira a agenda", "Veja os horários".' });
    }
    return avisos;
  }

  function lerData(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpar(iso));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() !== Number(m[2]) - 1) return null;
    return {
      dia: String(d.getDate()).padStart(2, '0'),
      mes: MESES[d.getMonth()],
      mesLongo: MESES_LONGOS[d.getMonth()],
      ano: d.getFullYear(),
      semana: SEMANA[d.getDay()]
    };
  }

  function linkValido(link, exigeHttps) {
    var l = limpar(link);
    if (!l) return false;
    if (exigeHttps) return /^https:\/\/[^\s]+\.[^\s]+/i.test(l);
    return /^https?:\/\/[^\s]+\.[^\s]+/i.test(l) || /^mailto:[^\s@]+@[^\s@]+$/i.test(l);
  }

  /* ---------- 1. Validação: erros bloqueiam, avisos só alertam ---------- */
  function validar(formato, dados) {
    var erros = [];
    var avisos = [];
    (formato.campos || []).forEach(function (c) {
      if (c.tipo === 'imagens-aprovadas') return;
      var v = limpar(dados[c.id]);
      if (c.obrigatorio && !v) erros.push({ campo: c.id, msg: 'Preencha o campo "' + c.rotulo + '".' });
      if (v && c.max && contar(v) > c.max) erros.push({ campo: c.id, msg: '"' + c.rotulo + '" tem ' + contar(v) + ' caracteres; o máximo é ' + c.max + '.' });
      if (c.tipo === 'escolha' && v && c.opcoes.indexOf(v) < 0) erros.push({ campo: c.id, msg: 'Escolha uma opção válida em "' + c.rotulo + '".' });
    });

    var val = formato.validacoes || {};
    var titulo = limpar(dados.titulo);
    if (titulo && val.tituloAvisoAcima && contar(titulo) > val.tituloAvisoAcima) {
      avisos.push({ campo: 'titulo', msg: 'Título longo: ele vai sair com fonte menor. Até ' + val.tituloAvisoAcima + ' caracteres fica no tamanho cheio.' });
    }

    var temCtaTexto = !!limpar(dados.ctaTexto);
    var temCtaLink = !!limpar(dados.ctaLink);
    if (temCtaTexto && !temCtaLink) erros.push({ campo: 'ctaLink', msg: 'O botão precisa de um link.' });
    if (!temCtaTexto && temCtaLink) erros.push({ campo: 'ctaTexto', msg: 'Dê um texto para o botão (ex.: "Saiba mais").' });
    if (temCtaLink && !linkValido(dados.ctaLink, val.linkPrecisaHttps)) {
      erros.push({ campo: 'ctaLink', msg: val.linkPrecisaHttps ? 'O link precisa começar com https://' : 'Link inválido.' });
    }

    if (limpar(dados.data) && !lerData(dados.data)) erros.push({ campo: 'data', msg: 'Data inválida.' });
    if ((limpar(dados.hora) || limpar(dados.local)) && !limpar(dados.data)) {
      avisos.push({ campo: 'data', msg: 'Horário e local só aparecem quando há uma data.' });
    }

    var ling = formato.revisarLinguagem === false ? null : dados._linguagem;
    if (ling && ling.maxItensLista) {
      dividirTexto(dados.texto, 0, false).forEach(function (b) {
        if (b.tipo === 'lista' && b.itens.length > ling.maxItensLista) avisos.push({ campo: 'texto', msg: 'Uma lista tem ' + b.itens.length + ' itens. Até ' + ling.maxItensLista + ' o texto não fica cansativo; separe ou resuma.' });
      });
    }
    avisos = avisos.concat(revisarLinguagem(dados, ling));

    var paragrafos = limpar(dados.texto).split(/\n\s*\n/).filter(function (p) { return p.trim(); }).length;
    if (val.maxParagrafos && paragrafos > val.maxParagrafos) {
      erros.push({ campo: 'texto', msg: 'São ' + paragrafos + ' parágrafos; o máximo é ' + val.maxParagrafos + '. Para conteúdo assim, considere uma página ou cartilha.' });
    }

    var imgs = Array.isArray(dados.imagens) ? dados.imagens : [];
    var maxImg = (formato.arvore && formato.arvore.imagem && formato.arvore.imagem.maximo) || 3;
    if (imgs.length > maxImg) erros.push({ campo: 'imagens', msg: 'Use no máximo ' + maxImg + ' imagens.' });
    imgs.forEach(function (im) {
      var ok = (dados._imagensAprovadas || []).some(function (i) { return i.id === im.id; });
      if (!ok) erros.push({ campo: 'imagens', msg: 'Use só imagens da biblioteca aprovada.' });
    });

    // Newsletter: notícias (título obrigatório; link precisa de texto e começa com https).
    (formato.campos || []).forEach(function (c) {
      if (c.tipo !== 'noticias') return;
      var lista = (Array.isArray(dados[c.id]) ? dados[c.id] : []).filter(function (n) { return limpar(n.titulo) || limpar(n.texto) || limpar(n.link); });
      if (c.obrigatorio && !lista.length) erros.push({ campo: c.id, msg: 'Inclua pelo menos uma notícia.' });
      lista.forEach(function (n, i) {
        var q = 'Notícia ' + (i + 1);
        if (!limpar(n.titulo)) erros.push({ campo: c.id, msg: q + ': falta o título.' });
        if (limpar(n.link) && !linkValido(n.link, val.linkPrecisaHttps)) erros.push({ campo: c.id, msg: q + ': o link precisa começar com https://' });
        if (c.maxTexto && contar(n.texto) > c.maxTexto) erros.push({ campo: c.id, msg: q + ': o texto tem ' + contar(n.texto) + ' caracteres; o máximo é ' + c.maxTexto + '.' });
      });
    });

    if (dados.ordem && formato.blocos) {
      var validos = formato.blocos.padrao.slice().sort().join(',');
      if (dados.ordem.slice().sort().join(',') !== validos) erros.push({ campo: 'ordem', msg: 'Ordem dos blocos inválida.' });
    }

    return { erros: erros, avisos: avisos, ok: erros.length === 0 };
  }

  /* ---------- 2. Árvore de decisão ---------- */
  function decidir(formato, marca, tendencias, dados) {
    var arv = formato.arvore;
    var caracteres = contar(dados.texto);
    var variante = caracteres <= arv.variante.curto.ate ? 'curto' : caracteres <= arv.variante.medio.ate ? 'medio' : 'longo';

    var tamTitulo = contar(dados.titulo);
    var degraus = arv.titulo.degraus;
    var degrau = degraus[degraus.length - 1];
    for (var i = 0; i < degraus.length; i++) { if (tamTitulo <= degraus[i].ate) { degrau = degraus[i]; break; } }

    var tema = formato.temas[dados.tema] || formato.temas.Institucional;
    var cores = marca.cores;
    var publicoNome = (formato.publicos && formato.publicos[dados.publico]) ? dados.publico : 'Interno';
    var publico = (formato.publicos && formato.publicos[publicoNome]) || { logo: 'externo', assinatura: 'Unimed Uberlândia', ans: false };
    var excecao = publico.porTema && publico.porTema[dados.tema];
    if (excecao) publico = Object.assign({}, publico, excecao);
    var logo = marca.logos[publico.logo];
    var cabecalho = limpar(dados.cabecalho) || limpar(dados.area) || publico.assinatura;

    var ativas = tendenciasAtivas(tendencias);
    var data = lerData(dados.data);
    var temBotao = !!(limpar(dados.ctaTexto) && limpar(dados.ctaLink));
    var escolhidas = Array.isArray(dados.imagens) ? dados.imagens.slice(0, arv.imagem.maximo || 3) : [];
    var imagens = null;
    if (arv.imagem[variante] && escolhidas.length) {
      var slots = arv.imagem.layouts[String(escolhidas.length)];
      imagens = {
        quantidade: escolhidas.length,
        respiro: arv.imagem.respiro || 8,
        itens: escolhidas.map(function (e, i) {
          var ap = (marca.imagensAprovadas || []).filter(function (a) { return a.id === e.id; })[0];
          return ap ? { id: ap.id, arquivo: ap.arquivo, descricao: ap.descricao, w: slots[i].w, h: slots[i].h, x: e.x == null ? 0.5 : e.x, y: e.y == null ? 0.5 : e.y, zoom: e.zoom || 1, src: e.src || null } : null;
        }).filter(Boolean)
      };
      if (!imagens.itens.length) imagens = null;
    }

    var padraoOrdem = (formato.blocos && formato.blocos.padrao) || ['imagens', 'titulo', 'data', 'texto', 'botao'];
    var ordem = (Array.isArray(dados.ordem) && dados.ordem.slice().sort().join(',') === padraoOrdem.slice().sort().join(',')) ? dados.ordem.slice() : padraoOrdem.slice();

    var blocos = dividirTexto(dados.texto, arv.intertitulo.maxCaracteres, variante !== 'curto');

    // Newsletter: notícias com imagem recortada no tamanho do destaque (1ª) ou da lista (demais).
    var noticias = null;
    if (Array.isArray(dados.noticias)) {
      var tamN = arv.noticias || { destaque: { w: 536, h: 268 }, demais: { w: 176, h: 132 } };
      noticias = dados.noticias.filter(function (n) { return limpar(n.titulo); }).slice(0, (arv.noticias && arv.noticias.maximo) || 4).map(function (n, i) {
        var ap = n.imagem && (marca.imagensAprovadas || []).filter(function (a) { return a.id === n.imagem; })[0];
        var t = i === 0 ? tamN.destaque : tamN.demais;
        return {
          titulo: limpar(n.titulo), texto: limpar(n.texto), link: limpar(n.link), linkTexto: limpar(n.linkTexto) || 'Leia mais',
          imagem: ap ? { id: ap.id, arquivo: ap.arquivo, descricao: ap.descricao, w: t.w, h: t.h, x: n.x == null ? 0.5 : n.x, y: n.y == null ? 0.5 : n.y, zoom: n.zoom || 1 } : null
        };
      });
    }

    // Nome da área em dois tons (linguagem 2027): última palavra em destaque.
    var palavras = cabecalho.split(/\s+/);
    var areaPartes = palavras.length > 1
      ? { inicio: palavras.slice(0, -1).join(' '), fim: palavras[palavras.length - 1] }
      : { inicio: '', fim: cabecalho };
    var ic = marca.icones || {};
    var nomeIcone = (ic.porArea && ic.porArea[limpar(dados.cabecalho) ? '' : limpar(dados.area)]) || ic.padrao || '';
    var icone = nomeIcone ? (ic.pasta || 'assets/icones/') + nomeIcone + '.png' : null;
    var corBotao = (formato.botao && cores[formato.botao.cor]) || cores.laranja;
    var textoBotao = (formato.botao && cores[formato.botao.texto]) || '#ffffff';

    return {
      formato: formato.id,
      variante: variante,
      varianteNome: NOMES_VARIANTE[variante],
      caracteres: caracteres,
      tituloPx: degrau[variante],
      intertituloPx: Math.max(17, Math.round(degrau[variante] * 0.6)),
      publico: { nome: publicoNome, assinatura: publico.assinatura, ans: !!publico.ans, logo: logo },
      layout: publico.layout || 'externo',
      selo: publico.selo || '',
      cabecalho: cabecalho,
      areaPartes: areaPartes,
      icone: icone,
      tema: {
        nome: dados.tema, rotulo: tema.rotulo,
        faixa: cores[tema.faixa], textoFaixa: cores[tema.textoFaixa] || '#ffffff',
        fundoInterno: cores[tema.fundoInterno] || cores.apoioAreia,
        destaque: cores[tema.destaque], textoDestaque: cores[tema.textoDestaque] || '#ffffff'
      },
      imagens: imagens,
      noticias: noticias,
      ordem: ordem,
      realces: formato.formatacao ? formato.formatacao.realces : [],
      data: data ? { info: data, hora: limpar(dados.hora), local: limpar(dados.local), grande: variante === 'curto' } : null,
      botao: temBotao ? { texto: limpar(dados.ctaTexto), link: limpar(dados.ctaLink), cor: corBotao, corTexto: textoBotao, repetir: variante === 'longo' && arv.botao.repetirNoLongo && blocos.length > 2, ultimo: ordem[ordem.length - 1] === 'botao' } : null,
      blocos: blocos,
      flags: {
        quadradoLaranja: !!ativas['quadrado-laranja'],
        provaDeProcesso: !!ativas['prova-de-processo'],
        molduraBox: !!ativas['moldura-box'],
        // O manual pede títulos em caixa alta e baixa: a tendência "título contraste" não muda o e-mail.
        tituloContraste: false
      },
      // Explica a decisão em linguagem simples (aparece na tela).
      porque: [
        'Público ' + publicoNome.toLowerCase() + ' → marca ' + logo.nome + (publico.ans ? ' + registro ANS' : '') + (excecao && excecao.motivo ? ': ' + excecao.motivo : '') + '.',
        'Cabeçalho: ' + cabecalho + (limpar(dados.cabecalho) ? '.' : ' (sua área).') + ((publico.layout === 'interno-2027') ? ' Visual interno 2027 com ícone da área.' : ''),
        'Texto com ' + caracteres + ' caracteres → modelo ' + NOMES_VARIANTE[variante] + '.',
        'Título com ' + tamTitulo + ' caracteres → fonte ' + degrau[variante] + ' px.',
        data ? 'Tem data → bloco de data em destaque.' : 'Sem data.',
        temBotao ? ('Tem botão → CTA laranja' + (variante === 'longo' && arv.botao.repetirNoLongo && blocos.length > 2 ? ', repetido no fim com a data.' : '.')) : 'Sem botão.',
        imagens ? (imagens.quantidade === 1 ? '1 imagem → horizontal 536 × 300.' : imagens.quantidade === 2 ? '2 imagens → lado a lado.' : '3 imagens → mosaico (uma grande e duas menores).') : (escolhidas.length && !arv.imagem[variante] ? 'No modelo curto a imagem não entra.' : 'Sem imagem.'),
        ordem.join(',') === padraoOrdem.join(',') ? 'Blocos na ordem padrão.' : 'Ordem dos blocos personalizada.'
      ].concat(noticias ? [noticias.length + (noticias.length === 1 ? ' notícia' : ' notícias') + ' → a primeira em destaque com foto grande, as outras em lista com foto pequena.'] : [])
    };
  }

  /* ---------- 3. Código único da peça ---------- */
  function gerarCodigo(sigla, agora) {
    var d = agora || new Date();
    var ano = d.getFullYear();
    var base = (d.getTime() % 1e8).toString(36).toUpperCase();
    var sorte = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
    return 'UNI-' + sigla + '-' + ano + '-' + base + sorte;
  }

  var api = { limpar: limpar, semMarcas: semMarcas, contar: contar, dividirTexto: dividirTexto, revisarLinguagem: revisarLinguagem, lerData: lerData, validar: validar, decidir: decidir, gerarCodigo: gerarCodigo, tendenciasAtivas: tendenciasAtivas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.UnimedMotor = api;
})(typeof window !== 'undefined' ? window : this);
