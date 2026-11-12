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
  var $ = function (id) { return document.getElementById(id); };

  var estado = {
    marca: null, tendencias: null, sistema: null, indice: null, formato: null,
    ultimoHtml: '', ultimoCodigo: '', ultimoTitulo: '', imagens: [], ordem: null,
    edicao: null,          // { base, versao } depois da primeira geração
    editando: false,       // true quando "Editar esta peça" foi usado
    pendente: null,        // registro que não chegou ao banco
    redesenharImagens: null, desenharOrdem: null, marcarVazios: null
  };
  var LARGOS = { publico: 1, cabecalho: 1, tema: 1, titulo: 1, subtitulo: 1, texto: 1, imagens: 1, local: 1, ordem: 1 };
  var CHAVE_QUEM = 'unimed-gerador-quem';
  var CHAVE_RASCUNHO = 'unimed-gerador-rascunho-';

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

  /* ---------- Quem está pedindo (fica guardado no aparelho) ---------- */
  function mostrarQuem(compacto) {
    var nome = M.limpar($('f-solicitante').value), area = $('f-area').value;
    var pode = compacto && nome && area;
    $('quem-resumo').hidden = !pode;
    $('quem-campos').hidden = !!pode;
    $('quem').classList.toggle('compacto', !!pode);
    if (pode) { $('quem-nome').textContent = nome; $('quem-area').textContent = area; }
  }
  function guardarQuem() {
    var nome = M.limpar($('f-solicitante').value), area = $('f-area').value;
    if (nome || area) gravar(CHAVE_QUEM, { nome: nome, area: area });
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

    if (c.tipo === 'escolha') {
      var grupo = el('div', { 'class': 'temas', role: 'radiogroup', 'aria-labelledby': id + '-r' });
      rotulo = el('span', { id: id + '-r', 'class': 'rot' }, [c.rotulo]);
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
    if (c.formatacao && window.UnimedFormatacao) {
      caixa.classList.add('com-formatacao');
      caixa.appendChild(window.UnimedFormatacao.barra(entrada, realcesResolvidos(), c.formatacao === 'realce' ? 'realce' : 'completo'));
    }
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
    var lay = (estado.formato.arvore.imagem && estado.formato.arvore.imagem.layouts) || {};
    return lay[String(qtd)] || [];
  }

  function campoImagens(c, caixa, id) {
    var limite = c.limite || 3;
    var rotulo = el('span', { id: id + '-r', 'class': 'rot' }, [c.rotulo + ' ', el('span', { 'class': 'opc', texto: '(até ' + limite + ', da biblioteca aprovada)' })]);
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

    estado.marca.imagensAprovadas.forEach(function (img) {
      var cb = el('input', { type: 'checkbox', name: c.id, value: img.id, 'aria-label': img.descricao });
      cb.addEventListener('change', function () {
        if (cb.checked) estado.imagens.push({ id: img.id, x: 0.5, y: 0.5, zoom: 1 });
        else estado.imagens = estado.imagens.filter(function (i) { return i.id !== img.id; });
        redesenhar(); agendarPrevia();
      });
      grade.appendChild(el('label', { title: img.descricao }, [cb, el('img', { src: img.arquivo, alt: '' }), el('span', { 'class': 'ordem-n', 'aria-hidden': 'true' })]));
    });
    caixa.appendChild(rotulo); caixa.appendChild(grade);
    if (c.ajuda) caixa.appendChild(el('span', { 'class': 'ajuda', texto: c.ajuda }));
    caixa.appendChild(aviso);
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
    caixa.appendChild(el('span', { id: 'ordem-r', 'class': 'rot' }, ['Ordem dos blocos ', el('span', { 'class': 'opc', texto: '(cabeçalho e rodapé são fixos)' })]));
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
        var cheio = Array.isArray(v) ? v.length > 0 : !!M.limpar(M.semMarcas ? M.semMarcas(v || '') : (v || ''));
        li.classList.toggle('vazio', !cheio);
      });
    }
    estado.desenharOrdem = desenhar;
    estado.marcarVazios = marcarVazios;
    var restaurar = el('button', { type: 'button', 'class': 'btn-mini', onclick: function () { estado.ordem = b.padrao.slice(); desenhar(); agendarPrevia(); } }, ['Voltar ao padrão']);
    caixa.appendChild(lista); caixa.appendChild(restaurar); caixa.appendChild(anuncio);
    caixa.appendChild(el('span', { 'class': 'ajuda', texto: 'Blocos apagados estão vazios e não entram na peça. No modelo longo o botão se repete no fim, junto com a data.' }));
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
    estado.ordem = null;
    estado.redesenharImagens = estado.desenharOrdem = estado.marcarVazios = null;
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

  /* Coloca dados salvos de volta no formulário (rascunho ou edição). */
  function preencher(dados) {
    var f = $('formulario');
    estado.formato.campos.forEach(function (c) {
      var v = dados[c.id];
      if (v == null) return;
      if (c.tipo === 'imagens-aprovadas') { estado.imagens = (v || []).map(function (i) { return Object.assign({}, i); }); if (estado.redesenharImagens) estado.redesenharImagens(); return; }
      if (c.tipo === 'escolha') { var r = f.querySelector('input[name="' + c.id + '"][value="' + v + '"]'); if (r) r.checked = true; return; }
      var e = f.elements[c.id];
      if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: false })); }
    });
    if (dados.ordem && estado.formato.blocos) { estado.ordem = dados.ordem.slice(); if (estado.desenharOrdem) estado.desenharOrdem(); }
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
      if (Array.isArray(v)) { if (v.length) partes.push(v.length + (v.length > 1 ? ' imagens' : ' imagem')); return; }
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
      var p = resumoSecao(sec, dados);
      var r = sec.querySelector('.secao-resumo');
      r.textContent = p.length ? p.join(' · ') : sec.getAttribute('data-vazio');
      r.classList.toggle('cheio', p.length > 0);
    });
    if (estado.marcarVazios) estado.marcarVazios(dados);
    var faltam = [];
    if (!M.limpar($('f-solicitante').value)) faltam.push('seu nome');
    if (!$('f-area').value) faltam.push('sua área');
    estado.formato.campos.forEach(function (c) {
      if (!c.obrigatorio || c.tipo === 'escolha') return;
      var v = dados[c.id];
      if (Array.isArray(v) ? !v.length : !M.limpar(v || '')) faltam.push(c.rotulo.toLowerCase());
    });
    var p = $('pendencias');
    p.textContent = faltam.length ? 'Falta: ' + faltam.join(', ') : 'Tudo certo para gerar';
    p.classList.toggle('ok', !faltam.length);
  }

  /* ---------- Rascunho automático (neste aparelho) ---------- */
  function salvarRascunho(dados) {
    if (!estado.formato) return;
    var tem = estado.formato.campos.some(function (c) {
      var v = dados[c.id];
      return c.tipo !== 'escolha' && (Array.isArray(v) ? v.length : M.limpar(v || ''));
    });
    var limpo = {};
    estado.formato.campos.forEach(function (c) { limpo[c.id] = dados[c.id]; });
    if (dados.ordem) limpo.ordem = dados.ordem;
    gravar(CHAVE_RASCUNHO + estado.formato.id, tem ? { quando: new Date().toISOString(), dados: limpo, edicao: estado.edicao } : null);
  }
  function recuperarRascunho() {
    var r = ler(CHAVE_RASCUNHO + estado.formato.id);
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
    if (!plano.imagens) return;
    await Promise.all(plano.imagens.itens.map(async function (it) {
      it.src = await Rc.cortar(it.arquivo, it.w, it.h, it, 2);
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
    q.style.width = LARGURA_QUADRO + 'px';
    var h = doc.documentElement.scrollHeight;
    var s = Math.min(1, palco.clientWidth / LARGURA_QUADRO);
    q.style.height = h + 'px';
    q.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    palco.style.height = Math.ceil(h * s) + 'px';
  }

  async function atualizarPrevia(codigo, srcs) {
    var minha = ++rodada;
    var dados = lerDados();
    if (!codigo) { atualizarPainel(dados); salvarRascunho(dados); }
    if (!M.limpar(dados.titulo) || !M.limpar(dados.texto)) {
      $('palco').hidden = true; $('vazio').hidden = false; $('decisao').textContent = ''; $('porque').textContent = ''; $('porque-caixa').hidden = true;
      $('imagens-aviso') && ($('imagens-aviso').hidden = true);
      return null;
    }
    var plano = M.decidir(estado.formato, estado.marca, estado.tendencias, dados);
    try { await recortar(plano); } catch (e) { /* segue com a imagem original */ }
    if (srcs && plano.imagens) plano.imagens.itens.forEach(function (it, i) { if (srcs[i]) it.src = srcs[i]; });
    if (minha !== rodada && !codigo) return null;
    var modelo = window.UnimedModelos[estado.formato.id];
    var opcoesPrevia = { codigo: 'UNI-' + estado.formato.sigla + '-PRÉVIA', baseUrl: baseLocal() };
    var html = modelo.render(plano, dados, estado.marca, codigo ? { codigo: codigo, baseUrl: estado.sistema.baseUrlPublica || baseLocal() } : opcoesPrevia);
    $('quadro').srcdoc = codigo ? modelo.render(plano, dados, estado.marca, Object.assign({}, opcoesPrevia, { codigo: codigo })) : html;
    $('palco').hidden = false; $('vazio').hidden = true;

    // Imagem escolhida que não entra (modelo curto): avisa no próprio campo.
    var avisoImg = $('imagens-aviso');
    if (avisoImg) {
      var semLugar = (dados.imagens || []).length > 0 && !plano.imagens;
      avisoImg.hidden = !semLugar;
      if (semLugar) {
        var ate = estado.formato.arvore.variante && estado.formato.arvore.variante.curto && estado.formato.arvore.variante.curto.ate;
        avisoImg.textContent = 'O texto está no modelo curto' + (ate ? ' (até ' + ate + ' caracteres)' : '') + ', que não leva imagem. Escreva um pouco mais para as fotos entrarem.';
      }
    }

    var chips = $('decisao'); chips.textContent = '';
    chips.appendChild(el('span', { 'class': 'var', texto: 'Modelo ' + plano.varianteNome }));
    chips.appendChild(el('span', { texto: plano.publico.nome }));
    chips.appendChild(el('span', { texto: 'Tema ' + plano.tema.rotulo }));
    if (plano.imagens) chips.appendChild(el('span', { texto: plano.imagens.quantidade + (plano.imagens.quantidade > 1 ? ' imagens' : ' imagem') }));
    var lista = $('porque'); lista.textContent = '';
    plano.porque.forEach(function (p) { lista.appendChild(el('li', { texto: p })); });
    $('porque-caixa').hidden = !plano.porque.length;
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
      if (campo) {
        campo.classList.add('com-erro'); campo.appendChild(el('span', { 'class': 'msg', texto: e.msg }));
        var sec = campo.closest('details'); if (sec) sec.open = true;
      }
    });
    if (erros.some(function (e) { return e.campo === 'solicitante' || e.campo === 'area'; })) mostrarQuem(false);
    if (erros.length) caixa.appendChild(el('div', { 'class': 'alerta erro', role: 'alert' }, [el('strong', { texto: 'Falta ajustar ' + erros.length + (erros.length > 1 ? ' itens' : ' item') + ':' }), el('ul', {}, erros.map(function (e) { return el('li', { texto: e.msg }); }))]));
    if (res.avisos.length) caixa.appendChild(el('div', { 'class': 'alerta aviso' }, [el('ul', {}, res.avisos.map(function (a) { return el('li', { texto: a.msg }); }))]));
    var primeiro = document.querySelector('.campo.com-erro input, .campo.com-erro textarea, .campo.com-erro select');
    if (primeiro) { mudarAba('editar'); primeiro.focus(); }
  }

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
    if (!area) extras.push({ campo: 'area', msg: 'Selecione sua área.' });
    mostrarMensagens(res, extras);
    if (!res.ok || extras.length) return;

    var botao = $('gerar'); botao.disabled = true;
    var rotulo = $('gerar-rotulo'), rotuloAntes = rotulo.textContent;
    rotulo.textContent = 'Gerando…';
    try {
      var codigo = proximoCodigo();
      var anterior = estado.editando && estado.edicao ? (estado.edicao.ultimo || estado.ultimoCodigo || null) : null;
      var pub = await publicarImagens(codigo);
      var r = await atualizarPrevia(codigo, pub.srcs);
      var impressao = await R.hash(r.html);
      var conteudo = Object.assign({}, dados); delete conteudo._imagensAprovadas; delete conteudo._linguagem;
      if (anterior) conteudo.versao_de = anterior;
      estado.imagensEmbutidas = pub.embutidas;
      var registro = {
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
      };
      var falha = null;
      try { await R.salvar(estado.sistema.registro, registro); }
      catch (e) { falha = e; }

      // A peça existe mesmo se o banco não respondeu: dá para copiar e baixar.
      estado.ultimoHtml = r.html; estado.ultimoCodigo = codigo; estado.ultimoTitulo = M.limpar(dados.titulo);
      var m = /^(.*?)(?:-V(\d+))?$/.exec(codigo);
      estado.edicao = { base: m[1], versao: m[2] ? Number(m[2]) : 1, ultimo: codigo };
      estado.editando = false;
      estado.pendente = falha ? registro : null;
      guardarQuem();
      mostrarQuem(true);
      gravar(CHAVE_RASCUNHO + estado.formato.id, null);
      mostrarFeito(falha, !!anterior);
    } catch (e) {
      $('mensagens').appendChild(el('div', { 'class': 'alerta erro', role: 'alert', texto: 'Não consegui montar a peça (' + explicar(e) + '). Seu conteúdo continua aqui; tente de novo.' }));
    } finally { botao.disabled = false; rotulo.textContent = rotuloAntes; }
  }

  function mostrarFeito(falha, versao) {
    $('codigo').textContent = estado.ultimoCodigo;
    $('feito-titulo').textContent = falha ? 'Peça pronta, ainda sem registro' : versao ? 'Nova versão registrada' : 'Peça registrada';
    $('feito-texto').textContent = falha
      ? 'Você já pode copiar e baixar. O código só vale como oficial depois do registro.'
      : versao ? 'A versão anterior continua guardada no painel. Use este código daqui pra frente.' : 'Guarde esse código. Ele identifica esta versão oficial da peça no painel.';
    $('pendente').hidden = !falha;
    if (falha) $('pendente-texto').textContent = 'Não consegui registrar no banco agora (' + explicar(falha) + ').';
    var local = (estado.sistema.registro || {}).modo !== 'supabase';
    $('copiado').textContent = !estado.imagensEmbutidas ? '' : local
      ? 'Modo de teste: as imagens ficaram embutidas no arquivo. Servem para baixar e ajustar; para disparo, use o site publicado.'
      : 'Atenção: o banco de imagens não respondeu e as imagens ficaram embutidas no arquivo. Servem para baixar e ajustar, mas podem não aparecer no disparo do e-mail.';
    $('formulario').hidden = true;
    $('feito').hidden = false;
    mudarAba('editar');
    $('feito').scrollIntoView({ block: 'start', behavior: 'smooth' });
    $('copiar').focus({ preventScroll: true });
  }

  async function tentarDeNovo() {
    if (!estado.pendente) return;
    var b = $('tentar'); b.disabled = true; b.textContent = 'Tentando…';
    try {
      await R.salvar(estado.sistema.registro, estado.pendente, { soBanco: true });
      estado.pendente = null;
      $('pendente').hidden = true;
      $('feito-titulo').textContent = 'Peça registrada';
      $('feito-texto').textContent = 'Pronto, o registro entrou no painel. Guarde esse código.';
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
    gravar(CHAVE_RASCUNHO + estado.formato.id, null);
    var nome = $('f-solicitante').value, area = $('f-area').value;
    $('formulario').reset();
    $('f-solicitante').value = nome; $('f-area').value = area;
    estado.edicao = null; estado.editando = false; estado.pendente = null;
    $('gerar-rotulo').textContent = 'Gerar peça';
    $('rascunho').hidden = true;
    mostrarFormulario();
    montarFormulario(); atualizarPrevia();
    var t = $('f-titulo'); if (t) t.focus({ preventScroll: true });
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
      var r = await Promise.all([json('config/marca.json'), json('config/tendencias.json'), json('config/sistema.json'), json('config/formatos/indice.json')]);
      estado.marca = r[0]; estado.tendencias = r[1]; estado.sistema = r[2]; estado.indice = r[3];
    } catch (e) {
      $('busca').appendChild(el('div', { 'class': 'alerta erro', role: 'alert', texto: 'Não consegui carregar as regras da marca (' + e.message + '). Abra pelo endereço do site, não direto do arquivo.' }));
      return;
    }
    var area = $('f-area');
    estado.marca.areas.forEach(function (a) { area.appendChild(el('option', { value: a, texto: a })); });
    var quem = ler(CHAVE_QUEM);
    if (quem) { $('f-solicitante').value = quem.nome || ''; if (estado.marca.areas.indexOf(quem.area) >= 0) area.value = quem.area; }
    mostrarQuem(true);
    $('quem-trocar').addEventListener('click', function () { mostrarQuem(false); $('f-solicitante').focus(); });
    $('f-solicitante').addEventListener('change', guardarQuem);
    area.addEventListener('change', guardarQuem);

    // Atalhos: os formatos ativos primeiro e em destaque; "em breve" apagados.
    var atalhos = $('atalhos');
    var ordenados = estado.indice.formatos.slice().sort(function (a, b) { return (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0); });
    ordenados.slice(0, 5).forEach(function (f) {
      atalhos.appendChild(el('button', { type: 'button', 'class': f.ativo ? 'ativo' : 'breve', disabled: !f.ativo, onclick: function () { escolher(f); } }, [f.nome, f.ativo ? null : el('small', { texto: 'em breve' })]));
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
    $('editar').addEventListener('click', editar);
    $('tentar').addEventListener('click', tentarDeNovo);
    document.querySelectorAll('[data-exportar]').forEach(function (b) { b.addEventListener('click', exportar); });

    $('aba-editar').addEventListener('click', function () { mudarAba('editar'); });
    $('aba-previa').addEventListener('click', function () { mudarAba('previa'); });
    $('aba-editar').parentNode.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var previa = !$('trabalho').classList.contains('ver-previa');
      mudarAba(previa ? 'previa' : 'editar');
      $(previa ? 'aba-previa' : 'aba-editar').focus();
    });
    $('quadro').addEventListener('load', ajustarQuadro);
    window.addEventListener('resize', ajustarQuadro);
  }
  iniciar();
})();
