/* ============================================================
   Gerador de peças · tela de uso
   Lê as regras (config/), monta o formulário do formato, mostra
   a prévia ao vivo e registra cada peça gerada.
   ============================================================ */
(function () {
  'use strict';
  var M = window.UnimedMotor;
  var R = window.UnimedRegistro;
  var $ = function (id) { return document.getElementById(id); };

  var Rc = window.UnimedRecorte;
  var estado = { marca: null, tendencias: null, sistema: null, indice: null, formato: null, ultimoHtml: '', ultimoCodigo: '', ultimoTitulo: '', imagens: [], ordem: null };
  var LARGOS = { publico: 1, cabecalho: 1, tema: 1, titulo: 1, subtitulo: 1, texto: 1, imagens: 1, local: 1, ordem: 1 };

  async function json(caminho) {
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
    montarFormulario();
    $('busca').classList.add('compacta');
    $('trabalho').hidden = false;
    $('feito').hidden = true;
    $('formulario').hidden = false;
    $('titulo-formato').textContent = estado.formato.nome;
    $('largura').textContent = estado.formato.largura ? estado.formato.largura + ' px de largura' : '';
    atualizarPrevia();
    var primeiro = $('campos').querySelector('input, textarea, select');
    if (primeiro) primeiro.focus();
  }

  /* ---------- Formulário a partir das regras ---------- */
  function contador(c, entrada) {
    if (!c.max) return null;
    var s = el('span', { 'class': 'cont', 'aria-live': 'polite' });
    function at() { var n = M.contar(entrada.value); s.textContent = n + '/' + c.max; s.classList.toggle('estourou', n > c.max); }
    entrada.addEventListener('input', at); at();
    return s;
  }

  function montarCampo(c) {
    var id = 'f-' + c.id;
    var caixa = el('div', { 'class': 'campo' + (LARGOS[c.id] ? ' largo' : ''), 'data-campo': c.id });
    var rotulo = el('label', { 'for': id }, [el('span', {}, [c.rotulo + ' ', c.obrigatorio ? null : el('span', { 'class': 'opc', texto: '(opcional)' })])]);
    var entrada;

    if (c.tipo === 'escolha') {
      var grupo = el('div', { 'class': 'temas', role: 'radiogroup', 'aria-labelledby': id + '-r' });
      rotulo = el('span', { id: id + '-r', 'class': 'rot', style: 'font-weight:700;font-size:14px;color:#1d1d1b' }, [c.rotulo]);
      if (c.descricoes) grupo.classList.add('com-descricao');
      c.opcoes.forEach(function (op, i) {
        var tema = c.id === 'tema' ? estado.formato.temas[op] : null;
        var miolo = tema
          ? [el('i', { style: 'background:' + estado.marca.cores[tema.faixa] }), op]
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
    if (c.tipo === 'texto-longo') entrada = el('textarea', { id: id, name: c.id, rows: 8 });
    else entrada = el('input', { id: id, name: c.id, type: c.tipo === 'data' ? 'date' : c.tipo === 'hora' ? 'time' : c.tipo === 'link' ? 'url' : 'text', placeholder: c.tipo === 'link' ? 'https://' : '' });
    var cont = contador(c, entrada);
    if (cont) rotulo.appendChild(cont);
    caixa.appendChild(rotulo);
    if (c.formatacao && window.UnimedFormatacao) caixa.appendChild(window.UnimedFormatacao.barra(entrada, realcesResolvidos()));
    caixa.appendChild(entrada);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    return caixa;
  }

  function realcesResolvidos() {
    var cores = estado.marca.cores;
    return ((estado.formato.formatacao && estado.formato.formatacao.realces) || []).map(function (r) {
      return { id: r.id, nome: r.nome, fundo: cores[r.cor] || r.cor, texto: cores[r.texto] || r.texto };
    });
  }

  /* ---------- Imagens: até 3, escolha na biblioteca e ajuste do enquadramento ---------- */
  function slotsPara(qtd) {
    var lay = estado.formato.arvore.imagem.layouts || {};
    return lay[String(qtd)] || [];
  }

  function campoImagens(c, caixa, id) {
    var limite = c.limite || 3;
    var rotulo = el('span', { id: id + '-r', style: 'font-weight:700;font-size:14px;color:#1d1d1b' }, [c.rotulo + ' ', el('span', { 'class': 'opc', texto: '(até ' + limite + ', da biblioteca aprovada)' })]);
    var grade = el('div', { 'class': 'imagens multi', role: 'group', 'aria-labelledby': id + '-r' });
    var ajustes = el('div', { 'class': 'ajustes-imagem', 'aria-live': 'polite' });

    function redesenhar() {
      var sel = estado.imagens.map(function (i) { return i.id; });
      grade.querySelectorAll('label').forEach(function (lb) {
        var cb = lb.querySelector('input');
        var pos = sel.indexOf(cb.value);
        cb.checked = pos >= 0;
        cb.disabled = pos < 0 && sel.length >= limite;
        var n = lb.querySelector('.ordem-n');
        n.textContent = pos >= 0 ? String(pos + 1) : '';
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

    estado.marca.imagensAprovadas.forEach(function (img) {
      var cb = el('input', { type: 'checkbox', name: c.id, value: img.id, 'aria-label': img.descricao });
      cb.addEventListener('change', function () {
        if (cb.checked) estado.imagens.push({ id: img.id, x: 0.5, y: 0.5, zoom: 1 });
        else estado.imagens = estado.imagens.filter(function (i) { return i.id !== img.id; });
        redesenhar(); agendarPrevia();
      });
      grade.appendChild(el('label', {}, [cb, el('img', { src: img.arquivo, alt: '' }), el('span', { 'class': 'ordem-n', 'aria-hidden': 'true' })]));
    });
    caixa.appendChild(rotulo); caixa.appendChild(grade);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda + ' No modelo curto as imagens não entram.' }));
    caixa.appendChild(ajustes);
    redesenhar();
    return caixa;
  }

  /* ---------- Ordem dos blocos (modular) ---------- */
  function campoOrdem() {
    var b = estado.formato.blocos;
    if (!b) return null;
    if (!estado.ordem) estado.ordem = b.padrao.slice();
    var caixa = el('div', { 'class': 'campo largo', 'data-campo': 'ordem' });
    caixa.appendChild(el('span', { id: 'ordem-r', style: 'font-weight:700;font-size:14px;color:#1d1d1b' }, ['Ordem dos blocos ', el('span', { 'class': 'opc', texto: '(cabeçalho e rodapé são fixos)' })]));
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
        lista.appendChild(el('li', {}, [el('span', { 'class': 'ordem-nome', texto: b.nomes[k] }), el('span', { 'class': 'ordem-acoes' }, [sobe, desce])]));
      });
      if (foco != null) {
        var alvo = lista.children[foco] && lista.children[foco].querySelectorAll('button')[dir < 0 ? 0 : 1];
        if (alvo && !alvo.disabled) alvo.focus(); else if (lista.children[foco]) lista.children[foco].querySelector('button:not([disabled])').focus();
      }
    }
    var restaurar = el('button', { type: 'button', 'class': 'btn-mini', onclick: function () { estado.ordem = b.padrao.slice(); desenhar(); agendarPrevia(); } }, ['Voltar ao padrão']);
    desenhar();
    caixa.appendChild(lista); caixa.appendChild(restaurar); caixa.appendChild(anuncio);
    caixa.appendChild(el('span', { 'class': 'ajuda', texto: 'No modelo longo o botão se repete no fim, junto com a data.' }));
    return caixa;
  }

  function montarFormulario() {
    var caixa = $('campos');
    caixa.textContent = '';
    estado.imagens = [];
    estado.ordem = null;
    estado.formato.campos.forEach(function (c) { caixa.appendChild(montarCampo(c)); });
    var ordem = campoOrdem();
    if (ordem) caixa.appendChild(ordem);
  }

  function lerDados() {
    var f = $('formulario');
    var dados = {};
    estado.formato.campos.forEach(function (c) {
      if (c.tipo === 'imagens-aprovadas') { dados[c.id] = estado.imagens.map(function (i) { return { id: i.id, x: i.x, y: i.y, zoom: i.zoom }; }); return; }
      if (c.tipo === 'escolha') {
        var marcado = f.querySelector('input[name="' + c.id + '"]:checked');
        dados[c.id] = marcado ? marcado.value : '';
      } else {
        var e = f.elements[c.id];
        dados[c.id] = e ? e.value : '';
      }
    });
    dados.area = $('f-area') ? $('f-area').value : '';
    if (estado.ordem) dados.ordem = estado.ordem.slice();
    dados._imagensAprovadas = estado.marca.imagensAprovadas;
    dados._linguagem = estado.marca.linguagem;
    return dados;
  }

  /* ---------- Prévia ao vivo ---------- */
  var espera;
  function agendarPrevia() { clearTimeout(espera); espera = setTimeout(atualizarPrevia, 220); }

  var rodada = 0;
  /* Recorta as imagens no tamanho fixo de cada quadro (JPEG 2x). */
  async function recortar(plano) {
    if (!plano.imagens) return;
    await Promise.all(plano.imagens.itens.map(async function (it) {
      it.src = await Rc.cortar(it.arquivo, it.w, it.h, it, 2);
    }));
  }

  async function atualizarPrevia(codigo, srcs) {
    var minha = ++rodada;
    var dados = lerDados();
    var quadro = $('quadro');
    if (!M.limpar(dados.titulo) || !M.limpar(dados.texto)) {
      quadro.hidden = true; $('vazio').hidden = false; $('decisao').textContent = ''; $('porque').textContent = '';
      return null;
    }
    var plano = M.decidir(estado.formato, estado.marca, estado.tendencias, dados);
    try { await recortar(plano); } catch (e) { /* segue com a imagem original */ }
    if (srcs && plano.imagens) plano.imagens.itens.forEach(function (it, i) { if (srcs[i]) it.src = srcs[i]; });
    if (minha !== rodada && !codigo) return null;
    var modelo = window.UnimedModelos[estado.formato.id];
    var html = modelo.render(plano, dados, estado.marca, { codigo: codigo || 'UNI-' + estado.formato.sigla + '-PRÉVIA', baseUrl: estado.sistema.baseUrlPublica || location.href.replace(/[^/]*$/, '') });
    quadro.srcdoc = html;
    quadro.hidden = false; $('vazio').hidden = true;

    var chips = $('decisao'); chips.textContent = '';
    chips.appendChild(el('span', { 'class': 'var', texto: 'Modelo ' + plano.varianteNome }));
    chips.appendChild(el('span', { texto: 'Título ' + plano.tituloPx + ' px' }));
    chips.appendChild(el('span', { texto: plano.publico.nome }));
    chips.appendChild(el('span', { texto: 'Tema ' + plano.tema.rotulo }));
    if (plano.data) chips.appendChild(el('span', { texto: 'Data' }));
    if (plano.botao) chips.appendChild(el('span', { texto: 'Botão' }));
    if (plano.imagens) chips.appendChild(el('span', { texto: plano.imagens.quantidade + (plano.imagens.quantidade > 1 ? ' imagens' : ' imagem') }));
    var lista = $('porque'); lista.textContent = '';
    plano.porque.forEach(function (p) { lista.appendChild(el('li', { texto: p })); });
    return { plano: plano, html: html, dados: dados };
  }

  /* Na hora de gerar: envia os recortes ao banco de imagens (Supabase Storage) para o e-mail
     ter endereços públicos. Sem banco, as imagens ficam embutidas (serve para baixar, não para disparo). */
  async function publicarImagens(codigo) {
    var dados = lerDados();
    var plano = M.decidir(estado.formato, estado.marca, estado.tendencias, dados);
    if (!plano.imagens) return { srcs: null, embutidas: false };
    await recortar(plano);
    var cfg = estado.sistema.registro || {};
    if (cfg.modo !== 'supabase' || !R.enviarImagem) return { srcs: null, embutidas: true };
    try {
      var srcs = await Promise.all(plano.imagens.itens.map(function (it, i) {
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
      if (campo) { campo.classList.add('com-erro'); campo.appendChild(el('span', { 'class': 'msg', texto: e.msg })); }
    });
    if (erros.length) caixa.appendChild(el('div', { 'class': 'alerta erro', role: 'alert' }, [el('strong', { texto: 'Falta ajustar ' + erros.length + (erros.length > 1 ? ' itens' : ' item') + ':' }), el('ul', {}, erros.map(function (e) { return el('li', { texto: e.msg }); }))]));
    if (res.avisos.length) caixa.appendChild(el('div', { 'class': 'alerta aviso' }, [el('ul', {}, res.avisos.map(function (a) { return el('li', { texto: a.msg }); }))]));
    var primeiro = document.querySelector('.campo.com-erro input, .campo.com-erro textarea, .campo.com-erro select');
    if (primeiro) primeiro.focus();
  }

  async function gerar(ev) {
    ev.preventDefault();
    var dados = lerDados();
    var res = M.validar(estado.formato, dados);
    var extras = [];
    var nome = M.limpar($('f-solicitante').value);
    var area = $('f-area').value;
    if (!nome) extras.push({ campo: 'solicitante', msg: 'Informe seu nome.' });
    if (!area) extras.push({ campo: 'area', msg: 'Selecione sua área.' });
    mostrarMensagens(res, extras);
    if (!res.ok || extras.length) return;

    var botao = $('gerar'); botao.disabled = true;
    try {
      var codigo = M.gerarCodigo(estado.formato.sigla);
      var pub = await publicarImagens(codigo);
      var r = await atualizarPrevia(codigo, pub.srcs);
      var impressao = await R.hash(r.html);
      var conteudo = Object.assign({}, dados); delete conteudo._imagensAprovadas; delete conteudo._linguagem;
      estado.imagensEmbutidas = pub.embutidas;
      await R.salvar(estado.sistema.registro, {
        codigo: codigo,
        criado_em: new Date().toISOString(),
        nome: nome,
        area: area,
        formato: estado.formato.id,
        tema: dados.tema,
        variante: r.plano.variante,
        titulo: M.limpar(dados.titulo),
        caracteres: r.plano.caracteres,
        imagem: (dados.imagens || []).map(function (i) { return i.id; }).join(', ') || null,
        tem_data: !!r.plano.data,
        tem_botao: !!r.plano.botao,
        conteudo: conteudo,
        html: r.html,
        hash: impressao,
        versao_marca: estado.marca.versao,
        ciclo_tendencias: estado.tendencias.ciclo
      });
      estado.ultimoHtml = r.html; estado.ultimoCodigo = codigo; estado.ultimoTitulo = M.limpar(dados.titulo);
      $('codigo').textContent = codigo;
      $('formulario').hidden = true;
      $('feito').hidden = false;
      var local = (estado.sistema.registro || {}).modo !== 'supabase';
      $('copiado').textContent = !estado.imagensEmbutidas ? '' : local
        ? 'Modo de teste: as imagens ficaram embutidas no arquivo. Servem para baixar e ajustar; para disparo, use o site publicado.'
        : 'Atenção: o banco de imagens não respondeu e as imagens ficaram embutidas no arquivo. Servem para baixar e ajustar, mas podem não aparecer no disparo do e-mail.';
      $('baixar').focus();
    } catch (e) {
      $('mensagens').appendChild(el('div', { 'class': 'alerta erro', role: 'alert', texto: 'Não foi possível registrar a peça: ' + e.message }));
    } finally { botao.disabled = false; }
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
    var nomes = { png: 'a imagem', pdf: 'o PDF', pptx: 'o PowerPoint' };
    var feito = { png: 'A imagem foi baixada.', pdf: 'O PDF foi baixado.' };
    botoes.forEach(function (b) { b.disabled = true; });
    aviso.textContent = 'Preparando ' + nomes[tipo] + '…';
    try {
      await window.UnimedExportar[tipo](estado.ultimoHtml, estado.ultimoCodigo, { codigo: estado.ultimoCodigo, fonte: estado.marca.tipografia.familiaExportacao });
      aviso.textContent = tipo === 'pptx' ? 'PowerPoint baixado. Os textos podem ser editados; o código da peça continua no rodapé.' : feito[tipo];
    } catch (e) {
      aviso.textContent = 'Não consegui gerar ' + nomes[tipo] + ': ' + e.message;
    } finally { botoes.forEach(function (b) { b.disabled = false; }); }
  }

  function nova() {
    var nome = $('f-solicitante').value, area = $('f-area').value;
    $('formulario').reset();
    $('f-solicitante').value = nome; $('f-area').value = area; $('formulario').hidden = false; $('feito').hidden = true; $('mensagens').textContent = '';
    montarFormulario(); atualizarPrevia();
  }


  /* ---------- Início ---------- */
  async function iniciar() {
    try {
      var r = await Promise.all([json('config/marca.json'), json('config/tendencias.json'), json('config/sistema.json'), json('config/formatos/indice.json')]);
      estado.marca = r[0]; estado.tendencias = r[1]; estado.sistema = r[2]; estado.indice = r[3];
    } catch (e) {
      $('busca').appendChild(el('div', { 'class': 'alerta erro', role: 'alert', texto: 'Não consegui carregar as regras da marca (' + e.message + '). Abra pelo endereço do site, não direto do arquivo.' }));
      return;
    }
    var area = $('f-area');
    estado.marca.areas.forEach(function (a) { area.appendChild(el('option', { value: a, texto: a })); });

    var atalhos = $('atalhos');
    estado.indice.formatos.slice(0, 5).forEach(function (f) {
      atalhos.appendChild(el('button', { type: 'button', texto: f.nome + (f.ativo ? '' : ' · em breve'), disabled: !f.ativo, onclick: function () { escolher(f); } }));
    });

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
    $('formulario').addEventListener('submit', gerar);
    $('trocar').addEventListener('click', function () { $('trabalho').hidden = true; $('busca').classList.remove('compacta'); busca.value = ''; busca.focus(); });
    $('baixar').addEventListener('click', baixar);
    $('copiar').addEventListener('click', copiar);
    $('nova').addEventListener('click', nova);
    document.querySelectorAll('[data-exportar]').forEach(function (b) { b.addEventListener('click', exportar); });
  }
  iniciar();
})();
