/* ============================================================
   Gerador de peças · tela de uso
   Lê as regras (config/), monta o formulário do formato em seções,
   mostra a prévia ao vivo, guarda rascunho e registra cada peça.
   Tudo o que muda de um formato para outro vem do arquivo de regras
   (campos, seções, blocos); a tela é a mesma para todos.
   ============================================================ */
(function () {
  'use strict';
  var M = window.UnimedMotor;
  var R = window.UnimedRegistro;
  var Rc = window.UnimedRecorte;
  var A = window.UnimedAprovacao;
  var $ = function (id) { return document.getElementById(id); };

  var estado = {
    marca: null, tendencias: null, sistema: null, indice: null, formato: null,
    ultimoHtml: '', ultimoCodigo: '', ultimoTitulo: '', imagens: [], ordem: null,
    edicao: null,          // { base, versao } depois da primeira geração
    editando: false,       // true quando "Editar esta peça" foi usado
    pendente: null,        // registro que não chegou ao banco
    pedidoLink: null,      // peça aberta pelo link de acompanhamento { codigo, t, status, ajuste, p }
    ajusteToken: '',       // Marketing ajustando: passe da sessão do painel (a versão sai aprovada)
    ultimoStatus: '', ultimoT: '',
    redesenharImagens: null, desenharOrdem: null, marcarVazios: null
  };
  var LARGOS = { versoTitulo: 1, versoTexto: 1, versoContato: 1, publico: 1, cabecalho: 1, tema: 1, titulo: 1, subtitulo: 1, texto: 1, imagens: 1, local: 1, ordem: 1 };
  var CHAVE_QUEM = 'unimed-gerador-quem';
  var CHAVE_RASCUNHO = 'unimed-gerador-rascunho-';

  /* Modo teste (index.html?teste=1): usa as regras propostas pelo assistente, guardadas só neste navegador. */
  var MODO_TESTE = /[?&]teste=1/.test(location.search);
  function regrasTeste() { try { return JSON.parse(localStorage.getItem('unimed-teste-config') || '{}'); } catch (e) { return {}; } }
  async function json(caminho) {
    if (MODO_TESTE) { var t = regrasTeste(); if (t[caminho]) return JSON.parse(JSON.stringify(t[caminho])); }
    var r = await fetch(caminho, { cache: 'no-store' });
    if (!r.ok) throw new Error('Não encontrei ' + caminho);
    return r.json();
  }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }

  function ler(chave) { try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; } }
  function gravar(chave, valor) { try { if (valor == null) localStorage.removeItem(chave); else localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento */ } }

  /* Mensagem de erro em linguagem simples. */
  function explicar(e) {
    var m = (e && e.message) || '';
    if (/failed to fetch|networkerror|load failed|network/i.test(m)) return 'sem conexão com o banco de registros';
    return m || 'erro desconhecido';
  }

  /* ---------- Busca de formato (combobox) ---------- */
  var ativoIdx = -1;
  function normal(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function filtrar(q) {
    var t = normal(q.trim());
    return estado.indice.formatos.filter(function (f) { return !t || normal(f.nome + ' ' + f.palavras + ' ' + f.grupo).indexOf(t) >= 0; });
  }
  function mostrarLista() {
    var lista = $('formato-lista');
    var itens = filtrar($('formato-busca').value);
    lista.textContent = '';
    itens.forEach(function (f, i) {
      var li = el('li', { role: 'option', id: 'opt-' + f.id, 'aria-selected': String(i === ativoIdx), 'aria-disabled': String(!f.ativo) }, [
        el('span', { texto: f.nome }),
        el('small', { 'class': f.ativo ? '' : 'breve', texto: f.ativo ? f.grupo : 'Em breve' })
      ]);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); escolher(f); });
      lista.appendChild(li);
    });
    lista.hidden = itens.length === 0;
    $('formato-busca').setAttribute('aria-expanded', String(!lista.hidden));
    if (ativoIdx >= 0 && itens[ativoIdx]) $('formato-busca').setAttribute('aria-activedescendant', 'opt-' + itens[ativoIdx].id);
    else $('formato-busca').removeAttribute('aria-activedescendant');
  }
  function fecharLista() { $('formato-lista').hidden = true; $('formato-busca').setAttribute('aria-expanded', 'false'); ativoIdx = -1; }

  async function escolher(f) {
    if (!f.ativo) { $('formato-busca').value = f.nome + ' (em breve)'; fecharLista(); return; }
    $('formato-busca').value = f.nome;
    fecharLista();
    estado.formato = await json('config/formatos/' + f.id + '.json');
    estado.edicao = null; estado.editando = false;
    if (!estado.semRascunho || (estado.pedidoLink && estado.pedidoLink.p.formato !== f.id)) sairDoLink();
    $('gerar-rotulo').textContent = 'Gerar peça';
    montarFormulario();
    $('busca').classList.add('compacta');
    $('trabalho').hidden = false;
    mostrarFormulario();
    $('titulo-formato').textContent = estado.formato.nome;
    $('largura').textContent = estado.formato.largura ? estado.formato.largura + ' px de largura' : '';
    var recuperado = recuperarRascunho();
    atualizarPrevia();
    var alvo = recuperado ? $('f-titulo') : $('campos').querySelector('input:not([type=radio]), textarea, select');
    if (alvo) alvo.focus({ preventScroll: true });
  }

  /* ---------- Modelo do formato (o desenho) e decisões ---------- */
  function modelo() { return window.UnimedModelos[estado.formato.modelo || estado.formato.id]; }
  /* Formatos com mais de um tamanho (cartaz A3/A4/A5, convite, LinkedIn…): as medidas vêm do tamanho escolhido. */
  function formatoEfetivo(dados) {
    var f = estado.formato;
    if (!f || !f.tamanhos) return f;
    var t = dados && dados.tamanho;
    if (!t) { var r = document.querySelector('input[name="tamanho"]:checked'); t = r ? r.value : Object.keys(f.tamanhos)[0]; }
    var x = f.tamanhos[t] || f.tamanhos[Object.keys(f.tamanhos)[0]];
    var e = Object.assign({}, f, x);
    e.quadro = x.largura || f.quadro;
    return e;
  }
  function decidir(dados) {
    var md = modelo(), f = formatoEfetivo(dados);
    return md && md.decidir ? md.decidir(f, estado.marca, estado.tendencias, dados) : M.decidir(f, estado.marca, estado.tendencias, dados);
  }
  function exporta(tipo) { return (estado.formato.exportar || ['html', 'png', 'pdf', 'pptx']).indexOf(tipo) >= 0; }
  /* Todas as imagens que o plano usa (as do bloco de imagens e as das notícias da newsletter). */
  function imagensDoPlano(plano) {
    var l = plano.imagens ? plano.imagens.itens.slice() : [];
    (plano.noticias || []).forEach(function (n) { if (n.imagem) l.push(n.imagem); });
    (plano.figuras || []).forEach(function (f) { l.push(f); });
    return l;
  }

  /* ---------- Quem está pedindo (fica guardado no aparelho) ---------- */
  function mostrarQuem(compacto) {
    var nome = M.limpar($('f-solicitante').value), area = $('f-area').value;
    $('quem-nome').textContent = nome; $('quem-area').textContent = area;
    $('ola-nome').textContent = nome.split(/\s+/)[0] || nome; $('ola-area').textContent = area;
    $('ola').hidden = !(nome && area) || !!estado.ajusteToken;
    $('quem').hidden = !(nome && area);
    if (!compacto || !nome || !area) abrirBoasVindas();
  }
  function guardarQuem() {
    if (estado.ajusteToken) return; // Marketing ajustando a peça de outra pessoa: não troca o "quem" deste aparelho
    var nome = M.limpar($('f-solicitante').value), area = $('f-area').value, email = M.limpar($('f-email').value);
    if (nome || area || email) gravar(CHAVE_QUEM, { nome: nome, area: area, email: email });
  }

  /* Primeira tela: só nome e setor. Depois aparecem a busca e a criação. */
  var vistaAntes = null;
  function abrirBoasVindas() {
    if (!$('boasvindas').hidden) return;
    vistaAntes = { trabalho: !$('trabalho').hidden };
    $('busca').hidden = true; $('trabalho').hidden = true;
    $('boasvindas').hidden = false;
    window.scrollTo(0, 0);
    var alvo = !M.limpar($('f-solicitante').value) ? $('f-solicitante') : $('f-area');
    alvo.focus({ preventScroll: true });
  }
  function continuarBoasVindas(ev) {
    if (ev) ev.preventDefault();
    var nome = M.limpar($('f-solicitante').value), area = $('f-area').value, erros = [];
    if (nome.split(/\s+/).length < 1 || nome.length < 2) erros.push({ campo: 'solicitante', msg: 'Informe seu nome.' });
    if (!area) erros.push({ campo: 'area', msg: 'Selecione seu setor.' });
    document.querySelectorAll('#form-quem .campo').forEach(function (c) { c.classList.remove('com-erro'); var m = c.querySelector('.msg'); if (m) m.remove(); });
    erros.forEach(function (e) { var c = document.querySelector('#form-quem .campo[data-campo="' + e.campo + '"]'); c.classList.add('com-erro'); c.appendChild(el('span', { 'class': 'msg', texto: e.msg })); });
    if (erros.length) { $(erros[0].campo === 'area' ? 'f-area' : 'f-solicitante').focus(); return; }
    guardarQuem();
    $('boasvindas').hidden = true;
    $('busca').hidden = false;
    if (estado.formato && vistaAntes && vistaAntes.trabalho) { $('trabalho').hidden = false; if (estado.reordenarBanco) estado.reordenarBanco(); atualizarPrevia(); }
    else $('formato-busca').focus({ preventScroll: true });
    mostrarQuem(true);
    mostrarMinhas();
  }

  /* "Suas peças": as últimas que a pessoa pediu neste aparelho, com a situação de cada uma. */
  async function mostrarMinhas() {
    var lista = A.minhas().slice(0, 6), caixa = $('minhas'), ul = $('minhas-lista');
    if (!lista.length || !R.central(estado.sistema.registro || {})) { caixa.hidden = true; return; }
    var sit = {};
    try { (await R.situacao(estado.sistema.registro, lista.map(function (x) { return { codigo: x.codigo, t: x.t }; }))).forEach(function (x) { sit[x.codigo] = x; }); }
    catch (e) { /* sem resposta: mostra sem a situação */ }
    ul.textContent = '';
    lista.forEach(function (x) {
      var s = sit[x.codigo], st = s ? A.status(s.status) : null;
      ul.appendChild(el('li', {}, [
        el('a', { href: A.link(estado.sistema, x.codigo, x.t) }, [
          el('span', { 'class': 'minha-titulo', texto: x.titulo || x.codigo }),
          el('span', { 'class': 'minha-info', texto: (x.formato ? x.formato + ' · ' : '') + x.codigo })
        ]),
        st ? el('span', { 'class': 'selo ' + st.classe, texto: st.curto }) : null
      ]));
    });
    caixa.hidden = false;
  }

  /* ---------- Formulário a partir das regras ---------- */
  function contador(c, entrada) {
    if (!c.max) return null;
    var s = el('span', { 'class': 'cont', 'aria-live': 'polite' });
    function at() {
      var n = M.contar(entrada.value);
      s.textContent = n + '/' + c.max;
      s.classList.toggle('estourou', n > c.max);
      var acima = c.ideal && n > c.ideal && n <= c.max;
      s.classList.toggle('acima-ideal', !!acima);
      s.title = acima ? 'Passou de ' + c.ideal + ' caracteres: o título fica num tamanho menor.' : '';
    }
    entrada.addEventListener('input', at); at();
    return s;
  }

  function montarCampo(c) {
    var id = 'f-' + c.id;
    var caixa = el('div', { 'class': 'campo' + (LARGOS[c.id] ? ' largo' : ''), 'data-campo': c.id });
    var rotulo = el('label', { 'for': id }, [el('span', {}, [c.rotulo + ' ', c.obrigatorio ? null : el('span', { 'class': 'opc', texto: '(opcional)' })])]);
    var entrada;

    if (c.tipo === 'escolha' && c.id === 'publico' && ['Interno', 'Externo', 'Campanha interna', 'Campanha externa'].every(function (o) { return c.opcoes.indexOf(o) >= 0; }) && c.opcoes.length === 4) return campoPublico(c, caixa, id);
    if (c.opcoesDe === 'campanhas') {
      // Campanhas do ano (config/campanhas.json), sempre com o guarda-chuva como primeira opção.
      var cs = estado.campanhas || { lista: [] }, gc = cs.guardaChuva || { nome: 'Humano por natureza', essencia: '' };
      c.opcoes = [gc.nome].concat(cs.lista.map(function (x) { return x.nome; }));
      c.descricoes = {}; c.descricoes[gc.nome] = 'Guarda-chuva do ano, sem campanha específica';
      cs.lista.forEach(function (x) { c.descricoes[x.nome] = (x.periodo ? x.periodo + ' · ' : '') + (x.aguardandoMaterial ? 'visual provisório' : 'visual oficial'); });
    }
    if (c.opcoesDe === 'paletas') {
      // Cores: as paletas da campanha escolhida (sugeridas) + as da marca, só as que passam no contraste.
      var KA = window.UnimedKeyArt, rc = $('formulario').querySelector('input[name="campanha"]:checked');
      var lista = KA.paletasPara(estado.tendencias, rc ? rc.value : '');
      var nomeAuto = 'Automática';
      c.opcoes = lista.filter(function (x) { return x.sugerida; }).map(function (x) { return x.nome; }).concat([nomeAuto], lista.filter(function (x) { return !x.sugerida; }).map(function (x) { return x.nome; }));
      c.descricoes = {}; c.amostras = {};
      c.descricoes[nomeAuto] = 'As cores do estilo da Key Art';
      lista.forEach(function (x) {
        c.descricoes[x.nome] = x.sugerida ? 'Sugerida para a campanha' : 'Combina com a marca';
        c.amostras[x.nome] = [x.fundo, x.texto, x.destaque].map(function (k) { return KA.corDe(estado.tendencias, k); });
      });
    }
    if (c.tipo === 'escolha') {
      var grupo = el('div', { 'class': 'temas', role: 'radiogroup', 'aria-labelledby': id + '-r' });
      if (c.amostras) grupo.classList.add('paletas');
      rotulo = el('span', { id: id + '-r', 'class': 'rot' }, [c.rotulo]);
      if (c.descricoes) grupo.classList.add('com-descricao');
      c.opcoes.forEach(function (op, i) {
        var tema = c.id === 'tema' ? estado.formato.temas[op] : null;
        var am = c.amostras && c.amostras[op];
        var miolo = tema
          ? [el('i', { style: 'background:' + estado.marca.cores[tema.faixa] }), op]
          : am
          ? [el('span', { 'class': 'amostra-paleta', style: 'background:' + am[0], 'aria-hidden': 'true' }, [el('span', { style: 'color:' + am[1], texto: 'Aa' }), el('span', { style: 'color:' + am[2], texto: 'Aa' })]), el('b', { texto: op }), el('small', { texto: c.descricoes[op] })]
          : [el('b', { texto: op }), c.descricoes && c.descricoes[op] ? el('small', { texto: c.descricoes[op] }) : null];
        grupo.appendChild(el('label', {}, [
          el('input', { type: 'radio', name: c.id, value: op, checked: i === 0 }),
          el('span', {}, miolo)
        ]));
      });
      caixa.appendChild(rotulo); caixa.appendChild(grupo);
      return caixa;
    }
    if (c.tipo === 'imagens-aprovadas') return campoImagens(c, caixa, id);
    if (c.tipo === 'noticias') return campoNoticias(c, caixa);
    if (c.tipo === 'arquivo') return campoArquivo(c, caixa, id);
    if (c.tipo === 'imagens-documento') return campoImagensDocumento(c, caixa, id);
    if (c.tipo === 'texto-longo') entrada = el('textarea', { id: id, name: c.id, rows: 8 });
    else entrada = el('input', { id: id, name: c.id, type: c.tipo === 'data' ? 'date' : c.tipo === 'hora' ? 'time' : c.tipo === 'link' ? 'url' : 'text', placeholder: c.tipo === 'link' ? 'https://' : '' });
    var cont = contador(c, entrada);
    if (cont) rotulo.appendChild(cont);
    caixa.appendChild(rotulo);
    if (c.formatacao && window.UnimedFormatacao) {
      caixa.classList.add('com-formatacao');
      caixa.appendChild(window.UnimedFormatacao.barra(entrada, realcesResolvidos(), c.formatacao === true ? 'completo' : c.formatacao));
    }
    if (c.blocos) caixa.appendChild(barraBlocos(entrada));
    caixa.appendChild(entrada);
    if (c.id === 'titulo' && (estado.formato.secoes || []).some(function (s) { return s.id === 'keyart'; })) caixa.appendChild(botaoDestacar(entrada));
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    return caixa;
  }

  /* "Para quem vai" em duas perguntas curtas: público (interno/externo) e se é campanha.
     Os 4 rádios originais continuam no formulário (escondidos) e guardam o valor. */
  function campoPublico(c, caixa, id) {
    var ocultos = el('div', { hidden: true });
    c.opcoes.forEach(function (op, i) { ocultos.appendChild(el('input', { type: 'radio', name: c.id, value: op, checked: i === 0, tabindex: '-1' })); });
    var estadoP = { quem: 'Interno', campanha: false };
    var botoes = {};
    function valor() { return estadoP.campanha ? (estadoP.quem === 'Externo' ? 'Campanha externa' : 'Campanha interna') : estadoP.quem; }
    function aplicar(disparar) {
      var v = valor();
      var r = ocultos.querySelector('input[value="' + v + '"]'); if (r) r.checked = true;
      Object.keys(botoes).forEach(function (k) { var b = botoes[k]; var ativo = (b.grupo === 'quem' ? estadoP.quem === b.valor : estadoP.campanha === b.valor); b.n.setAttribute('aria-checked', ativo ? 'true' : 'false'); b.n.classList.toggle('ativo', ativo); });
      dica.textContent = c.descricoes && c.descricoes[v] ? c.descricoes[v] : '';
      if (disparar) r.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function seg(rot, grupoNome, opcoes) {
      var g = el('div', { 'class': 'segmento', role: 'radiogroup', 'aria-label': rot });
      opcoes.forEach(function (o) {
        var n = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false' }, [o[0]]);
        n.addEventListener('click', function () { estadoP[grupoNome] = o[1]; aplicar(true); });
        botoes[grupoNome + o[0]] = { n: n, grupo: grupoNome, valor: o[1] };
        g.appendChild(n);
      });
      return el('div', { 'class': 'pergunta' }, [el('span', { 'class': 'rot', texto: rot }), g]);
    }
    var dica = el('span', { 'class': 'ajuda' });
    caixa.appendChild(el('div', { 'class': 'publico-duplo' }, [
      seg('Para quem vai', 'quem', [['Interno', 'Interno'], ['Externo', 'Externo']]),
      seg('É de uma campanha?', 'campanha', [['Não', false], ['Sim', true]])
    ]));
    caixa.appendChild(dica); caixa.appendChild(ocultos);
    // Quando o rascunho/edição marcar um rádio, sincroniza os botões.
    caixa.sincronizar = function () {
      var m = ocultos.querySelector('input:checked'); if (!m) return;
      estadoP.campanha = /^Campanha/.test(m.value); estadoP.quem = /xterno/.test(m.value) ? 'Externo' : 'Interno'; aplicar(false);
    };
    estado.sincronizarPublico = caixa.sincronizar;
    aplicar(false);
    return caixa;
  }

  /* Cartilha ilustrada: botões que inserem blocos prontos no texto, onde está o cursor. */
  function barraBlocos(entrada) {
    var modelos = [
      ['Destaque', '!! Atenção: escreva aqui o aviso importante.'],
      ['Número grande', '[[numero 85% | dos colaboradores já fizeram o check-up]]'],
      ['Card com ícone', '[[icone exame | Faça seus exames | Agende pelo app em poucos minutos.]]'],
      ['Passo a passo', '1) Primeiro passo\n2) Segundo passo\n3) Terceiro passo'],
      ['Citação', '[[citacao Cuidar de gente é o que nos move. | Diretoria Executiva]]']
    ];
    var barra = el('div', { 'class': 'inserir-blocos', role: 'group', 'aria-label': 'Inserir bloco' }, [el('span', { 'class': 'rot', texto: 'Inserir bloco:' })]);
    modelos.forEach(function (m) {
      var b = el('button', { type: 'button', 'class': 'btn-mini' }, ['+ ' + m[0]]);
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        var v = entrada.value, i = entrada.selectionStart != null ? entrada.selectionStart : v.length;
        var antes = v.slice(0, i), depois = v.slice(i);
        var pre = antes && !/\n\n$/.test(antes) ? (/\n$/.test(antes) ? '\n' : '\n\n') : '';
        var pos = depois && !/^\n\n/.test(depois) ? (/^\n/.test(depois) ? '\n' : '\n\n') : '';
        entrada.value = antes + pre + m[1] + pos + depois;
        var ini = (antes + pre).length;
        entrada.focus(); entrada.setSelectionRange(ini, ini + m[1].length);
        entrada.dispatchEvent(new Event('input', { bubbles: true }));
      });
      barra.appendChild(b);
    });
    barra.appendChild(el('span', { 'class': 'ajuda', texto: 'Cards com ícone seguidos ficam lado a lado (até 3). Ícones: consulta, exame, agenda, família, telemedicina, carteirinha, receita, rede, reembolso, alerta, caminhada, alimentação, prêmio…' }));
    return barra;
  }

  /* Cores dependem da campanha: refaz as opções (a sugerida da campanha vem marcada). */
  function reconstruirCores(manter) {
    var c = (estado.formato.campos || []).filter(function (x) { return x.opcoesDe === 'paletas'; })[0];
    var velho = c && document.querySelector('#campos .campo[data-campo="' + c.id + '"]');
    if (!velho) return;
    var novo = montarCampo(c);
    velho.parentNode.replaceChild(novo, velho);
    if (manter) { var r = novo.querySelector('input[value="' + manter + '"]'); if (r) r.checked = true; }
  }

  /* Seções que só valem em campanha (ex.: Visual da campanha). */
  function aplicarCondicoes() {
    var m = $('formulario').querySelector('input[name="publico"]:checked');
    var campanha = estado.formato.id === 'campanha-kit' || (m && /^Campanha/.test(m.value));
    (estado.formato.secoes || []).forEach(function (s) {
      if (!s.seCampanha) return;
      var n = document.querySelector('[data-secao="' + s.id + '"]'); if (n) n.hidden = !campanha;
    });
    // Campos que dependem de outra escolha (ex.: campos do verso só "Com verso") ou que não valem em campanha.
    estado.formato.campos.forEach(function (c) {
      if (!c.se && !c.seNaoCampanha) return;
      var n = document.querySelector('#campos .campo[data-campo="' + c.id + '"]'); if (!n) return;
      var ok = true;
      if (c.se) { var r = $('formulario').querySelector('input[name="' + c.se.campo + '"]:checked'); ok = !!(r && r.value === c.se.valor); }
      if (c.seNaoCampanha && campanha) ok = false;
      n.hidden = !ok;
    });
  }

  /* Destacar palavra: envolve a seleção do título em *asteriscos* (a palavra vira Slab nas campanhas). */
  function botaoDestacar(entrada) {
    var b = el('button', { type: 'button', 'class': 'btn-mini destacar', title: 'Selecione uma palavra do título e clique' }, ['Destacar palavra']);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () {
      var v = entrada.value.replace(/\*/g, ''), i = entrada.selectionStart, f = entrada.selectionEnd;
      var bruto = entrada.value;
      // posições na versão sem asteriscos
      var antes = bruto.slice(0, i).replace(/\*/g, '').length, depois = bruto.slice(0, f).replace(/\*/g, '').length;
      // Sempre palavras inteiras: estende a seleção até os espaços mais próximos.
      if (depois < antes) depois = antes;
      while (antes > 0 && v.charAt(antes - 1) !== ' ') antes--;
      while (depois < v.length && v.charAt(depois) !== ' ' && (depois === antes || v.charAt(depois - 1) !== ' ')) depois++;
      while (depois > antes && v.charAt(depois - 1) === ' ') depois--;
      var palavra = v.slice(antes, depois).trim();
      if (!palavra) return;
      entrada.value = v.slice(0, antes) + '*' + v.slice(antes, depois) + '*' + v.slice(depois);
      entrada.dispatchEvent(new Event('input', { bubbles: true }));
      entrada.focus();
    });
    return b;
  }

  function realcesResolvidos() {
    var cores = estado.marca.cores;
    return ((estado.formato.formatacao && estado.formato.formatacao.realces) || []).map(function (r) {
      return { id: r.id, nome: r.nome, fundo: cores[r.cor] || r.cor, texto: cores[r.texto] || r.texto };
    });
  }

  /* ---------- Imagem do computador ----------
     A biblioteca é só de exemplo: a pessoa pode usar a própria foto. A imagem é lida no navegador,
     reduzida para no máximo 4000 px no lado maior (JPEG 95%) e entra na lista desta sessão, junto da
     biblioteca. Daí em diante vale igual a qualquer imagem: enquadramento, recorte e downloads. */
  var MAX_LADO = 4000, MAX_MB = 25, contaEnvio = 0;
  function lerImagemDoComputador(arquivo) {
    return new Promise(function (ok, falha) {
      if (!arquivo) return falha(new Error('Nenhum arquivo.'));
      if (!/^image\/(jpeg|png|webp|gif|bmp)$/i.test(arquivo.type)) return falha(new Error('Use JPG, PNG ou WebP (HEIC do iPhone: exporte como JPG antes).'));
      if (arquivo.size > MAX_MB * 1024 * 1024) return falha(new Error('Imagem acima de ' + MAX_MB + ' MB.'));
      var leitor = new FileReader();
      leitor.onerror = function () { falha(new Error('Não consegui ler o arquivo.')); };
      leitor.onload = function () {
        var im = new Image();
        im.onerror = function () { falha(new Error('O arquivo não é uma imagem válida.')); };
        im.onload = function () {
          var esc = Math.min(1, MAX_LADO / Math.max(im.naturalWidth, im.naturalHeight));
          var w = Math.round(im.naturalWidth * esc), h = Math.round(im.naturalHeight * esc);
          var tela = document.createElement('canvas'); tela.width = w; tela.height = h;
          var ctx = tela.getContext('2d');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); // PNG transparente vira fundo branco
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(im, 0, 0, w, h);
          contaEnvio += 1;
          var nome = String(arquivo.name || 'imagem').replace(/\.[a-z0-9]+$/i, '');
          avisarNitidez(w, h, nome);
          ok({ id: 'enviada-' + Date.now().toString(36) + '-' + contaEnvio, arquivo: tela.toDataURL('image/jpeg', 0.95), descricao: nome, nome: nome, w: w, h: h, enviada: true });
        };
        im.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }
  /* Foto pequena para o formato: avisa antes de gerar (fica borrada no tamanho final). */
  function avisarNitidez(w, h, nome) {
    var f = formatoEfetivo() || {};
    var precisa = Math.max(f.largura || 0, f.altura || 0);
    var caixa = $('mensagens');
    if (!caixa || !precisa) return;
    var velho = caixa.querySelector('[data-aviso="nitidez"]'); if (velho) velho.remove();
    if (Math.max(w, h) >= precisa * 0.75) return;
    caixa.appendChild(el('p', { 'class': 'alerta aviso', role: 'status', 'data-aviso': 'nitidez', texto: 'A foto "' + nome + '" tem ' + w + ' × ' + h + ' px e pode ficar sem nitidez nesta peça (' + f.largura + ' × ' + f.altura + ' px). Se tiver uma versão maior, prefira ela.' }));
  }

  /* Guarda a imagem enviada junto da biblioteca (só nesta sessão). */
  function filialDe(area) {
    var l = (estado.marca.setores && estado.marca.setores.lista) || [];
    var s = l.filter(function (x) { return x.nome === area; })[0];
    return s ? s.filial : '';
  }
  function registrarEnviada(img) { estado.marca.imagensAprovadas.push(img); return img; }
  function botaoEnviar(rotulo, aoEnviar, multiplo) {
    var inp = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'class': 'sr-only', multiple: multiplo ? true : null, tabindex: '-1', 'aria-hidden': 'true' });
    var status = el('span', { 'class': 'envio-status', role: 'status' });
    var b = el('button', { type: 'button', 'class': 'btn-mini btn-enviar' }, [rotulo]);
    b.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', async function () {
      var lista = Array.prototype.slice.call(inp.files || []);
      inp.value = '';
      for (var i = 0; i < lista.length; i++) {
        status.textContent = 'Preparando ' + lista[i].name + '…';
        try { aoEnviar(registrarEnviada(await lerImagemDoComputador(lista[i]))); status.textContent = ''; }
        catch (e) { status.textContent = lista[i].name + ': ' + e.message; }
      }
    });
    return el('span', { 'class': 'envio' }, [b, inp, status]);
  }

  /* ---------- Imagens: até 3, escolha na biblioteca e ajuste do enquadramento ---------- */
  function slotsPara(qtd) {
    var md = modelo();
    if (md && md.slots) { var dd = lerDados(); return md.slots(formatoEfetivo(dd), qtd, dd); }
    var lay = (estado.formato.arvore.imagem && estado.formato.arvore.imagem.layouts) || {};
    return lay[String(qtd)] || [];
  }

  function campoImagens(c, caixa, id) {
    var limite = c.limite || 3;
    var rotulo = el('span', { id: id + '-r', 'class': 'rot' }, [c.rotulo + ' ', el('span', { 'class': 'opc', texto: '(até ' + limite + ': do seu computador ou dos exemplos)' })]);
    var grade = el('div', { 'class': 'imagens multi', role: 'group', 'aria-labelledby': id + '-r' });
    var aviso = el('p', { 'class': 'aviso-campo', id: 'imagens-aviso', role: 'status', hidden: true });
    var ajustes = el('div', { 'class': 'ajustes-imagem', 'aria-live': 'polite' });

    function redesenhar() {
      var sel = estado.imagens.map(function (i) { return i.id; });
      grade.querySelectorAll('label').forEach(function (lb) {
        var cb = lb.querySelector('input');
        var pos = sel.indexOf(cb.value);
        cb.checked = pos >= 0;
        cb.disabled = pos < 0 && sel.length >= limite;
        lb.querySelector('.ordem-n').textContent = pos >= 0 ? String(pos + 1) : '';
        lb.classList.toggle('escolhida', pos >= 0);
      });
      ajustes.textContent = '';
      if (!estado.imagens.length) return;
      var slots = slotsPara(estado.imagens.length);
      var layoutNome = { 1: 'Uma imagem horizontal', 2: 'Duas imagens lado a lado', 3: 'Mosaico: uma grande e duas menores' }[estado.imagens.length];
      ajustes.appendChild(el('p', { 'class': 'ajustes-titulo' }, [el('b', { texto: layoutNome }), ' · arraste cada foto para ajustar o enquadramento.']));
      var lista = el('div', { 'class': 'ajustes-lista q' + estado.imagens.length });
      estado.imagens.forEach(function (im, i) {
        var ap = estado.marca.imagensAprovadas.filter(function (a) { return a.id === im.id; })[0];
        if (!ap || !slots[i]) return;
        lista.appendChild(Rc.editor({
          id: im.id, numero: i + 1, src: ap.arquivo, w: slots[i].w, h: slots[i].h,
          rotulo: 'Imagem ' + (i + 1) + ': ' + ap.descricao,
          ajuste: im,
          aoMudar: function (aj) { im.x = aj.x; im.y = aj.y; im.zoom = aj.zoom; agendarPrevia(); }
        }));
      });
      ajustes.appendChild(lista);
    }
    estado.redesenharImagens = redesenhar;

    function miniatura(img, noComeco) {
      var cb = el('input', { type: 'checkbox', name: c.id, value: img.id, 'aria-label': img.descricao });
      cb.addEventListener('change', function () {
        if (cb.checked) estado.imagens.push({ id: img.id, x: 0.5, y: 0.5, zoom: 1 });
        else estado.imagens = estado.imagens.filter(function (i) { return i.id !== img.id; });
        redesenhar(); agendarPrevia();
      });
      var lb = el('label', { title: img.descricao, 'class': img.enviada ? 'enviada' : null }, [cb, el('img', { src: img.arquivo, alt: '' }), el('span', { 'class': 'ordem-n', 'aria-hidden': 'true' }), img.enviada ? el('span', { 'class': 'tag-enviada', texto: 'Sua' }) : null]);
      if (noComeco) grade.insertBefore(lb, grade.firstChild); else grade.appendChild(lb);
    }
    estado.marca.imagensAprovadas.forEach(function (img) { miniatura(img); });
    // Banco por tema e filial: as fotos do tema escolhido e da unidade de quem pede vêm primeiro.
    function reordenar() {
      var tema = (($('formulario').querySelector('input[name="tema"]:checked') || {}).value) || '';
      var filial = filialDe($('f-area').value);
      var nota = function (img) {
        if (img.enviada) return 100;
        var n = 0;
        if (tema && (img.temas || []).indexOf(tema) >= 0) n += 2;
        if ((img.filiais || []).length) n += (img.filiais.indexOf(filial) >= 0 ? 3 : -5);
        return n;
      };
      var porId = {}; estado.marca.imagensAprovadas.forEach(function (i) { porId[i.id] = i; });
      var lbs = Array.prototype.slice.call(grade.querySelectorAll('label'));
      lbs.map(function (lb, i) { return { lb: lb, n: nota(porId[lb.querySelector('input').value] || {}), i: i }; })
        .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
        .forEach(function (x) { grade.appendChild(x.lb); });
    }
    estado.reordenarBanco = reordenar;
    reordenar();
    var enviar = botaoEnviar('+ Enviar do computador', function (img) {
      miniatura(img, true);
      if (estado.imagens.length < limite) estado.imagens.push({ id: img.id, x: 0.5, y: 0.5, zoom: 1 });
      redesenhar(); agendarPrevia();
    }, true);
    caixa.appendChild(rotulo); caixa.appendChild(enviar); caixa.appendChild(grade);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    caixa.appendChild(aviso);
    caixa.appendChild(ajustes);
    redesenhar();
    return caixa;
  }

  /* ---------- Newsletter: lista de notícias (até 4) ---------- */
  function campoNoticias(c, caixa) {
    var limite = c.limite || 4;
    var tam = (estado.formato.arvore && estado.formato.arvore.noticias) || { destaque: { w: 536, h: 268 }, demais: { w: 176, h: 132 } };
    caixa.classList.add('largo');
    var lista = el('div', { 'class': 'noticias' });
    var item = c.item || 'Notícia', itemMin = item.toLowerCase();
    var mais = el('button', { type: 'button', 'class': 'btn secundario btn-mais' }, ['+ Adicionar ' + itemMin]);
    var anuncio = el('span', { 'class': 'sr-only', 'aria-live': 'polite' });
    if (!estado.noticias.length) estado.noticias.push(nova());
    function nova() { return { titulo: '', texto: '', linkTexto: '', link: '', imagem: '', x: 0.5, y: 0.5, zoom: 1 }; }
    function mudou() { agendarPrevia(); }
    function entrada(n, k, rot, i, tipo, extra) {
      var idc = 'n-' + i + '-' + k;
      var inp = tipo === 'area' ? el('textarea', { id: idc, rows: 3 }) : el('input', { id: idc, type: tipo || 'text', placeholder: extra || '' });
      inp.value = n[k] || '';
      inp.addEventListener('input', function () { n[k] = inp.value; });
      var lab = el('label', { 'for': idc }, [rot]);
      if (k === 'texto' && c.maxTexto) {
        var ct = el('span', { 'class': 'cont' });
        var at = function () { var q = M.contar(inp.value); ct.textContent = q + '/' + c.maxTexto; ct.classList.toggle('estourou', q > c.maxTexto); };
        inp.addEventListener('input', at); at(); lab.appendChild(ct);
      }
      return el('div', { 'class': 'campo' + (tipo === 'area' || k === 'titulo' ? ' largo' : '') }, [lab, inp]);
    }
    function desenhar(foco) {
      lista.textContent = '';
      estado.noticias.forEach(function (n, i) {
        var t = i === 0 ? tam.destaque : tam.demais;
        var sel = el('select', { id: 'n-' + i + '-imagem' }, [el('option', { value: '', texto: 'Sem foto' })].concat(estado.marca.imagensAprovadas.map(function (a) { return el('option', { value: a.id, texto: a.descricao }); })));
        sel.value = n.imagem || '';
        var editorCaixa = el('div', { 'class': 'noticia-foto' });
        function editor() {
          editorCaixa.textContent = '';
          var ap = estado.marca.imagensAprovadas.filter(function (a) { return a.id === n.imagem; })[0];
          if (!ap) return;
          editorCaixa.appendChild(Rc.editor({ id: 'noticia' + i, numero: i + 1, src: ap.arquivo, w: t.w, h: t.h, rotulo: 'Foto do ' + itemMin + ' ' + (i + 1), ajuste: n, aoMudar: function (aj) { n.x = aj.x; n.y = aj.y; n.zoom = aj.zoom; mudou(); } }));
        }
        sel.addEventListener('change', function () { n.imagem = sel.value; n.x = 0.5; n.y = 0.5; n.zoom = 1; editor(); });
        editor();
        var enviarN = botaoEnviar('Enviar foto do computador', function (img) { n.imagem = img.id; n.x = 0.5; n.y = 0.5; n.zoom = 1; desenhar(); mudou(); });
        var sobe = el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': 'Subir ' + itemMin + ' ' + (i + 1), disabled: i === 0, onclick: function () { trocar(i, -1); } }, ['↑']);
        var desce = el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': 'Descer ' + itemMin + ' ' + (i + 1), disabled: i === estado.noticias.length - 1, onclick: function () { trocar(i, 1); } }, ['↓']);
        var tirar = el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': 'Remover ' + itemMin + ' ' + (i + 1), disabled: estado.noticias.length === 1, onclick: function () { estado.noticias.splice(i, 1); desenhar(); anuncio.textContent = item + ' removido.'; mudou(); } }, ['Remover']);
        lista.appendChild(el('fieldset', { 'class': 'noticia' }, [
          el('legend', {}, [el('b', { texto: item + ' ' + (i + 1) }), el('span', { 'class': 'opc', texto: c.semLink ? '' : i === 0 ? ' · destaque, foto ' + t.w + ' × ' + t.h : ' · lista, foto ' + t.w + ' × ' + t.h })]),
          el('div', { 'class': 'noticia-acoes' }, [sobe, desce, tirar]),
          el('div', { 'class': 'campos' }, [
            entrada(n, 'titulo', 'Título', i),
            entrada(n, 'texto', c.rotuloTexto || 'Resumo (opcional)', i, 'area'),
            c.semLink ? null : entrada(n, 'linkTexto', 'Texto do link', i, 'text', 'Leia mais'),
            c.semLink ? null : entrada(n, 'link', 'Link (opcional)', i, 'url', 'https://'),
            el('div', { 'class': 'campo largo' }, [el('label', { 'for': 'n-' + i + '-imagem' }, ['Foto (opcional)']), el('div', { 'class': 'linha-foto' }, [sel, enviarN]), editorCaixa])
          ])
        ]));
      });
      mais.disabled = estado.noticias.length >= limite;
      mais.textContent = estado.noticias.length >= limite ? 'Limite de ' + limite + ' ' + (c.itemPlural || 'notícias') : '+ Adicionar ' + itemMin;
      if (foco != null) { var f = document.getElementById('n-' + foco + '-titulo'); if (f) f.focus(); }
    }
    function trocar(i, d) {
      var j = i + d; var t = estado.noticias[i]; estado.noticias[i] = estado.noticias[j]; estado.noticias[j] = t;
      desenhar(j); anuncio.textContent = item + ' agora na posição ' + (j + 1) + '.'; mudou();
    }
    mais.addEventListener('click', function () { if (estado.noticias.length < limite) { estado.noticias.push(nova()); desenhar(estado.noticias.length - 1); mudou(); } });
    estado.redesenharNoticias = function () { desenhar(); };
    caixa.appendChild(lista); caixa.appendChild(mais); caixa.appendChild(anuncio);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    desenhar();
    return caixa;
  }

  /* ---------- Cartilha: imagens no meio do texto ----------
     Cada imagem enviada ganha um número; "Inserir no texto" coloca [[imagem N]] onde está o cursor
     no Conteúdo. Ela sai na largura do texto, com os cantos da marca, no PDF e no Word. */
  function campoImagensDocumento(c, caixa, id) {
    caixa.classList.add('largo');
    var lista = el('div', { 'class': 'doc-imagens' });
    function inserir(n) {
      var t = $('f-' + (c.alvo || 'texto'));
      if (!t) return;
      var pos = t.selectionStart != null ? t.selectionStart : t.value.length;
      var antes = t.value.slice(0, pos), depois = t.value.slice(pos);
      var marca = (antes && !/\n\n$/.test(antes) ? (/\n$/.test(antes) ? '\n' : '\n\n') : '') + '[[imagem ' + n + ']]' + (depois && !/^\n\n/.test(depois) ? '\n\n' : '');
      t.value = antes + marca + depois;
      t.focus(); t.setSelectionRange(pos + marca.length, pos + marca.length);
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function desenhar() {
      lista.textContent = '';
      estado.docImagens.forEach(function (im, i) {
        lista.appendChild(el('figure', { 'class': 'doc-imagem' }, [
          el('img', { src: im.arquivo, alt: '' }),
          el('figcaption', {}, [el('b', { texto: 'Imagem ' + (i + 1) }), el('span', { texto: im.nome })]),
          el('div', { 'class': 'doc-imagem-acoes' }, [
            el('button', { type: 'button', 'class': 'btn-mini', onclick: function () { inserir(i + 1); } }, ['Inserir no texto']),
            el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': 'Remover imagem ' + (i + 1), onclick: function () { estado.docImagens.splice(i, 1); desenhar(); agendarPrevia(); } }, ['Remover'])
          ])
        ]));
      });
    }
    estado.redesenharDocImagens = desenhar;
    caixa.appendChild(el('span', { id: id + '-r', 'class': 'rot' }, [c.rotulo + ' ', el('span', { 'class': 'opc', texto: '(opcional, do seu computador)' })]));
    caixa.appendChild(botaoEnviar('+ Enviar imagens', function (img) {
      estado.docImagens.push(img); desenhar();
      inserir(estado.docImagens.length);
    }, true));
    caixa.appendChild(lista);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    desenhar();
    return caixa;
  }

  /* ---------- Documento original (Word): o texto entra no campo sem mudar nada ---------- */
  function campoArquivo(c, caixa, id) {
    caixa.classList.add('largo');
    var inp = el('input', { id: id, type: 'file', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    var status = el('p', { 'class': 'ajuda', role: 'status' });
    inp.addEventListener('change', async function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      status.textContent = 'Lendo ' + f.name + '…';
      try {
        await window.UnimedExportar.carregar('pptx'); // traz o JSZip
        var texto = await lerDocx(f);
        var alvo = $('f-' + (c.preenche || 'texto'));
        if (alvo) { alvo.value = texto; alvo.dispatchEvent(new Event('input', { bubbles: true })); }
        var t = $('f-titulo');
        if (t && !t.value && f.name) { t.value = f.name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' '); t.dispatchEvent(new Event('input', { bubbles: true })); }
        status.textContent = 'Pronto: o texto de ' + f.name + ' entrou no campo "Conteúdo", sem mudanças. Confira os títulos das seções.';
      } catch (e) { status.textContent = 'Não consegui ler o arquivo (' + e.message + '). Cole o texto no campo "Conteúdo".'; }
    });
    caixa.appendChild(el('label', { 'for': id }, [el('span', {}, [c.rotulo + ' ', el('span', { 'class': 'opc', texto: '(opcional)' })])]));
    caixa.appendChild(inp);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    caixa.appendChild(status);
    return caixa;
  }

  /* Lê um .docx no navegador: títulos (estilo de título ou linha curta toda em negrito), listas e parágrafos. */
  async function lerDocx(arquivo) {
    var zip = await window.JSZip.loadAsync(await arquivo.arrayBuffer());
    var xml = await zip.file('word/document.xml').async('string');
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    var corpo = doc.getElementsByTagNameNS(W, 'body')[0];
    var saida = [];
    function textoDe(p) {
      var t = '';
      Array.prototype.forEach.call(p.getElementsByTagNameNS(W, '*'), function (n) {
        if (n.localName === 't') t += n.textContent;
        else if (n.localName === 'tab') t += ' ';
        else if (n.localName === 'br') t += ' ';
      });
      return t.replace(/\s+/g, ' ').trim();
    }
    function paragrafo(p) {
      var t = textoDe(p);
      if (!t) return;
      var est = p.getElementsByTagNameNS(W, 'pStyle')[0];
      var nomeEst = est ? est.getAttributeNS(W, 'val') || est.getAttribute('w:val') || '' : '';
      var lista = p.getElementsByTagNameNS(W, 'numPr').length > 0 || /list|lista/i.test(nomeEst);
      var runs = Array.prototype.filter.call(p.getElementsByTagNameNS(W, 'r'), function (r) { return r.getElementsByTagNameNS(W, 't').length; });
      var tudoNegrito = runs.length && runs.every(function (r) { var b = r.getElementsByTagNameNS(W, 'b')[0]; return b && b.getAttributeNS(W, 'val') !== '0' && b.getAttribute('w:val') !== '0'; });
      var titulo = /heading|t[ií]tulo|title/i.test(nomeEst) || (tudoNegrito && t.length <= 90 && !/[.;,:]$/.test(t));
      if (lista && !titulo) saida.push('- ' + t);
      else if (titulo) saida.push('\n' + t.replace(/[.:]$/, '') + '\n');
      else saida.push('\n' + t + '\n');
    }
    Array.prototype.forEach.call(corpo.childNodes, function (n) {
      if (n.localName === 'p') paragrafo(n);
      else if (n.localName === 'tbl') {
        Array.prototype.forEach.call(n.getElementsByTagNameNS(W, 'tr'), function (tr) {
          var cel = Array.prototype.map.call(tr.getElementsByTagNameNS(W, 'tc'), textoDe).filter(Boolean);
          if (cel.length) saida.push('\n' + cel.join(' | ') + '\n');
        });
      }
    });
    return saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- Ordem dos blocos (modular) ---------- */
  function campoOrdem() {
    var b = estado.formato.blocos;
    if (!b) return null;
    if (!estado.ordem) estado.ordem = b.padrao.slice();
    var caixa = el('div', { 'class': 'campo largo', 'data-campo': 'ordem' });
    caixa.appendChild(el('span', { id: 'ordem-r', 'class': 'rot' }, ['Ordem dos blocos ', el('span', { 'class': 'opc', texto: '(cabeçalho e fechamento são fixos)' })]));
    var lista = el('ol', { 'class': 'ordem-blocos', 'aria-labelledby': 'ordem-r' });
    var anuncio = el('span', { 'class': 'sr-only', 'aria-live': 'polite' });
    function mover(i, d) {
      var j = i + d;
      if (j < 0 || j >= estado.ordem.length) return;
      var t = estado.ordem[i]; estado.ordem[i] = estado.ordem[j]; estado.ordem[j] = t;
      desenhar(j, d);
      anuncio.textContent = b.nomes[t] + ' agora na posição ' + (j + 1) + '.';
      agendarPrevia();
    }
    function desenhar(foco, dir) {
      lista.textContent = '';
      estado.ordem.forEach(function (k, i) {
        var sobe = el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': 'Subir ' + b.nomes[k], disabled: i === 0, onclick: function () { mover(i, -1); } }, ['↑']);
        var desce = el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': 'Descer ' + b.nomes[k], disabled: i === estado.ordem.length - 1, onclick: function () { mover(i, 1); } }, ['↓']);
        lista.appendChild(el('li', { 'data-bloco': k }, [
          el('span', { 'class': 'ordem-nome' }, [b.nomes[k], el('small', { 'class': 'ordem-vazio', texto: 'vazio' })]),
          el('span', { 'class': 'ordem-acoes' }, [sobe, desce])
        ]));
      });
      marcarVazios();
      if (foco != null) {
        var alvo = lista.children[foco] && lista.children[foco].querySelectorAll('button')[dir < 0 ? 0 : 1];
        if (alvo && !alvo.disabled) alvo.focus(); else if (lista.children[foco]) lista.children[foco].querySelector('button:not([disabled])').focus();
      }
    }
    /* Blocos sem conteúdo ficam apagados: não aparecem na peça. */
    function marcarVazios(dados) {
      dados = dados || lerDados();
      var mapa = b.preenchidoPor || {};
      lista.querySelectorAll('li').forEach(function (li) {
        var campo = mapa[li.getAttribute('data-bloco')];
        if (!campo) return;
        var v = dados[campo];
        var cheio = Array.isArray(v) ? v.filter(function (n) { return n && (n.id || M.limpar(n.titulo)); }).length > 0 : !!M.limpar(M.semMarcas ? M.semMarcas(v || '') : (v || ''));
        li.classList.toggle('vazio', !cheio);
      });
    }
    estado.desenharOrdem = desenhar;
    estado.marcarVazios = marcarVazios;
    var restaurar = el('button', { type: 'button', 'class': 'btn-mini', onclick: function () { estado.ordem = b.padrao.slice(); desenhar(); agendarPrevia(); } }, ['Voltar ao padrão']);
    caixa.appendChild(lista); caixa.appendChild(restaurar); caixa.appendChild(anuncio);
    caixa.appendChild(el('span', { 'class': 'ajuda', texto: 'Blocos apagados estão vazios e não entram na peça. Cada bloco aparece uma vez só, na posição escolhida.' }));
    // desenha depois de entrar na página (lerDados precisa dos campos)
    setTimeout(function () { desenhar(); }, 0);
    return caixa;
  }

  /* ---------- Seções: a fixa fica aberta; as outras abrem e fecham com resumo ---------- */
  function secoesDoFormato() {
    var f = estado.formato;
    var todos = f.campos.map(function (c) { return c.id; }).concat(f.blocos ? ['ordem'] : []);
    if (!f.secoes || !f.secoes.length) return [{ id: 'tudo', nome: 'Conteúdo', fixa: true, campos: todos }];
    var usados = {};
    f.secoes.forEach(function (s) { s.campos.forEach(function (id) { usados[id] = 1; }); });
    var sobra = todos.filter(function (id) { return !usados[id]; });
    var lista = f.secoes.map(function (s) { return Object.assign({}, s, { campos: s.campos.slice() }); });
    if (sobra.length) lista[0].campos = lista[0].campos.concat(sobra); // nada fica de fora
    return lista;
  }

  function montarFormulario() {
    var caixa = $('campos');
    caixa.textContent = '';
    estado.imagens = [];
    estado.noticias = [];
    estado.docImagens = estado.docImagens || [];
    estado.ordem = null;
    estado.redesenharImagens = estado.desenharOrdem = estado.marcarVazios = estado.redesenharNoticias = estado.redesenharAjustes = null;
    estado.ajustes = { todas: {}, porPeca: {} };
    var porId = {};
    estado.formato.campos.forEach(function (c) { porId[c.id] = c; });
    secoesDoFormato().forEach(function (s) {
      var corpo = el('div', { 'class': 'campos' });
      s.campos.forEach(function (id) {
        var n = id === 'ordem' ? campoOrdem() : porId[id] ? montarCampo(porId[id]) : null;
        if (n) corpo.appendChild(n);
      });
      if (!corpo.children.length) return;
      if (s.fixa) {
        caixa.appendChild(el('div', { 'class': 'secao fixa', 'data-secao': s.id }, [corpo]));
      } else {
        caixa.appendChild(el('details', { 'class': 'secao', 'data-secao': s.id, 'data-vazio': s.vazio || 'Opcional' }, [
          el('summary', {}, [el('span', { 'class': 'secao-nome', texto: s.nome }), el('span', { 'class': 'secao-resumo' })]),
          corpo
        ]));
      }
    });
    if (temAjustes()) {
      caixa.appendChild(el('details', { 'class': 'secao', 'data-secao': 'ajustes', 'data-vazio': 'Automático' }, [
        el('summary', {}, [el('span', { 'class': 'secao-nome', texto: 'Ajustes finos' }), el('span', { 'class': 'secao-resumo' })]),
        campoAjustes()
      ]));
      // Ajustes finos ficam antes do "Visual da campanha".
      var kv = caixa.querySelector('[data-secao="keyart"]'), ajs = caixa.querySelector('[data-secao="ajustes"]');
      if (kv && ajs) caixa.insertBefore(ajs, kv);
    }
    setTimeout(aplicarCondicoes, 0);
  }

  /* ---------- Ajustes finos: posição, alinhamento e tamanho do título, dentro das regras ---------- */
  function temAjustes() { var m = estado.formato.modelo; return m === 'peca-fixa' || m === 'campanha-kit' || m === 'flyer'; }
  function pecasAjustaveis() {
    var k = estado.formato.kit; if (!k) return [];
    var vistos = {}, lista = [];
    ['externa', 'interna'].forEach(function (l) { (k[l] || []).forEach(function (p) { if (p.tipo === 'email' || vistos[p.id]) return; vistos[p.id] = 1; lista.push(p); }); });
    return lista;
  }
  function campoAjustes() {
    estado.ajustes = estado.ajustes || { todas: {}, porPeca: {} };
    var alvo = 'todas';
    var box = el('div', { 'class': 'campos ajustes' });
    var atual = function () { return alvo === 'todas' ? estado.ajustes.todas : (estado.ajustes.porPeca[alvo] = estado.ajustes.porPeca[alvo] || {}); };
    var refs = [];
    function mudou() { refs.forEach(function (f) { f(); }); resumir(); agendarPrevia(); }
    function seg(rot, chave, opcoes) {
      var g = el('div', { 'class': 'segmento', role: 'radiogroup', 'aria-label': rot });
      opcoes.forEach(function (o) {
        var b = el('button', { type: 'button', role: 'radio' }, [o[0]]);
        b.addEventListener('click', function () { var a = atual(); if (o[1] === '' || o[1] === 1) delete a[chave]; else a[chave] = o[1]; mudou(); });
        g.appendChild(b);
        refs.push(function () { var v = atual()[chave]; var on = (v == null ? (o[1] === '' || o[1] === 1) : v === o[1]); b.classList.toggle('ativo', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
      });
      return el('div', { 'class': 'campo largo' }, [el('span', { 'class': 'rot', texto: rot }), g]);
    }
    var pecas = pecasAjustaveis();
    if (pecas.length) {
      var sel = el('select', { id: 'aj-alvo' }, [el('option', { value: 'todas', texto: 'Todas as peças do kit' })].concat(pecas.map(function (p) { return el('option', { value: p.id, texto: 'Só ' + p.nome + (p.altura ? ' (' + p.largura + ' × ' + p.altura + ')' : '') }); })));
      sel.addEventListener('change', function () { alvo = sel.value; refs.forEach(function (f) { f(); }); });
      box.appendChild(el('div', { 'class': 'campo largo' }, [el('label', { 'for': 'aj-alvo', texto: 'Aplicar em' }), sel, el('span', { 'class': 'ajuda', texto: 'Escolha uma peça para ajustar só ela. O que for ajustado numa peça vale por cima do ajuste de todas.' })]));
    }
    box.appendChild(seg('Posição do texto', 'v', [['Automática', ''], ['Topo', 'topo'], ['Meio', 'meio'], ['Base', 'base']]));
    box.appendChild(seg('Alinhamento', 'h', [['Esquerda', ''], ['Centro', 'centro']]));
    box.appendChild(seg('Tamanho do título', 'e', [['Menor', 0.88], ['Automático', 1], ['Maior', 1.12]]));
    var setas = el('div', { 'class': 'setas' });
    [['↑', 0, -1, 'Subir'], ['↓', 0, 1, 'Descer'], ['←', -1, 0, 'Para a esquerda'], ['→', 1, 0, 'Para a direita']].forEach(function (s) {
      var b = el('button', { type: 'button', 'class': 'btn-mini', 'aria-label': s[3], title: s[3] }, [s[0]]);
      b.addEventListener('click', function () { var a = atual(); a.dx = Math.max(-12, Math.min(12, (a.dx || 0) + s[1])); a.dy = Math.max(-12, Math.min(12, (a.dy || 0) + s[2])); if (!a.dx) delete a.dx; if (!a.dy) delete a.dy; mudou(); });
      setas.appendChild(b);
    });
    var pos = el('span', { 'class': 'ajuda' });
    refs.push(function () { var a = atual(); pos.textContent = (a.dx || a.dy) ? 'Deslocado ' + Math.abs(a.dy || 0) + (a.dy < 0 ? ' para cima' : a.dy > 0 ? ' para baixo' : '') + (a.dx ? ', ' + Math.abs(a.dx) + (a.dx < 0 ? ' à esquerda' : ' à direita') : '') + '. O texto nunca sai da área segura.' : 'O texto anda dentro da área segura da peça, sem encostar na logo.'; });
    box.appendChild(el('div', { 'class': 'campo largo' }, [el('span', { 'class': 'rot', texto: 'Mover o texto' }), setas, pos]));
    var zerar = el('button', { type: 'button', 'class': 'btn-mini' }, ['Voltar ao automático']);
    zerar.addEventListener('click', function () { if (alvo === 'todas') estado.ajustes.todas = {}; else delete estado.ajustes.porPeca[alvo]; mudou(); });
    box.appendChild(el('div', { 'class': 'campo largo' }, [zerar]));
    function resumir() {
      var r = document.querySelector('[data-secao="ajustes"] .secao-resumo'); if (!r) return;
      var n = Object.keys(estado.ajustes.todas).length + Object.keys(estado.ajustes.porPeca).filter(function (k) { return Object.keys(estado.ajustes.porPeca[k]).length; }).length;
      r.textContent = n ? 'Ajustado' : 'Automático'; r.classList.toggle('cheio', !!n);
    }
    estado.redesenharAjustes = function () { refs.forEach(function (f) { f(); }); resumir(); };
    setTimeout(estado.redesenharAjustes, 0);
    return box;
  }

  function lerDados() {
    var f = $('formulario');
    var dados = {};
    estado.formato.campos.forEach(function (c) {
      if (c.tipo === 'imagens-aprovadas') { dados[c.id] = estado.imagens.map(function (i) { return { id: i.id, x: i.x, y: i.y, zoom: i.zoom }; }); return; }
      if (c.tipo === 'noticias') { dados[c.id] = estado.noticias.map(function (n) { return Object.assign({}, n); }); return; }
      if (c.tipo === 'arquivo') return;
      if (c.tipo === 'imagens-documento') { dados[c.id] = estado.docImagens.slice(); return; }
      if (c.tipo === 'escolha') {
        var marcado = f.querySelector('input[name="' + c.id + '"]:checked');
        dados[c.id] = marcado ? marcado.value : '';
      } else {
        var e = f.elements[c.id];
        dados[c.id] = e ? e.value : '';
      }
    });
    dados.area = $('f-area') ? $('f-area').value : '';
    dados.filial = filialDe(dados.area);
    if (estado.ordem) dados.ordem = estado.ordem.slice();
    if (temAjustes() && estado.ajustes) dados.ajustes = JSON.parse(JSON.stringify(estado.ajustes));
    dados._imagensAprovadas = estado.marca.imagensAprovadas;
    dados._linguagem = estado.marca.linguagem;
    return dados;
  }

  /* Coloca dados salvos de volta no formulário (rascunho ou edição). */
  function preencher(dados) {
    var f = $('formulario');
    if (dados.ajustes && temAjustes()) { estado.ajustes = { todas: Object.assign({}, dados.ajustes.todas || {}), porPeca: JSON.parse(JSON.stringify(dados.ajustes.porPeca || {})) }; if (estado.redesenharAjustes) estado.redesenharAjustes(); }
    estado.formato.campos.forEach(function (c) {
      var v = dados[c.id];
      if (v == null) return;
      var existe = function (id) { return estado.marca.imagensAprovadas.some(function (a) { return a.id === id; }); };
      if (c.tipo === 'imagens-aprovadas') { estado.imagens = (v || []).filter(function (i) { return existe(i.id); }).map(function (i) { return Object.assign({}, i); }); if (estado.redesenharImagens) estado.redesenharImagens(); return; }
      if (c.tipo === 'imagens-documento') return; // imagens do computador não ficam no rascunho
      if (c.tipo === 'noticias') { estado.noticias = (v || []).map(function (n) { var x = Object.assign({}, n); if (x.imagem && !existe(x.imagem)) x.imagem = ''; return x; }); if (!estado.noticias.length) estado.noticias.push({ titulo: '', texto: '', linkTexto: '', link: '', imagem: '' }); if (estado.redesenharNoticias) estado.redesenharNoticias(); return; }
      if (c.tipo === 'arquivo') return;
      if (c.opcoesDe === 'paletas') { reconstruirCores(v); return; }
      if (c.tipo === 'escolha') { var r = f.querySelector('input[name="' + c.id + '"][value="' + v + '"]'); if (r) r.checked = true; if (c.id === 'campanha') reconstruirCores(); if (c.id === 'publico' && estado.sincronizarPublico) { estado.sincronizarPublico(); aplicarCondicoes(); } return; }
      var e = f.elements[c.id];
      if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: false })); }
    });
    if (dados.ordem && estado.formato.blocos) { estado.ordem = dados.ordem.slice(); if (estado.desenharOrdem) estado.desenharOrdem(); }
    aplicarCondicoes();
  }

  function resumoSecao(sec, dados) {
    var porId = {};
    estado.formato.campos.forEach(function (c) { porId[c.id] = c; });
    var partes = [];
    Array.prototype.forEach.call(sec.querySelectorAll('[data-campo]'), function (cx) {
      var id = cx.getAttribute('data-campo');
      if (id === 'ordem') {
        var padrao = estado.formato.blocos.padrao.join();
        if (estado.ordem && estado.ordem.join() !== padrao) partes.push('ordem personalizada');
        return;
      }
      var c = porId[id]; if (!c || c.tipo === 'escolha') return;
      var v = dados[id];
      if (Array.isArray(v)) {
        var q = c.tipo === 'noticias' ? v.filter(function (n) { return M.limpar(n.titulo); }).length : v.length;
        if (q) partes.push(q + (c.tipo === 'noticias' ? (q > 1 ? ' notícias' : ' notícia') : (q > 1 ? ' imagens' : ' imagem')));
        return;
      }
      v = M.limpar(M.semMarcas ? M.semMarcas(v || '') : (v || ''));
      if (!v) return;
      if (c.tipo === 'data') { var d = v.split('-'); v = d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : v; }
      if (c.tipo === 'link') v = v.replace(/^https?:\/\//, '');
      partes.push(v.length > 34 ? v.slice(0, 33) + '…' : v);
    });
    return partes;
  }

  /* Atualiza resumos, pendências e blocos vazios (roda a cada digitação). */
  function atualizarPainel(dados) {
    Array.prototype.forEach.call(document.querySelectorAll('details.secao'), function (sec) {
      if (sec.getAttribute('data-secao') === 'ajustes') return; // resumo próprio (campoAjustes)
      var p = resumoSecao(sec, dados);
      var r = sec.querySelector('.secao-resumo');
      r.textContent = p.length ? p.join(' · ') : sec.getAttribute('data-vazio');
      r.classList.toggle('cheio', p.length > 0);
    });
    if (estado.marcarVazios) estado.marcarVazios(dados);
    var faltam = [];
    if (!M.limpar($('f-solicitante').value)) faltam.push('seu nome');
    if (!$('f-area').value) faltam.push('seu setor');
    if (precisaEmail() && !emailValido($('f-email').value)) faltam.push('seu e-mail');
    estado.formato.campos.forEach(function (c) {
      if (!c.obrigatorio || c.tipo === 'escolha') return;
      var v = dados[c.id];
      var vazio = Array.isArray(v) ? !v.filter(function (n) { return n && (n.id || M.limpar(n.titulo)); }).length : !M.limpar(v || '');
      if (vazio) faltam.push(c.rotulo.toLowerCase());
    });
    var p = $('pendencias');
    p.textContent = faltam.length ? 'Falta: ' + faltam.join(', ') : 'Tudo certo para gerar';
    p.classList.toggle('ok', !faltam.length);
  }

  /* ---------- Rascunho automático (neste aparelho) ---------- */
  function salvarRascunho(dados) {
    if (!estado.formato || estado.semRascunho) return;
    var tem = estado.formato.campos.some(function (c) {
      var v = dados[c.id];
      return c.tipo !== 'escolha' && c.tipo !== 'arquivo' && (Array.isArray(v) ? v.filter(function (n) { return n && (n.id || M.limpar(n.titulo)); }).length : M.limpar(v || ''));
    });
    var limpo = {};
    estado.formato.campos.forEach(function (c) { if (c.tipo !== 'imagens-documento' && c.tipo !== 'arquivo') limpo[c.id] = dados[c.id]; });
    if (dados.ordem) limpo.ordem = dados.ordem;
    gravar(CHAVE_RASCUNHO + estado.formato.id, tem ? { quando: new Date().toISOString(), dados: limpo, edicao: estado.edicao } : null);
  }
  function recuperarRascunho() {
    var r = estado.semRascunho ? null : ler(CHAVE_RASCUNHO + estado.formato.id);
    var aviso = $('rascunho');
    aviso.hidden = true; aviso.textContent = '';
    if (!r || !r.dados) return false;
    preencher(r.dados);
    if (r.edicao) { estado.edicao = r.edicao; estado.editando = true; $('gerar-rotulo').textContent = 'Gerar nova versão'; }
    var d = new Date(r.quando);
    var hoje = new Date().toDateString() === d.toDateString();
    var quando = (hoje ? 'hoje' : d.toLocaleDateString('pt-BR')) + ', às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    aviso.appendChild(el('span', { texto: 'Recuperamos seu rascunho de ' + quando + '. ' }));
    aviso.appendChild(el('button', { type: 'button', 'class': 'link', texto: 'Começar do zero', onclick: function () { nova(); } }));
    aviso.hidden = false;
    return true;
  }

  /* ---------- Prévia ao vivo ---------- */
  var espera;
  function agendarPrevia() { clearTimeout(espera); espera = setTimeout(atualizarPrevia, 220); }

  var rodada = 0;
  /* Recorta as imagens no tamanho fixo de cada quadro (JPEG 2x). */
  async function recortar(plano) {
    var md = modelo();
    await Promise.all(imagensDoPlano(plano).map(async function (it) {
      var forma = md && md.formaImagem ? md.formaImagem(plano, it, estado.marca) : null;
      it.src = await Rc.cortar(it.arquivo, it.w, it.h, it, 2, forma);
    }));
  }

  /* A prévia usa os arquivos deste site (aparece na hora, mesmo antes de publicar);
     a peça final usa o endereço público, que funciona dentro da caixa de entrada. */
  function baseLocal() { return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, ''); }

  /* Prévia sempre inteira e na largura da coluna (encolhe no celular). */
  var LARGURA_QUADRO = 680;
  function ajustarQuadro() {
    var q = $('quadro'), palco = $('palco');
    if (palco.hidden) return;
    var doc; try { doc = q.contentDocument; } catch (e) { return; }
    if (!doc || !doc.documentElement) return;
    LARGURA_QUADRO = (formatoEfetivo() || estado.formato).quadro || 680;
    q.style.width = LARGURA_QUADRO + 'px';
    // Altura do conteúdo (o body), não da janela: senão a prévia herda a altura da peça anterior.
    var h = doc.body ? Math.max(doc.body.scrollHeight, doc.body.offsetHeight) : doc.documentElement.scrollHeight;
    var s = Math.min(1, palco.clientWidth / LARGURA_QUADRO);
    q.style.height = h + 'px';
    q.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    palco.style.height = Math.ceil(h * s) + 'px';
  }

  async function atualizarPrevia(codigo, srcs) {
    var minha = ++rodada;
    var dados = lerDados();
    if (!codigo) { atualizarPainel(dados); salvarRascunho(dados); }
    var pede = estado.formato.previaPede || ['titulo', 'texto'];
    var exemplo = !codigo && pede.some(function (k) { return !M.limpar(dados[k]); });
    if (exemplo) {
      // Prévia de exemplo: mostra o formato na hora, com textos de amostra no que ainda está vazio.
      var amostra = { titulo: 'Seu título aparece aqui', texto: 'O texto da peça aparece aqui. Escreva no formulário e a prévia muda na hora.', subtitulo: '', cabecalho: '' };
      pede.forEach(function (k) { if (!M.limpar(dados[k])) dados[k] = amostra[k] || 'Exemplo'; });
    } else if (pede.some(function (k) { return !M.limpar(dados[k]); })) {
      $('palco').hidden = true; $('vazio').hidden = false; $('decisao').textContent = ''; $('porque').textContent = ''; $('porque-caixa').hidden = true;
      $('imagens-aviso') && ($('imagens-aviso').hidden = true);
      return null;
    }
    $('moldura').classList.toggle('exemplo', !!exemplo);
    var fe0 = formatoEfetivo(dados); if (fe0 && fe0.largura) $('largura').textContent = fe0.altura ? fe0.largura + ' × ' + fe0.altura + ' px' + (fe0.dpi ? ' · sai a ' + fe0.dpi * (fe0.escalaPdf || 1) + ' dpi' : '') : fe0.largura + ' px de largura';
    var plano = decidir(dados);
    try { await recortar(plano); } catch (e) { /* segue com a imagem original */ }
    if (minha !== rodada && !codigo) return null;
    var md = modelo();
    var opcoesPrevia = { codigo: codigo || 'UNI-' + estado.formato.sigla + '-PRÉVIA', baseUrl: baseLocal() };
    // Versão local (arquivos do site + recortes embutidos): prévia e downloads de imagem, PDF e PowerPoint.
    var htmlLocal = md.render(plano, dados, estado.marca, opcoesPrevia);
    // HTML final para a caixa de entrada: endereço público e imagens do banco de imagens.
    var html = htmlLocal;
    if (codigo && exporta('html')) {
      if (srcs) imagensDoPlano(plano).forEach(function (it, i) { if (srcs[i]) it.src = srcs[i]; });
      html = md.render(plano, dados, estado.marca, { codigo: codigo, baseUrl: estado.sistema.baseUrlPublica || baseLocal() });
    }
    $('quadro').srcdoc = htmlLocal;
    $('palco').hidden = false; $('vazio').hidden = true;

    // Imagem escolhida que não entra (modelo curto): avisa no próprio campo.
    var avisoImg = $('imagens-aviso');
    if (avisoImg) {
      var semLugar = (dados.imagens || []).length > 0 && !plano.imagens;
      avisoImg.hidden = !semLugar;
      if (semLugar) {
        var arv = estado.formato.arvore || {};
        var ate = arv.variante && arv.variante.curto && arv.variante.curto.ate;
        avisoImg.textContent = 'O texto está no modelo curto' + (ate ? ' (até ' + ate + ' caracteres)' : '') + ', que não leva imagem. Escreva um pouco mais para as fotos entrarem.';
      }
    }

    var chips = $('decisao'); chips.textContent = '';
    if (plano.chips) plano.chips.forEach(function (t, i) { chips.appendChild(el('span', { 'class': i === 0 ? 'var' : null, texto: t })); });
    else {
      chips.appendChild(el('span', { 'class': 'var', texto: 'Modelo ' + plano.varianteNome }));
      chips.appendChild(el('span', { texto: plano.publico.nome }));
      chips.appendChild(el('span', { texto: 'Tema ' + plano.tema.rotulo }));
      if (plano.noticias) chips.appendChild(el('span', { texto: plano.noticias.length + (plano.noticias.length === 1 ? ' notícia' : ' notícias') }));
    }
    if (plano.imagens && !plano.chips) chips.appendChild(el('span', { texto: plano.imagens.quantidade + (plano.imagens.quantidade > 1 ? ' imagens' : ' imagem') }));
    var lista = $('porque'); lista.textContent = '';
    plano.porque.forEach(function (p) { lista.appendChild(el('li', { texto: p })); });
    $('porque-caixa').hidden = !plano.porque.length;
    return { plano: plano, html: html, htmlLocal: htmlLocal, dados: dados };
  }

  /* Na hora de gerar: envia os recortes ao Cloudflare (worker/unimed-pecas.js) para o e-mail
     ter endereços públicos. Sem banco, as imagens ficam embutidas (serve para baixar, não para disparo). */
  async function publicarImagens(codigo) {
    var dados = lerDados();
    var plano = decidir(dados);
    var lista = imagensDoPlano(plano);
    if (!lista.length) return { srcs: null, embutidas: false };
    // Imagens (PNG/JPG/PDF/PowerPoint) já levam o recorte dentro do arquivo: só o HTML precisa do banco de imagens.
    if (!exporta('html')) return { srcs: null, embutidas: false };
    await recortar(plano);
    var cfg = estado.sistema.registro || {};
    if (!R.central || !R.central(cfg)) return { srcs: null, embutidas: true };
    try {
      var srcs = await Promise.all(lista.map(function (it, i) {
        return R.enviarImagem(cfg, codigo + '/imagem-' + (i + 1) + '.jpg', Rc.paraBlob(it.src));
      }));
      return { srcs: srcs, embutidas: false };
    } catch (e) {
      return { srcs: null, embutidas: true, erro: e.message };
    }
  }

  /* ---------- Gerar e registrar ---------- */
  function mostrarMensagens(res, extras) {
    var caixa = $('mensagens'); caixa.textContent = '';
    document.querySelectorAll('.campo.com-erro').forEach(function (c) { c.classList.remove('com-erro'); var m = c.querySelector('.msg'); if (m) m.remove(); });
    var erros = res.erros.concat(extras || []);
    erros.forEach(function (e) {
      var campo = document.querySelector('.campo[data-campo="' + e.campo + '"]');
      if (campo) {
        campo.classList.add('com-erro'); campo.appendChild(el('span', { 'class': 'msg', texto: e.msg }));
        var sec = campo.closest('details'); if (sec) sec.open = true;
      }
    });
    if (erros.some(function (e) { return e.campo === 'solicitante' || e.campo === 'area'; })) { mostrarQuem(false); return; }
    if (erros.length) caixa.appendChild(el('div', { 'class': 'alerta erro', role: 'alert' }, [el('strong', { texto: 'Falta ajustar ' + erros.length + (erros.length > 1 ? ' itens' : ' item') + ':' }), el('ul', {}, erros.map(function (e) { return el('li', { texto: e.msg }); }))]));
    if (res.avisos.length) caixa.appendChild(el('div', { 'class': 'alerta aviso' }, [el('ul', {}, res.avisos.map(function (a) { return el('li', { texto: a.msg }); }))]));
    var primeiro = document.querySelector('.campo.com-erro input, .campo.com-erro textarea, .campo.com-erro select');
    if (primeiro) { mudarAba('editar'); primeiro.focus(); }
  }

  function precisaEmail() { return R.central(estado.sistema.registro || {}); }
  function emailValido(v) { return /^[^\s@<>"',;]{1,80}@[^\s@<>"',;]{1,120}\.[a-z]{2,}$/i.test(M.limpar(v || '')); }

  function proximoCodigo() {
    if (estado.editando && estado.edicao) return estado.edicao.base + '-V' + (estado.edicao.versao + 1);
    return M.gerarCodigo(estado.formato.sigla);
  }

  async function gerar(ev) {
    ev.preventDefault();
    var dados = lerDados();
    var res = M.validar(estado.formato, dados);
    var extras = [];
    var nome = M.limpar($('f-solicitante').value);
    var area = $('f-area').value;
    if (!nome) extras.push({ campo: 'solicitante', msg: 'Informe seu nome.' });
    if (!area) extras.push({ campo: 'area', msg: 'Selecione seu setor.' });
    var email = M.limpar($('f-email').value).toLowerCase();
    if (precisaEmail() && !emailValido(email)) extras.push({ campo: 'email', msg: email ? 'Confira o e-mail: ele recebe o aviso da aprovação.' : 'Informe seu e-mail corporativo para receber a aprovação.' });
    mostrarMensagens(res, extras);
    if (!res.ok || extras.length) return;

    var botao = $('gerar'); botao.disabled = true;
    var rotulo = $('gerar-rotulo'), rotuloAntes = rotulo.textContent;
    rotulo.textContent = estado.ajusteToken ? 'Gerando…' : precisaEmail() ? 'Enviando…' : 'Gerando…';
    try {
      var codigo = proximoCodigo();
      var anterior = estado.editando && estado.edicao ? (estado.edicao.ultimo || estado.ultimoCodigo || null) : null;
      var pub = await publicarImagens(codigo);
      var r = await atualizarPrevia(codigo, pub.srcs);
      var impressao = await R.hash(r.html);
      var conteudo = Object.assign({}, dados); delete conteudo._imagensAprovadas; delete conteudo._linguagem;
      estado.formato.campos.forEach(function (c) { if (c.tipo === 'imagens-documento') conteudo[c.id] = (conteudo[c.id] || []).map(function (i) { return { nome: i.nome, w: i.w, h: i.h }; }); });
      if (anterior) conteudo.versao_de = anterior;
      estado.imagensEmbutidas = pub.embutidas;
      var registro = {
        codigo: codigo,
        criado_em: new Date().toISOString(),
        nome: nome,
        area: area,
        email: email || null,
        formato: estado.formato.id,
        tema: dados.tema,
        variante: r.plano.variante || null,
        titulo: M.limpar(dados.titulo).replace(/\*+/g, ''),
        caracteres: r.plano.caracteres || 0,
        imagem: (dados.imagens || []).map(function (i) { return i.id; }).join(', ') || null,
        tem_data: !!r.plano.data,
        tem_botao: !!r.plano.botao,
        conteudo: conteudo,
        html: r.plano.kit ? modelo().render(r.plano, dados, estado.marca, { codigo: codigo, baseUrl: estado.sistema.baseUrlPublica || baseLocal(), leve: true }) : r.html,
        hash: impressao,
        versao_marca: estado.marca.versao,
        ciclo_tendencias: estado.tendencias.ciclo
      };
      var falha = null, resp = null;
      try { resp = await R.salvar(estado.sistema.registro, registro, estado.ajusteToken ? { token: estado.ajusteToken } : null); }
      catch (e) { falha = e; }
      estado.ultimoStatus = resp ? resp.status : ''; estado.ultimoT = resp ? resp.t : '';
      if (resp && resp.t && !estado.ajusteToken) A.guardarMinha({ codigo: codigo, t: resp.t, titulo: M.limpar(dados.titulo), formato: estado.formato.nome, criado_em: registro.criado_em });

      // A peça existe mesmo se o banco não respondeu: dá para copiar e baixar.
      estado.ultimoHtml = r.html; estado.ultimoHtmlLocal = r.htmlLocal; estado.ultimoPlano = r.plano; estado.ultimoDados = dados; estado.ultimoCodigo = codigo; estado.ultimoTitulo = M.limpar(dados.titulo);
      var m = /^(.*?)(?:-V(\d+))?$/.exec(codigo);
      estado.edicao = { base: m[1], versao: m[2] ? Number(m[2]) : 1, ultimo: codigo };
      estado.editando = false;
      estado.pendente = falha ? registro : null;
      guardarQuem();
      mostrarQuem(true);
      gravar(CHAVE_RASCUNHO + estado.formato.id, null);
      $('aviso-pedido').hidden = true;
      mostrarFeito(falha, !!anterior);
    } catch (e) {
      $('mensagens').appendChild(el('div', { 'class': 'alerta erro', role: 'alert', texto: 'Não consegui montar a peça (' + explicar(e) + '). Seu conteúdo continua aqui; tente de novo.' }));
    } finally { botao.disabled = false; rotulo.textContent = rotuloAntes; }
  }

  var ROTULOS = { png: 'Imagem (PNG)', jpg: 'Imagem (JPG)', pdf: 'PDF', pptx: 'PowerPoint', docx: 'Word' };
  /* Downloads permitidos para o formato (config "exportar"). HTML só onde vale (e-mail). */
  /* Kit de campanha: cada peça com os seus downloads, mais o kit inteiro num .zip. */
  var ROTULOS_KIT = { png: 'PNG', jpg: 'JPG', pdf: 'PDF', html: 'HTML' };
  function montarDownloadsKit() {
    $('acoes-html').hidden = true;
    var grupo = $('exportar-grupo'); grupo.textContent = '';
    var carro = estado.ultimoPlano.variante === 'carrossel';
    var fv = estado.ultimoPlano.variante === 'frente-verso';
    if (fv) {
      var grafica = el('button', { type: 'button', 'class': 'btn primario', 'data-exportar': 'pdf-fv' }, ['PDF frente e verso (gráfica)']);
      grafica.addEventListener('click', exportarKit);
      grupo.appendChild(grafica);
    }
    var tudo = el('button', { type: 'button', 'class': fv ? 'btn secundario' : 'btn primario', 'data-exportar': 'kit' }, [carro ? 'Baixar todos os cards (.zip)' : fv ? 'Frente e verso em imagem (.zip)' : 'Baixar o kit completo (.zip)']);
    tudo.addEventListener('click', exportarKit);
    grupo.appendChild(tudo);
    if (carro) {
      var pdfTudo = el('button', { type: 'button', 'class': 'btn secundario', 'data-exportar': 'pdf-todas' }, ['PDF com todos os cards (LinkedIn)']);
      pdfTudo.addEventListener('click', exportarKit);
      grupo.appendChild(pdfTudo);
    }
    var lista = el('ul', { 'class': 'kit-lista' });
    estado.ultimoPlano.pecas.forEach(function (p) {
      var botoes = p.exportar.map(function (t) {
        var b = el('button', { type: 'button', 'class': 'btn-mini', 'data-exportar': t, 'data-peca': p.id, 'aria-label': 'Baixar ' + p.nome + ' em ' + (ROTULOS_KIT[t] || t) }, [ROTULOS_KIT[t] || t.toUpperCase()]);
        b.addEventListener('click', exportarKit);
        return b;
      });
      lista.appendChild(el('li', {}, [
        el('div', {}, [el('b', { texto: p.nome }), el('span', { texto: p.altura ? p.largura + ' × ' + p.altura + ' px' : 'HTML responsivo, ' + p.largura + ' px' })]),
        el('div', { 'class': 'kit-botoes' }, botoes)
      ]));
    });
    grupo.appendChild(lista);
    $('exportar-titulo').textContent = carro ? 'Baixar o carrossel' : fv ? 'Baixar o flyer' : 'Baixar as peças da campanha';
    var fe0 = formatoEfetivo(estado.ultimoDados) || {};
    $('exportar-ajuda').textContent = fv ? 'Para a gráfica, use o PDF: duas páginas (frente e verso), ' + (fe0.dpi ? fe0.dpi * (fe0.escalaPdf || 1) + ' dpi, ' : '') + 'com ' + (fe0.sangria || 3) + ' mm de sangria e marcas de corte. As imagens servem para conferir ou divulgar.' : carro ? 'O .zip traz os cards numerados na ordem de publicação, para o Instagram. Para o LinkedIn, use o PDF: cada página é um card.' : 'O .zip traz todas as peças em PNG e o e-mail em HTML. As imagens saem no tamanho exato de cada canal. No HTML do e-mail baixado, a foto fica dentro do arquivo: para disparo, suba a foto na ferramenta de envio.';
    montarAltaDef(true);
  }

  /* Alta definição: dobra os pixels das peças de tamanho fixo (telas retina, telão, reaproveitamento). */
  function fatorAltaDef() { var c = $('alta-def'); return c && c.checked && !c.closest('[hidden]') ? 2 : 1; }
  function montarAltaDef(mostrar) {
    var box = $('alta-def-caixa');
    if (!box) {
      box = el('label', { 'class': 'alta-def', id: 'alta-def-caixa' }, [el('input', { type: 'checkbox', id: 'alta-def' }), el('span', {}, [el('b', { texto: 'Alta definição (2x)' }), ' · o dobro dos pixels, para telas retina, telão e reaproveitamento'])]);
      $('exportar-grupo').parentNode.insertBefore(box, $('exportar-grupo'));
    }
    box.hidden = !mostrar;
  }

  function montarDownloads() {
    var fe = formatoEfetivo(estado.ultimoDados) || estado.formato;
    if (estado.ultimoPlano && estado.ultimoPlano.kit) return montarDownloadsKit();
    var html = exporta('html');
    $('acoes-html').hidden = !html;
    var tipos = (fe.exportar || ['html', 'png', 'pdf', 'pptx']).filter(function (t) { return t !== 'html'; });
    var grupo = $('exportar-grupo'); grupo.textContent = '';
    tipos.forEach(function (t, i) {
      var b = el('button', { type: 'button', 'class': html ? 'btn-mini' : (i === 0 ? 'btn primario' : 'btn secundario'), 'data-exportar': t }, [ROTULOS[t] || t.toUpperCase()]);
      b.addEventListener('click', exportar);
      grupo.appendChild(b);
    });
    $('exportar-titulo').textContent = html ? 'Baixar para ajustes' : 'Baixar a peça';
    montarAltaDef(!!fe.largura && (tipos.indexOf('png') >= 0 || tipos.indexOf('jpg') >= 0));
    var ajuda = [];
    if (tipos.indexOf('pptx') >= 0) ajuda.push('O PowerPoint vem com os textos editáveis.');
    if (tipos.indexOf('docx') >= 0) ajuda.push('O Word vem no padrão, com a tabela de cabeçalho em todas as páginas.');
    if (tipos.indexOf('png') >= 0 || tipos.indexOf('jpg') >= 0) ajuda.push(fe.largura ? 'A imagem sai em ' + fe.largura + ' × ' + fe.altura + ' px (ou o dobro, em alta definição). PNG sem perda; JPG com qualidade máxima.' : 'A imagem e o PDF saem iguais à prévia.');
    if (fe.dpi) ajuda.push('Resolução de ' + fe.dpi + ' dpi.');
    $('exportar-ajuda').textContent = ajuda.join(' ');
  }

  function mostrarFeito(falha, versao) {
    montarDownloads();
    var central = R.central(estado.sistema.registro || {});
    // Com aprovação: os arquivos só saem depois que o Marketing aprova.
    var bloqueado = central && (!!falha || estado.ultimoStatus === 'aguardando');
    $('baixar-area').hidden = bloqueado;
    montarStatus(falha);
    $('codigo').textContent = estado.ultimoCodigo;
    var st = estado.ultimoStatus;
    $('feito-titulo').textContent = falha ? (central ? 'Peça ainda não foi enviada' : 'Peça pronta, ainda sem registro')
      : st === 'aguardando' ? (versao ? 'Nova versão enviada para aprovação' : 'Peça enviada para aprovação')
      : st === 'aprovada' ? (estado.ajusteToken ? 'Versão ajustada e aprovada' : 'Peça aprovada')
      : versao ? 'Nova versão registrada' : 'Peça registrada';
    $('feito-texto').textContent = falha
      ? (central ? 'Ela ainda não chegou ao Marketing. Tente enviar de novo; seu conteúdo continua aqui.' : 'Você já pode copiar e baixar. O código só vale como oficial depois do registro.')
      : st === 'aguardando' ? 'O Marketing vai conferir. Quando aprovar, você recebe um e-mail' + (M.limpar($('f-email').value) ? ' em ' + M.limpar($('f-email').value) : '') + ' com o link para baixar a versão oficial.'
      : st === 'aprovada' && estado.ajusteToken ? 'A versão anterior foi substituída. Avise quem pediu: o e-mail já sai escrito, com o link para baixar.'
      : st === 'aprovada' && estado.pedidoLink ? 'Esta é a versão oficial. Baixe nos formatos abaixo.'
      : versao ? 'A versão anterior continua guardada no painel. Use este código daqui pra frente.' : 'Guarde esse código. Ele identifica esta versão oficial da peça no painel.';
    $('pendente').hidden = !falha;
    if (falha) $('pendente-texto').textContent = 'Não consegui registrar no painel agora (' + explicar(falha) + ').';
    $('tentar').textContent = central ? 'Enviar de novo' : 'Tentar registrar de novo';
    var local = !R.central(estado.sistema.registro || {});
    $('copiado').textContent = !estado.imagensEmbutidas ? '' : local
      ? 'Modo de teste: as imagens ficaram embutidas no arquivo. Servem para baixar e ajustar; para disparo, use o site publicado.'
      : 'Atenção: o banco de imagens não respondeu e as imagens ficaram embutidas no arquivo. Servem para baixar e ajustar, mas podem não aparecer no disparo do e-mail.';
    $('formulario').hidden = true;
    $('feito').hidden = false;
    mudarAba('editar');
    $('feito').scrollIntoView({ block: 'start', behavior: 'smooth' });
    var primeiro = bloqueado ? null : exporta('html') ? $('copiar') : $('exportar-grupo').querySelector('button');
    if (primeiro) primeiro.focus({ preventScroll: true });
    // Peça aberta pelo link e já aprovada: não tem "nova versão" a partir daqui.
    $('editar').hidden = !!(estado.pedidoLink && estado.pedidoLink.soBaixar);
  }

  /* Situação da peça no cartão final: link para acompanhar, aviso para o Marketing mandar o e-mail. */
  function montarStatus(falha) {
    var caixa = $('status-pedido'); caixa.textContent = '';
    var t = estado.ultimoT, st = estado.ultimoStatus;
    if (falha || !t) { caixa.hidden = true; return; }
    var link = A.link(estado.sistema, estado.ultimoCodigo, t);
    var info = A.status(st);
    caixa.appendChild(el('p', { 'class': 'situacao-linha' }, [el('span', { 'class': 'selo ' + info.classe, texto: info.nome })]));
    if (estado.ajusteToken && st === 'aprovada') {
      var p = estado.pedidoLink && estado.pedidoLink.p || {};
      var m = A.mensagem({ nome: M.limpar($('f-solicitante').value), email: M.limpar($('f-email').value), titulo: estado.ultimoTitulo, codigo: estado.ultimoCodigo, formatoNome: estado.formato.nome },
        { status: 'aprovada', ajustada: true, link: link, quem: lerSessaoPainel().nome || '' });
      caixa.appendChild(el('div', { 'class': 'acoes' }, [
        el('a', { 'class': 'btn primario', href: A.mailto(m) }, ['Avisar ' + ((p.nome || '').split(/\s+/)[0] || 'quem pediu') + ' pelo Outlook']),
        el('a', { 'class': 'link', href: 'painel.html' }, ['Voltar ao painel'])
      ]));
      return;
    }
    if (st === 'aguardando') {
      var copiarLink = el('button', { type: 'button', 'class': 'btn-mini', onclick: function () {
        navigator.clipboard.writeText(link).then(function () { $('copiado').textContent = 'Link copiado.'; }).catch(function () { $('copiado').textContent = link; });
      } }, ['Copiar link de acompanhamento']);
      caixa.appendChild(el('p', { 'class': 'ajuda', texto: 'Você também acompanha a situação em "Suas peças", na tela inicial deste aparelho, ou por este link:' }));
      caixa.appendChild(el('div', { 'class': 'acoes' }, [el('a', { 'class': 'btn-mini', href: link }, ['Abrir acompanhamento']), copiarLink]));
    }
    caixa.hidden = false;
  }

  function lerSessaoPainel() {
    try { var s = JSON.parse(localStorage.getItem('unimed-sessao-painel-v1') || 'null'); return s && s.token && (!s.expira || s.expira > Date.now()) ? s : {}; } catch (e) { return {}; }
  }

  /* ---------- Campanhas do ano: atalho para o kit já com a campanha escolhida ---------- */
  function montarCampanhas() {
    var cs = estado.campanhas || {}, lista = cs.lista || [];
    var kit = estado.indice.formatos.filter(function (f) { return f.id === 'campanha-kit' && f.ativo; })[0];
    if (!lista.length || !kit) return;
    var P = (estado.tendencias.keyArt && estado.tendencias.keyArt.paleta) || {};
    $('campanhas-guarda').textContent = cs.guardaChuva ? '· guarda-chuva ' + cs.guardaChuva.nome : '';
    var caixa = $('campanhas-cards');
    lista.forEach(function (c) {
      var cor = P[c.destaque] || estado.marca.cores[c.destaque] || estado.marca.cores.citrico;
      caixa.appendChild(el('button', { type: 'button', 'class': 'campanha-card', style: '--cor:' + cor, onclick: async function () {
        await escolher(kit);
        preencher({ publico: (c.linhas || []).indexOf('externa') >= 0 ? 'Campanha externa' : 'Campanha interna', campanha: c.nome });
        aplicarCondicoes(); atualizarPrevia();
      } }, [
        el('span', { 'class': 'campanha-nome', texto: c.nome }),
        el('span', { 'class': 'campanha-info', texto: (c.periodo || '') + (c.aguardandoMaterial ? ' · visual provisório' : '') }),
        el('span', { 'class': 'campanha-acao', texto: 'Criar kit da campanha →' })
      ]));
    });
    $('campanhas-ano').hidden = false;
  }

  /* ---------- Peça aberta pelo link (?pedido=CÓDIGO&t=CHAVE) ---------- */
  async function abrirPedidoDoLink() {
    var q = new URLSearchParams(location.search);
    var codigo = (q.get('pedido') || '').toUpperCase(), t = q.get('t') || '';
    if (!codigo || !t) return false;
    var ajuste = q.get('ajuste') === '1';
    $('boasvindas').hidden = true; $('busca').hidden = false;
    var falhou = function (msg) {
      $('busca').insertBefore(el('div', { 'class': 'alerta erro', role: 'alert', texto: msg }), $('busca').querySelector('.combo'));
      mostrarQuem(true);
    };
    var p;
    try { p = await R.consultar(estado.sistema.registro, codigo, t); }
    catch (e) { falhou('Não consegui abrir a peça ' + codigo + ': ' + e.message); return true; }
    var f = estado.indice.formatos.filter(function (x) { return x.id === p.formato; })[0];
    if (!f) { falhou('O formato dessa peça não está mais disponível.'); return true; }
    var sessao = ajuste ? lerSessaoPainel() : {};
    if (ajuste && !sessao.token) { ajuste = false; }
    estado.ajusteToken = ajuste ? sessao.token : '';
    estado.pedidoLink = { codigo: codigo, t: t, status: p.status, ajuste: ajuste, p: p };
    // Quem pediu: no ajuste, os dados são da pessoa que pediu (não mexe no "quem" deste aparelho).
    if (ajuste || !M.limpar($('f-solicitante').value)) {
      $('f-solicitante').value = p.nome || ''; $('f-area').value = p.area || ''; $('f-email').value = p.email || '';
      if (!ajuste) guardarQuem();
    }
    if (!M.limpar($('f-email').value) && p.email) $('f-email').value = p.email;
    estado.semRascunho = true;
    await escolher(f);
    preencher(p.conteudo || {});
    // Uma nova versão a partir daqui continua a numeração (…-V2, -V3).
    var ref = p.versao_nova || codigo;
    var m = /^(.*?)(?:-V(\d+))?$/.exec(ref);
    estado.edicao = { base: m[1], versao: m[2] ? Number(m[2]) : 1, ultimo: codigo };
    estado.editando = true;
    mostrarQuem(true);
    if (p.status !== 'aprovada' || ajuste) atualizarPrevia();
    var faltaFoto = (p.conteudo && (p.conteudo.imagens || []).some(function (i) { return /^enviada-/.test(i.id); })) ||
      estado.formato.campos.some(function (c) { return c.tipo === 'imagens-documento' && ((p.conteudo || {})[c.id] || []).length; });
    var aviso = $('aviso-pedido'); aviso.textContent = ''; aviso.className = 'aviso-pedido';
    var st = A.status(p.status);
    var linha = function (filhos) { aviso.appendChild(el('p', {}, filhos)); };
    aviso.appendChild(el('p', { 'class': 'situacao-linha' }, [el('span', { 'class': 'selo ' + st.classe, texto: st.nome }), ' ' + codigo + (p.decidido_por ? ' · ' + p.decidido_por : '')]));
    if (ajuste) {
      aviso.classList.add('ajuste');
      linha([el('b', { texto: 'Modo ajuste do Marketing. ' }), 'Peça de ' + (p.nome || '—') + ' (' + (p.area || '—') + '). Ajuste o que precisar e gere: a nova versão já sai aprovada e o e-mail para quem pediu fica pronto.']);
      $('gerar-rotulo').textContent = 'Gerar versão aprovada';
    } else if (p.status === 'reprovada') {
      aviso.classList.add('reprovada');
      linha([el('b', { texto: 'O Marketing pediu ajustes: ' }), p.observacao || '']);
      linha(['Corrija abaixo e clique em "Enviar nova versão". Ela substitui esta.']);
      $('gerar-rotulo').textContent = 'Enviar nova versão';
    } else if (p.status === 'aguardando') {
      linha(['Esta peça está em análise pelo Marketing. Se quiser mudar algo, edite e envie de novo: a nova versão substitui esta.']);
      $('gerar-rotulo').textContent = 'Enviar nova versão';
    } else if (p.status === 'substituida') {
      linha(['Esta versão foi substituída' + (p.versao_nova ? ' pela ' + p.versao_nova : '') + '. Use o link do e-mail mais recente.']);
      $('gerar-rotulo').textContent = 'Enviar nova versão';
    }
    if (faltaFoto && p.status !== 'aprovada') linha([el('b', { texto: 'Atenção: ' }), 'as fotos enviadas do computador não ficam guardadas. Envie de novo antes de gerar.']);
    aviso.hidden = false;

    if (p.status === 'aprovada' && !ajuste) {
      // Aprovada: mostra direto os downloads da versão oficial, sem registrar de novo.
      estado.pedidoLink.soBaixar = true;
      var r = await atualizarPrevia(codigo);
      if (!r) { falhou('Não consegui montar a peça aprovada.'); return true; }
      var oficial = p.html && !r.plano.kit ? p.html : '';
      if (oficial) $('quadro').srcdoc = oficial;
      estado.ultimoHtml = oficial || r.html; estado.ultimoHtmlLocal = oficial || r.htmlLocal;
      estado.ultimoPlano = r.plano; estado.ultimoDados = lerDados(); estado.ultimoCodigo = codigo; estado.ultimoTitulo = p.titulo || M.limpar(estado.ultimoDados.titulo);
      estado.ultimoStatus = 'aprovada'; estado.ultimoT = '';
      estado.imagensEmbutidas = false;
      mostrarFeito(null, false);
      if (p.observacao) $('feito-texto').textContent += ' Observação do Marketing: ' + p.observacao;
      if (r.plano.kit && faltaFoto) $('copiado').textContent = 'Atenção: a foto enviada do computador não fica guardada. Se ela não aparecer nas peças, peça ao Marketing o arquivo.';
    }
    return true;
  }

  async function tentarDeNovo() {
    if (!estado.pendente) return;
    var b = $('tentar'); b.disabled = true; b.textContent = 'Tentando…';
    try {
      var resp = await R.salvar(estado.sistema.registro, estado.pendente, { soBanco: true, token: estado.ajusteToken || '' });
      estado.ultimoStatus = resp.status; estado.ultimoT = resp.t;
      if (resp.t && !estado.ajusteToken) A.guardarMinha({ codigo: estado.pendente.codigo, t: resp.t, titulo: estado.pendente.titulo, formato: estado.formato.nome, criado_em: estado.pendente.criado_em });
      estado.pendente = null;
      mostrarFeito(null, false);
    } catch (e) {
      $('pendente-texto').textContent = 'Ainda não consegui registrar (' + explicar(e) + '). Tente de novo em alguns minutos.';
    } finally { b.disabled = false; b.textContent = 'Tentar registrar de novo'; }
  }

  function mostrarFormulario() {
    $('formulario').hidden = false;
    $('feito').hidden = true;
    $('mensagens').textContent = '';
  }

  /* Volta ao formulário com tudo preenchido; ao gerar, vira uma nova versão. */
  function editar() {
    estado.editando = true;
    $('gerar-rotulo').textContent = 'Gerar nova versão';
    mostrarFormulario();
    atualizarPrevia();
    var t = $('f-titulo'); if (t) { t.focus({ preventScroll: true }); }
    $('formulario').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function baixar() {
    var blob = new Blob([estado.ultimoHtml], { type: 'text/html' });
    var a = el('a', { href: URL.createObjectURL(blob), download: estado.ultimoCodigo + '.html' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function copiar() {
    navigator.clipboard.writeText(estado.ultimoHtml).then(function () { $('copiado').textContent = 'Código copiado. Cole na sua ferramenta de disparo.'; })
      .catch(function () { $('copiado').textContent = 'Não consegui copiar automaticamente. Use "Baixar HTML".'; });
  }
  async function exportar(ev) {
    var tipo = ev.currentTarget.getAttribute('data-exportar');
    var botoes = document.querySelectorAll('[data-exportar]');
    var aviso = $('copiado');
    var nomes = { png: 'a imagem', jpg: 'a imagem', pdf: 'o PDF', pptx: 'o PowerPoint', docx: 'o Word' };
    var feito = { png: 'A imagem foi baixada.', jpg: 'A imagem foi baixada.', pdf: 'O PDF foi baixado.', docx: 'O Word foi baixado. A tabela de cabeçalho se repete em todas as páginas.' };
    botoes.forEach(function (b) { b.disabled = true; });
    aviso.textContent = 'Preparando ' + nomes[tipo] + '…';
    try {
      var fe = formatoEfetivo(estado.ultimoDados) || estado.formato;
      var info = {
        codigo: estado.ultimoCodigo, fonte: estado.marca.tipografia.familiaExportacao,
        largura: fe.quadro || 680,
        escala: (fe.escalaImagem || 2) * fatorAltaDef(),
        escalaPdf: fe.escalaPdf || null,
        sangria: fe.sangria || 0,
        dpi: fe.dpi || null
      };
      if (tipo === 'docx') {
        await window.UnimedExportar.carregar('pptx'); // traz o JSZip
        var blob = await modelo().docx(estado.ultimoPlano, estado.ultimoDados, estado.marca, { baseUrl: baseLocal(), codigo: estado.ultimoCodigo });
        await window.UnimedExportar.arquivo(blob, estado.ultimoCodigo + '.docx');
      } else {
        await window.UnimedExportar[tipo](estado.ultimoHtmlLocal || estado.ultimoHtml, estado.ultimoCodigo + (fatorAltaDef() > 1 && tipo !== 'pdf' ? '@2x' : ''), info);
      }
      aviso.textContent = tipo === 'pptx' ? 'PowerPoint baixado. Os textos podem ser editados; o código da peça continua no rodapé.' : feito[tipo];
    } catch (e) {
      aviso.textContent = 'Não consegui gerar ' + nomes[tipo] + ': ' + e.message;
    } finally { botoes.forEach(function (b) { b.disabled = false; }); }
  }

  async function exportarKit(ev) {
    var tipo = ev.currentTarget.getAttribute('data-exportar');
    var qual = ev.currentTarget.getAttribute('data-peca');
    var botoes = document.querySelectorAll('[data-exportar]');
    var aviso = $('copiado');
    var E = window.UnimedExportar;
    var pecas = modelo().pecasHtml(estado.ultimoPlano, estado.ultimoDados, estado.marca, { codigo: estado.ultimoCodigo, baseUrl: baseLocal() });
    var nomeArq = function (p, ext) { return estado.ultimoCodigo + '-' + p.id + (p.altura ? '-' + p.largura + 'x' + p.altura : '') + (p.altura && fatorAltaDef() > 1 ? '@2x' : '') + '.' + ext; };
    var fe = formatoEfetivo(estado.ultimoDados) || {};
    // Impressos (flyer frente e verso): mesma resolução, sangria e marcas de corte da peça única.
    var impresso = fe.dpi ? { escala: (fe.escalaImagem || 2) * fatorAltaDef(), escalaPdf: fe.escalaPdf || null, sangria: fe.sangria || 0, dpi: fe.dpi } : {};
    var info = function (p, extra) { return Object.assign({ codigo: estado.ultimoCodigo, fonte: estado.marca.tipografia.familiaExportacao, largura: p.tipo === 'email' ? 680 : p.largura, escala: p.tipo === 'email' ? 2 : fatorAltaDef() }, impresso, extra || {}); };
    botoes.forEach(function (b) { b.disabled = true; });
    try {
      if (tipo === 'kit') {
        await E.carregar('pptx'); // traz o JSZip
        var zip = new window.JSZip();
        for (var i = 0; i < pecas.length; i++) {
          var p = pecas[i];
          aviso.textContent = 'Preparando o kit: ' + p.nome + ' (' + (i + 1) + ' de ' + pecas.length + ')…';
          zip.file(nomeArq(p, 'png'), await E.png(p.html, nomeArq(p, 'png'), info(p, { blob: true })));
          if (p.tipo === 'email') zip.file(nomeArq(p, 'html'), p.html);
        }
        aviso.textContent = 'Compactando…';
        var blob = await zip.generateAsync({ type: 'blob' });
        await E.arquivo(blob, estado.ultimoCodigo + '-kit.zip');
        aviso.textContent = 'Kit baixado: ' + pecas.length + ' peças.';
        return;
      }
      if (tipo === 'pdf-fv') {
        aviso.textContent = 'Preparando o PDF da gráfica (frente e verso)…';
        await E.pdf(pecas.map(function (x) { return x.html; }), estado.ultimoCodigo + '-frente-verso', info(pecas[0]));
        aviso.textContent = 'PDF baixado: frente e verso, com sangria e marcas de corte.';
        return;
      }
      if (tipo === 'pdf-todas') {
        await E.carregar('jspdf');
        var J = window.jspdf.jsPDF, doc = null;
        for (var k = 0; k < pecas.length; k++) {
          var pk = pecas[k];
          aviso.textContent = 'Preparando o PDF: ' + pk.nome + ' (' + (k + 1) + ' de ' + pecas.length + ')…';
          var bl = await E.png(pk.html, nomeArq(pk, 'png'), info(pk, { blob: true }));
          var url = await new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(bl); });
          if (!doc) doc = new J({ orientation: 'portrait', unit: 'px', format: [pk.largura, pk.altura], hotfixes: ['px_scaling'], compress: true });
          else doc.addPage([pk.largura, pk.altura], 'portrait');
          doc.addImage(url, 'PNG', 0, 0, pk.largura, pk.altura);
        }
        await E.arquivo(doc.output('blob'), estado.ultimoCodigo + '-carrossel.pdf');
        aviso.textContent = 'PDF baixado: ' + pecas.length + ' páginas, uma por card.';
        return;
      }
      var p2 = pecas.filter(function (x) { return x.id === qual; })[0];
      if (!p2) throw new Error('peça não encontrada');
      aviso.textContent = 'Preparando ' + p2.nome + '…';
      if (tipo === 'html') await E.arquivo(new Blob([p2.html], { type: 'text/html' }), nomeArq(p2, 'html'));
      else await E[tipo](p2.html, nomeArq(p2, tipo).replace(/\.[a-z]+$/, ''), info(p2));
      aviso.textContent = p2.nome + ' baixado.';
    } catch (e) {
      aviso.textContent = 'Não consegui gerar o download: ' + e.message;
    } finally { botoes.forEach(function (b) { b.disabled = false; }); }
  }

  function nova() {
    gravar(CHAVE_RASCUNHO + estado.formato.id, null);
    var email = $('f-email').value;
    $('formulario').reset();
    $('f-email').value = email;
    estado.edicao = null; estado.editando = false; estado.pendente = null; estado.docImagens = [];
    sairDoLink();
    $('gerar-rotulo').textContent = 'Gerar peça';
    $('rascunho').hidden = true;
    mostrarFormulario();
    montarFormulario(); atualizarPrevia();
    var t = $('f-titulo'); if (t) t.focus({ preventScroll: true });
  }

  /* Começar outra peça depois de abrir um link: volta ao "quem" deste aparelho e limpa o endereço. */
  function sairDoLink() {
    if (!estado.pedidoLink) return;
    var eraAjuste = !!estado.ajusteToken;
    estado.pedidoLink = null; estado.ajusteToken = ''; estado.semRascunho = false;
    $('aviso-pedido').hidden = true;
    if (history.replaceState) history.replaceState(null, '', location.pathname);
    if (eraAjuste) { var q = ler(CHAVE_QUEM) || {}; $('f-solicitante').value = q.nome || ''; $('f-area').value = q.area || ''; $('f-email').value = q.email || ''; mostrarQuem(true); }
  }

  /* ---------- Abas Editar | Prévia (telas estreitas) ---------- */
  function mudarAba(qual) {
    var previa = qual === 'previa';
    $('trabalho').classList.toggle('ver-previa', previa);
    $('aba-editar').setAttribute('aria-selected', String(!previa));
    $('aba-previa').setAttribute('aria-selected', String(previa));
    $('aba-editar').tabIndex = previa ? -1 : 0;
    $('aba-previa').tabIndex = previa ? 0 : -1;
    var topo = $('trabalho').getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > topo) window.scrollTo(0, topo);
    if (previa) requestAnimationFrame(ajustarQuadro);
  }

  /* ---------- Início ---------- */
  async function iniciar() {
    try {
      var r = await Promise.all([json('config/marca.json'), json('config/tendencias.json'), json('config/sistema.json'), json('config/formatos/indice.json'), json('config/campanhas.json').catch(function () { return { lista: [] }; })]);
      estado.marca = r[0]; estado.tendencias = r[1]; window.UnimedTendencias = r[1]; estado.sistema = r[2]; estado.indice = r[3];
      // Campanhas do ano: os modelos leem junto das tendências (a Key Art se ajusta à campanha escolhida).
      estado.campanhas = r[4]; estado.tendencias.campanhasTematicas = r[4];
    } catch (e) {
      $('busca').appendChild(el('div', { 'class': 'alerta erro', role: 'alert', texto: 'Não consegui carregar as regras da marca (' + e.message + '). Abra pelo endereço do site, não direto do arquivo.' }));
      return;
    }
    if (MODO_TESTE) {
      var testadas = Object.keys(regrasTeste());
      document.body.classList.add('modo-teste');
      $('busca').insertBefore(el('div', { 'class': 'alerta aviso faixa-teste', role: 'status' }, [
        el('b', { texto: 'Modo teste. ' }),
        testadas.length ? 'Você está vendo as regras propostas pelo assistente (' + testadas.join(', ') + '), ainda não publicadas. ' : 'Nenhuma regra em teste neste navegador. ',
        el('a', { href: 'index.html', texto: 'Sair do teste' })
      ]), $('busca').firstChild);
    }
    var area = $('f-area');
    // Setores reais, agrupados por filial (marca.json → setores). Sem a lista, usa as áreas antigas.
    var lista = (estado.marca.setores && estado.marca.setores.lista) || [];
    var validos = [];
    if (lista.length) {
      var grupos = {};
      lista.forEach(function (st) {
        if (!grupos[st.filial]) { grupos[st.filial] = el('optgroup', { label: st.filial }); area.appendChild(grupos[st.filial]); }
        grupos[st.filial].appendChild(el('option', { value: st.nome, texto: st.nome }));
        validos.push(st.nome);
      });
    } else {
      estado.marca.areas.forEach(function (a) { area.appendChild(el('option', { value: a, texto: a })); validos.push(a); });
    }
    var quem = ler(CHAVE_QUEM);
    if (quem) { $('f-solicitante').value = quem.nome || ''; if (validos.indexOf(quem.area) >= 0) area.value = quem.area; $('f-email').value = quem.email || ''; }
    $('email-caixa').hidden = !precisaEmail();
    $('form-quem').addEventListener('submit', continuarBoasVindas);
    $('quem-trocar').addEventListener('click', function () { mostrarQuem(false); });
    $('ola-trocar').addEventListener('click', function () { mostrarQuem(false); });
    $('f-email').addEventListener('change', guardarQuem);

    // Atalhos: os formatos ativos primeiro e em destaque; "em breve" apagados.
    var atalhos = $('atalhos');
    var ordenados = estado.indice.formatos.slice().sort(function (a, b) { return (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0); });
    // Nuvem de palavras: tamanhos e cores da paleta variando (os principais maiores), sempre legível.
    var ESTILOS = ['n-petroleo', 'n-citrico', 'n-institucional', 'n-azul', 'n-areia', 'n-verde', 'n-amarelo', 'n-contorno', 'n-rosa'];
    var TAMANHOS = ['t3', 't1', 't2', 't1', 't3', 't2', 't1', 't2'];
    atalhos.classList.add('nuvem');
    ordenados.filter(function (f) { return f.ativo; }).forEach(function (f, i) {
      var tam = i < 2 ? 't4' : TAMANHOS[i % TAMANHOS.length];
      var nome = f.nome.replace(/^Praia Clube · /, '');
      var b = el('button', { type: 'button', 'class': 'ativo ' + ESTILOS[i % ESTILOS.length] + ' ' + tam, title: f.nome + (f.grupo ? ' · ' + f.grupo : ''), onclick: function () { escolher(f); } }, [
        /^Praia Clube/.test(f.nome) ? el('small', { texto: 'Praia Clube' }) : null, nome
      ]);
      atalhos.appendChild(b);
    });

    montarCampanhas();

    var busca = $('formato-busca');
    busca.addEventListener('focus', mostrarLista);
    busca.addEventListener('input', function () { ativoIdx = -1; mostrarLista(); });
    busca.addEventListener('blur', function () { setTimeout(fecharLista, 120); });
    busca.addEventListener('keydown', function (e) {
      var itens = filtrar(busca.value);
      if (e.key === 'ArrowDown') { e.preventDefault(); ativoIdx = Math.min(itens.length - 1, ativoIdx + 1); mostrarLista(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativoIdx = Math.max(0, ativoIdx - 1); mostrarLista(); }
      else if (e.key === 'Enter') { e.preventDefault(); var f = itens[ativoIdx >= 0 ? ativoIdx : 0]; if (f) escolher(f); }
      else if (e.key === 'Escape') fecharLista();
    });

    $('formulario').addEventListener('input', agendarPrevia);
    $('formulario').addEventListener('change', agendarPrevia);
    // Trocar o público pode mudar o quadro da foto (campanha): redesenha o enquadramento.
    $('formulario').addEventListener('change', function (e) {
      if (!e.target || e.target.type !== 'radio') return;
      aplicarCondicoes();
      if (e.target.name === 'tema' && estado.reordenarBanco) estado.reordenarBanco();
      if (e.target.name === 'campanha') reconstruirCores();
      if ((e.target.name === 'publico' || e.target.name === 'tamanho' || e.target.name === 'ladoFoto') && estado.redesenharImagens) estado.redesenharImagens();
    });
    $('formulario').addEventListener('submit', gerar);
    $('trocar').addEventListener('click', function () { $('trabalho').hidden = true; $('busca').classList.remove('compacta'); busca.value = ''; busca.focus(); });
    $('baixar').addEventListener('click', baixar);
    $('copiar').addEventListener('click', copiar);
    $('nova').addEventListener('click', nova);
    $('editar').addEventListener('click', editar);
    $('tentar').addEventListener('click', tentarDeNovo);

    $('aba-editar').addEventListener('click', function () { mudarAba('editar'); });
    $('aba-previa').addEventListener('click', function () { mudarAba('previa'); });
    $('aba-editar').parentNode.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var previa = !$('trabalho').classList.contains('ver-previa');
      mudarAba(previa ? 'previa' : 'editar');
      $(previa ? 'aba-previa' : 'aba-editar').focus();
    });
    $('quadro').addEventListener('load', ajustarQuadro);
    // A cartilha pagina depois de carregar as fontes: reajusta a altura da prévia.
    window.addEventListener('message', function (e) { if (e.data && e.data.tipo === 'unimed-paginado') ajustarQuadro(); });
    window.addEventListener('resize', ajustarQuadro);

    // Link de acompanhamento/aprovação? Abre a peça. Senão: nome e setor primeiro, depois a busca.
    if (!(await abrirPedidoDoLink())) {
      if (M.limpar($('f-solicitante').value) && $('f-area').value) { $('busca').hidden = false; mostrarQuem(true); mostrarMinhas(); }
      else mostrarQuem(false);
    }
  }
  iniciar();
})();
