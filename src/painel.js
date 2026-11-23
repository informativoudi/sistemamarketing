/* ============================================================
   Painel de administração
   Mostra quem pediu, de qual área, quando e o quê; deixa abrir a
   versão oficial de cada peça e conferir se um HTML foi alterado.
   ============================================================ */
(function () {
  'use strict';
  var R = window.UnimedRegistro;
  var $ = function (id) { return document.getElementById(id); };
  var pedidos = [];
  var nomesFormato = {};

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }
  function quando(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function contarPor(lista, chave) {
    var m = {};
    lista.forEach(function (p) { var k = typeof chave === 'function' ? chave(p) : p[chave]; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }

  function barras(alvo, dados) {
    var caixa = $(alvo); caixa.textContent = '';
    if (!dados.length) { caixa.appendChild(el('p', { 'class': 'sub', texto: 'Sem dados ainda.' })); return; }
    var max = dados[0][1];
    dados.slice(0, 10).forEach(function (d) {
      caixa.appendChild(el('div', { 'class': 'barra' }, [
        el('span', { 'class': 'nome', title: d[0], texto: d[0] }),
        el('div', { 'class': 'trilho' }, [el('div', { 'class': 'valor', style: 'width:' + Math.max(4, d[1] / max * 100) + '%' })]),
        el('span', { 'class': 'n', texto: String(d[1]) })
      ]));
    });
  }

  function nomeVariante(v) { return ({ curto: 'curto', medio: 'médio', longo: 'longo' })[v] || v || ''; }

  function linhaTempo() {
    var dias = [];
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (var i = 29; i >= 0; i--) { var d = new Date(hoje); d.setDate(d.getDate() - i); dias.push({ d: d, n: 0 }); }
    pedidos.forEach(function (p) {
      var d = new Date(p.criado_em); d.setHours(0, 0, 0, 0);
      var idx = Math.round((d - dias[0].d) / 864e5);
      if (idx >= 0 && idx < 30) dias[idx].n++;
    });
    var max = Math.max(1, Math.max.apply(null, dias.map(function (x) { return x.n; })));
    var L = 1000, A = 150, pad = 22, larg = (L - pad) / 30;
    var svg = '<svg viewBox="0 0 ' + L + ' ' + (A + 20) + '" role="img" aria-label="Peças por dia nos últimos 30 dias">';
    svg += '<line x1="' + pad + '" y1="' + A + '" x2="' + L + '" y2="' + A + '" stroke="#e3ddd7"/>';
    svg += '<text x="0" y="12" font-size="11" fill="#6f6f6e">' + max + '</text><text x="0" y="' + A + '" font-size="11" fill="#6f6f6e">0</text>';
    dias.forEach(function (x, i) {
      var h = x.n / max * (A - 16);
      svg += '<rect x="' + (pad + i * larg + 2) + '" y="' + (A - h) + '" width="' + (larg - 4) + '" height="' + h + '" fill="' + (i === 29 ? '#b1d34b' : '#00995d') + '"><title>' + x.d.toLocaleDateString('pt-BR') + ': ' + x.n + '</title></rect>';
      if (i % 7 === 1) svg += '<text x="' + (pad + i * larg + larg / 2) + '" y="' + (A + 15) + '" font-size="10" text-anchor="middle" fill="#6f6f6e">' + x.d.getDate() + '/' + (x.d.getMonth() + 1) + '</text>';
    });
    $('g-tempo').innerHTML = svg + '</svg>';
  }

  function kpis() {
    var agora = new Date();
    var mes = pedidos.filter(function (p) { var d = new Date(p.criado_em); return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear(); }).length;
    var areas = contarPor(pedidos, 'area').length;
    var top = contarPor(pedidos, function (p) { return nomesFormato[p.formato] || p.formato; })[0];
    var caixa = $('kpis'); caixa.textContent = '';
    [[pedidos.length, 'peças registradas'], [mes, 'neste mês'], [areas, 'áreas que pediram'], [top ? top[0] : '—', 'formato mais pedido']].forEach(function (k) {
      caixa.appendChild(el('div', { 'class': 'kpi' }, [el('b', { texto: String(k[0]), style: String(k[0]).length > 6 ? 'font-size:22px;line-height:1.15' : '' }), el('span', { texto: k[1] })]));
    });
  }

  function tabela() {
    var t = $('filtro-texto').value.toLowerCase().trim();
    var a = $('filtro-area').value;
    var lista = pedidos.filter(function (p) {
      return (!a || p.area === a) && (!t || (p.nome + ' ' + p.titulo + ' ' + p.codigo).toLowerCase().indexOf(t) >= 0);
    });
    var corpo = $('linhas'); corpo.textContent = '';
    lista.forEach(function (p) {
      corpo.appendChild(el('tr', {}, [
        el('td', { 'class': 'cod' }, [p.codigo, p.conteudo && p.conteudo.versao_de ? el('small', { 'class': 'versao-de', texto: 'nova versão de ' + p.conteudo.versao_de }) : null]),
        el('td', { texto: quando(p.criado_em) }),
        el('td', { texto: p.nome }),
        el('td', { texto: p.area }),
        el('td', {}, [(nomesFormato[p.formato] || p.formato) + ' ', el('span', { 'class': 'selo', texto: nomeVariante(p.variante) })]),
        el('td', { texto: p.titulo }),
        el('td', {}, [p.html ? el('button', { type: 'button', texto: 'Ver peça', onclick: function () { abrir(p); } }) : el('span', { 'class': 'sub', texto: 'só no arquivo' })])
      ]));
    });
    $('sem-dados').hidden = pedidos.length > 0;
  }

  function abrir(p) {
    $('d-codigo').textContent = p.codigo;
    $('d-info').textContent = p.nome + ' · ' + p.area + ' · ' + quando(p.criado_em) + (p.versao_marca ? ' · marca ' + p.versao_marca : '') + (p.ciclo_tendencias ? ' · tendências ' + p.ciclo_tendencias : '');
    $('d-quadro').srcdoc = p.html;
    $('dialogo').showModal();
  }

  async function conferir(ev) {
    ev.preventDefault();
    var saida = $('c-resultado'); saida.textContent = '';
    var cod = $('c-codigo').value.trim().toUpperCase();
    var p = pedidos.filter(function (x) { return x.codigo.toUpperCase() === cod; })[0];
    if (!p) { saida.appendChild(el('p', { 'class': 'alerta erro', texto: 'Esse código não está registrado. A peça pode ter sido feita fora do sistema.' })); return; }
    saida.appendChild(el('p', { texto: 'Peça oficial de ' + p.nome + ' (' + p.area + '), gerada em ' + quando(p.criado_em) + '.' }));
    var colado = $('c-html').value;
    if (colado.trim()) {
      var h = await R.hash(colado);
      if (h === p.hash) saida.appendChild(el('span', { 'class': 'selo ok', texto: 'Idêntica à versão oficial' }));
      else saida.appendChild(el('span', { 'class': 'selo alerta-s', texto: 'Diferente da versão oficial: houve alteração depois de gerada' }));
    }
    if (p.html) saida.appendChild(el('div', { 'class': 'acoes' }, [el('button', { 'class': 'btn secundario', type: 'button', texto: 'Ver versão oficial', onclick: function () { abrir(p); } })]));
  }

  function redesenhar() {
    var f = $('filtro-area'); while (f.options.length > 1) f.remove(1);
    contarPor(pedidos, 'area').forEach(function (x) { f.appendChild(el('option', { value: x[0], texto: x[0] })); });
    kpis();
    barras('g-area', contarPor(pedidos, 'area'));
    barras('g-formato', contarPor(pedidos, function (p) { return (nomesFormato[p.formato] || p.formato) + (p.variante ? ' · ' + nomeVariante(p.variante) : ''); }));
    linhaTempo();
    tabela();
  }

  /* Lista exportada do SharePoint/Excel em .csv: mostra todas as áreas no painel. */
  function lerCsv(texto) {
    var linhas = [], linha = [], campo = '', aspas = false;
    var sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; }
      else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
      else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    var cab = (linhas.shift() || []).map(function (h) { return h.replace(/^\uFEFF/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'); });
    var pega = function (o, nomes) { for (var k = 0; k < nomes.length; k++) if (o[nomes[k]]) return o[nomes[k]]; return ''; };
    return linhas.filter(function (l) { return l.join('').trim(); }).map(function (l) {
      var o = {}; cab.forEach(function (h, k) { o[h] = (l[k] || '').trim(); });
      return {
        codigo: pega(o, ['codigo', 'title', 'titulo_do_item']), criado_em: pega(o, ['criado_em', 'created', 'criado']) || new Date().toISOString(),
        nome: pega(o, ['nome']), area: pega(o, ['area']), formato: pega(o, ['formato']), variante: pega(o, ['variante']),
        titulo: pega(o, ['titulo']), hash: pega(o, ['hash']), versao_marca: pega(o, ['versao_marca']), ciclo_tendencias: pega(o, ['ciclo_tendencias']),
        conteudo: { versao_de: pega(o, ['versao_de']) }, html: ''
      };
    });
  }
  function importar(ev) {
    var arq = ev.target.files && ev.target.files[0];
    if (!arq) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      var lista = lerCsv(String(leitor.result || ''));
      var locais = {}; pedidos.forEach(function (p) { locais[p.codigo] = p; });
      pedidos = lista.map(function (p) { return locais[p.codigo] || p; }).sort(function (a, b) { return new Date(b.criado_em) - new Date(a.criado_em); });
      $('fonte-texto').textContent = 'Mostrando a lista exportada: ' + pedidos.length + ' peças de todas as áreas (' + arq.name + ').';
      redesenhar();
    };
    leitor.readAsText(arq, 'utf-8');
  }

  async function iniciar(ctx) {
    var sistema = ctx.sistema, indice;
    try { indice = await fetch('config/formatos/indice.json').then(function (x) { return x.json(); }); }
    catch (e) { indice = { formatos: [] }; }
    indice.formatos.forEach(function (f) { nomesFormato[f.id] = f.nome; });
    var reg = sistema.registro || {};
    $('fonte-texto').textContent = R.central(reg)
      ? 'Todas as peças geradas em qualquer computador, gravadas no registro central.'
      : 'O registro central ainda não foi ligado: aqui aparecem só as peças geradas neste navegador.';
    try { pedidos = await R.listar(reg, ctx.token); }
    catch (e) { pedidos = []; var av = $('origem'); av.hidden = false; av.textContent = e.message; }
    $('importar-csv').addEventListener('change', importar);
    redesenhar();
    $('filtro-texto').addEventListener('input', tabela);
    $('filtro-area').addEventListener('change', tabela);
    $('conferir').addEventListener('submit', conferir);
    $('d-fechar').addEventListener('click', function () { $('dialogo').close(); });
  }
  window.UnimedAcesso.proteger({ pagina: 'painel.html', aoLiberar: iniciar });
})();
