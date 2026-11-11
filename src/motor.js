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

  /* Quebra o texto em parágrafos; linhas curtas sem ponto final viram intertítulo. */
  function dividirTexto(texto, maxIntertitulo, permitirIntertitulo) {
    var partes = limpar(texto).split(/\n\s*\n/).map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean);
    return partes.map(function (p, i) {
      var curta = p.length <= maxIntertitulo && !/[.!?:;,…]$/.test(p);
      var temSeguinte = i < partes.length - 1;
      if (permitirIntertitulo && curta && temSeguinte) return { tipo: 'intertitulo', texto: p };
      return { tipo: 'paragrafo', texto: p };
    });
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
    var corFaixa = cores[tema.faixa];
    var corDestaque = cores[tema.destaque];

    var ativas = tendenciasAtivas(tendencias);
    var data = lerData(dados.data);
    var temBotao = !!(limpar(dados.ctaTexto) && limpar(dados.ctaLink));
    var imagem = null;
    if (arv.imagem[variante] && limpar(dados.imagem)) {
      imagem = (marca.imagensAprovadas || []).filter(function (i) { return i.id === dados.imagem; })[0] || null;
    }

    var blocos = dividirTexto(dados.texto, arv.intertitulo.maxCaracteres, variante === 'longo');

    return {
      formato: formato.id,
      variante: variante,
      varianteNome: NOMES_VARIANTE[variante],
      caracteres: caracteres,
      tituloPx: degrau[variante],
      tema: { nome: dados.tema, rotulo: tema.rotulo, faixa: corFaixa, destaque: corDestaque },
      faixaClara: tema.faixa === 'citrico',
      imagem: imagem,
      data: data ? { info: data, hora: limpar(dados.hora), local: limpar(dados.local), grande: variante === 'curto' } : null,
      botao: temBotao ? { texto: limpar(dados.ctaTexto), link: limpar(dados.ctaLink), repetir: variante === 'longo' && arv.botao.repetirNoLongo && blocos.length > 2 } : null,
      blocos: blocos,
      flags: {
        quadradoLaranja: !!ativas['quadrado-laranja'],
        provaDeProcesso: !!ativas['prova-de-processo'],
        molduraBox: !!ativas['moldura-box'],
        tituloContraste: !!ativas['titulo-contraste']
      },
      // Explica a decisão em linguagem simples (aparece no painel e na tela).
      porque: [
        'Texto com ' + caracteres + ' caracteres → modelo ' + NOMES_VARIANTE[variante] + '.',
        'Título com ' + tamTitulo + ' caracteres → fonte ' + degrau[variante] + ' px.',
        data ? 'Tem data → bloco padrão de data.' : 'Sem data.',
        temBotao ? 'Tem botão → CTA padrão.' : 'Sem botão.',
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

  var api = { limpar: limpar, contar: contar, dividirTexto: dividirTexto, lerData: lerData, validar: validar, decidir: decidir, gerarCodigo: gerarCodigo, tendenciasAtivas: tendenciasAtivas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.UnimedMotor = api;
})(typeof window !== 'undefined' ? window : this);
