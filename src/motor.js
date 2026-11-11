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

  function contar(texto) {
    return limpar(texto).replace(/\s+/g, ' ').length;
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
      var curta = b.texto.length <= maxIntertitulo && !/[.!?:;,…]$/.test(b.texto);
      var temSeguinte = i < blocos.length - 1;
      if (permitirIntertitulo && curta && temSeguinte) return { tipo: 'intertitulo', texto: b.texto };
      return b;
    });
  }

  /* Regras de linguagem do Manual (MS.138): só avisam, não bloqueiam. */
  function revisarLinguagem(dados, ling) {
    var avisos = [];
    if (!ling) return avisos;
    var titulo = limpar(dados.titulo);
    var letras = titulo.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letras.length >= 4 && letras === letras.toUpperCase()) {
      avisos.push({ campo: 'titulo', msg: 'Título todo em maiúsculas. O manual pede maiúsculas e minúsculas, que leem melhor.' });
    }
    var tudo = [titulo, limpar(dados.subtitulo), limpar(dados.texto), limpar(dados.ctaTexto)].join('\n');
    var exclam = (tudo.match(/!/g) || []).length;
    if (ling.maxExclamacoes != null && exclam > ling.maxExclamacoes) {
      avisos.push({ campo: 'texto', msg: 'São ' + exclam + ' pontos de exclamação. Use no máximo ' + ling.maxExclamacoes + '; o tom é próximo, sem exagero.' });
    }
    var frases = limpar(dados.texto).replace(/\n+/g, ' ').split(/(?<=[.!?…])\s+/);
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

    var ling = dados._linguagem;
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

    if (limpar(dados.imagem)) {
      var ok = (dados._imagensAprovadas || []).some(function (i) { return i.id === dados.imagem; });
      if (!ok) erros.push({ campo: 'imagem', msg: 'Use uma imagem da biblioteca aprovada.' });
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
    var imagem = null;
    if (arv.imagem[variante] && limpar(dados.imagem)) {
      imagem = (marca.imagensAprovadas || []).filter(function (i) { return i.id === dados.imagem; })[0] || null;
    }

    var blocos = dividirTexto(dados.texto, arv.intertitulo.maxCaracteres, variante !== 'curto');

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
      imagem: imagem,
      data: data ? { info: data, hora: limpar(dados.hora), local: limpar(dados.local), grande: variante === 'curto' } : null,
      botao: temBotao ? { texto: limpar(dados.ctaTexto), link: limpar(dados.ctaLink), cor: corBotao, corTexto: textoBotao, repetir: variante === 'longo' && arv.botao.repetirNoLongo && blocos.length > 2 } : null,
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
        imagem ? 'Imagem aprovada incluída.' : (limpar(dados.imagem) && !arv.imagem[variante] ? 'No modelo curto a imagem não entra.' : 'Sem imagem.')
      ]
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

  var api = { limpar: limpar, contar: contar, dividirTexto: dividirTexto, revisarLinguagem: revisarLinguagem, lerData: lerData, validar: validar, decidir: decidir, gerarCodigo: gerarCodigo, tendenciasAtivas: tendenciasAtivas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.UnimedMotor = api;
})(typeof window !== 'undefined' ? window : this);
