/* ============================================================
   Painel de administração
   Mostra quem pediu, de qual área, quando e o quê; deixa abrir a
   versão oficial de cada peça e conferir se um HTML foi alterado.
   ============================================================ */
(function () {
  'use strict';
  var R = window.UnimedRegistro;
  var A = window.UnimedAprovacao;
  var ctxAtual = null, atual = null;
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
    var top = contarPor(pedidos, function (p) { return nomesFormato[p.formato] || p.formato; })[0];
    var caixa = $('kpis'); caixa.textContent = '';
    var espera = pedidos.filter(function (p) { return p.status === 'aguardando'; }).length;
    [[espera, 'aguardando aprovação', true], [pedidos.length, 'peças registradas'], [mes, 'neste mês'], [top ? top[0] : '—', 'formato mais pedido']].forEach(function (k) {
      caixa.appendChild(el(k[2] ? 'button' : 'div', k[2] ? { 'class': 'kpi kpi-acao' + (k[0] ? ' tem' : ''), type: 'button', title: 'Mostrar só as que aguardam', onclick: function () { $('filtro-status').value = 'aguardando'; tabela(); $('linhas').scrollIntoView({ behavior: 'smooth', block: 'start' }); } } : { 'class': 'kpi' }, [el('b', { texto: String(k[0]), style: String(k[0]).length > 6 ? 'font-size:22px;line-height:1.15' : '' }), el('span', { texto: k[1] })]));
    });
  }

  function tabela() {
    var t = $('filtro-texto').value.toLowerCase().trim();
    var a = $('filtro-area').value;
    var st = $('filtro-status').value;
    var lista = pedidos.filter(function (p) {
      return (!a || p.area === a) && (!st || (p.status || 'aprovada') === st) && (!t || (p.nome + ' ' + p.titulo + ' ' + p.codigo).toLowerCase().indexOf(t) >= 0);
    });
    var corpo = $('linhas'); corpo.textContent = '';
    lista.forEach(function (p) {
      var sit = A.status(p.status);
      corpo.appendChild(el('tr', { 'class': p.status === 'aguardando' ? 'espera' : '' }, [
        el('td', {}, [el('span', { 'class': 'selo ' + sit.classe, texto: sit.curto })]),
        el('td', { 'class': 'cod' }, [p.codigo, p.conteudo && p.conteudo.versao_de ? el('small', { 'class': 'versao-de', texto: 'nova versão de ' + p.conteudo.versao_de }) : null]),
        el('td', { texto: quando(p.criado_em) }),
        el('td', { texto: p.nome }),
        el('td', { texto: p.area }),
        el('td', {}, [(nomesFormato[p.formato] || p.formato) + ' ', el('span', { 'class': 'selo', texto: nomeVariante(p.variante) })]),
        el('td', { texto: p.titulo }),
        el('td', {}, [p.html ? el('button', { type: 'button', 'class': p.status === 'aguardando' ? 'btn-mini analisar' : 'btn-mini', texto: p.status === 'aguardando' ? 'Analisar' : 'Ver peça', onclick: function () { abrir(p); } }) : el('span', { 'class': 'sub', texto: 'só no arquivo' })])
      ]));
    });
    $('sem-dados').hidden = pedidos.length > 0;
    if (pedidos.length && !lista.length) corpo.appendChild(el('tr', {}, [el('td', { colspan: '8', 'class': 'sub', texto: 'Nenhuma peça com esses filtros.' })]));
  }

  function abrir(p) {
    atual = p;
    $('d-codigo').textContent = p.codigo;
    $('d-info').textContent = p.nome + ' · ' + p.area + ' · ' + quando(p.criado_em) + (p.email ? ' · ' + p.email : '') + (p.versao_marca ? ' · marca ' + p.versao_marca : '') + (p.ciclo_tendencias ? ' · tendências ' + p.ciclo_tendencias : '');
    mostrarPeca(p);
    $('d-obs').value = p.status === 'reprovada' || p.status === 'aprovada' ? (p.observacao || '') : '';
    $('d-aviso').textContent = '';
    situacaoDialogo();
    $('dialogo').showModal();
  }

  /* A peça inteira dentro da janela: reduz as de tamanho fixo (1080 px, A4…) para caber. */
  var larguras = {};
  async function larguraDe(p) {
    if (!(p.formato in larguras)) {
      try { larguras[p.formato] = await fetch('config/formatos/' + p.formato + '.json').then(function (x) { return x.json(); }); }
      catch (e) { larguras[p.formato] = {}; }
    }
    var f = larguras[p.formato] || {}, t = f.tamanhos && p.conteudo && f.tamanhos[p.conteudo.tamanho];
    return (t && (t.quadro || t.largura)) || f.quadro || f.largura || 0;
  }
  async function mostrarPeca(p) {
    var quadro = $('d-quadro'), html = p.html || '';
    quadro.srcdoc = html;
    var w = await larguraDe(p), cabe = quadro.clientWidth - 24;
    if (atual !== p || !w || !cabe || w <= cabe) return;
    var z = (cabe / w).toFixed(3);
    var estilo = '<style>html{zoom:' + z + ';}</style>';
    quadro.srcdoc = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, estilo + '</head>') : estilo + html;
  }

  function situacaoDialogo() {
    var p = atual, sit = A.status(p.status), caixa = $('d-situacao');
    caixa.textContent = '';
    var central = ctxAtual && R.central((ctxAtual.sistema || {}).registro || {});
    var linha = [el('span', { 'class': 'selo ' + sit.classe, texto: sit.nome })];
    if (p.decidido_por) linha.push(' por ' + p.decidido_por + (p.decidido_em ? ' em ' + quando(p.decidido_em) : ''));
    caixa.appendChild(el('p', { 'class': 'situacao-linha' }, linha));
    if (p.status === 'reprovada' && p.observacao) caixa.appendChild(el('p', { 'class': 'obs-dada', texto: 'Observação enviada: ' + p.observacao }));
    if (p.status === 'substituida') caixa.appendChild(el('p', { 'class': 'sub', texto: 'Quem pediu já gerou uma versão nova. Analise a versão mais recente na lista.' }));
    var decidivel = central && p.t && p.status !== 'substituida';
    $('d-aprovar').hidden = !decidivel || p.status === 'aprovada';
    $('d-reprovar').hidden = !decidivel || p.status === 'reprovada';
    $('d-ajustar').hidden = !decidivel;
    $('d-obs').closest('.campo').hidden = !decidivel;
    $('d-obs-dica').textContent = p.status === 'aprovada' ? '(para reprovar, diga o que ajustar)' : '(obrigatória para reprovar; opcional ao aprovar)';
    var podeAvisar = (p.status === 'aprovada' || p.status === 'reprovada') && p.t;
    $('d-email').hidden = !podeAvisar;
    if (podeAvisar) $('d-email').href = A.mailto(mensagemDe(p));
    $('d-email').textContent = p.email ? 'Abrir e-mail para ' + p.email : 'Abrir e-mail no Outlook';
    if (!central) caixa.appendChild(el('p', { 'class': 'sub', texto: 'A aprovação funciona com o registro central ligado.' }));
  }

  function mensagemDe(p) {
    return A.mensagem({ nome: p.nome, email: p.email, titulo: p.titulo, codigo: p.codigo, formatoNome: nomesFormato[p.formato] || p.formato },
      { status: p.status, observacao: p.observacao, link: A.link(ctxAtual.sistema, p.codigo, p.t), quem: ctxAtual.nome || p.decidido_por });
  }

  async function decidir(acao) {
    var p = atual, obs = $('d-obs').value.trim(), aviso = $('d-aviso');
    if (acao === 'reprovar' && obs.length < 3) { aviso.textContent = 'Escreva na observação o que precisa ser ajustado.'; $('d-obs').focus(); return; }
    var botoes = [$('d-aprovar'), $('d-reprovar'), $('d-ajustar')];
    botoes.forEach(function (b) { b.disabled = true; });
    aviso.textContent = acao === 'aprovar' ? 'Aprovando…' : 'Registrando…';
    try {
      var r = await R.decidir(ctxAtual.sistema.registro, ctxAtual.token, p.codigo, acao, obs);
      p.status = r.status; p.observacao = r.observacao; p.decidido_por = r.decidido_por; p.decidido_em = r.decidido_em; p.t = r.t || p.t;
      situacaoDialogo();
      redesenhar();
      aviso.textContent = p.email
        ? 'Pronto. Abrimos o e-mail no seu Outlook já escrito para ' + p.email + ': confira e clique em Enviar.'
        : 'Pronto. Essa peça não tem e-mail de quem pediu: copie o link do e-mail e mande por outro canal.';
      // O e-mail sai do Outlook de quem aprovou (endereço da Unimed).
      if (p.email) location.href = A.mailto(mensagemDe(p));
    } catch (e) {
      aviso.textContent = e.message;
    } finally { botoes.forEach(function (b) { b.disabled = false; }); }
  }

  function ajustar() {
    var p = atual;
    // Abre a peça no gerador no modo ajuste: o que for gerado já entra aprovado.
    window.open(A.link(ctxAtual.sistema, p.codigo, p.t, '&ajuste=1'), '_blank', 'noopener');
    $('d-aviso').textContent = 'Abrimos a peça no gerador em outra aba. Ajuste e gere: a nova versão já sai aprovada e o e-mail para quem pediu fica pronto lá.';
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
        conteudo: { versao_de: pega(o, ['versao_de']) }, html: '', status: pega(o, ['status']) || 'aprovada'
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
    ctxAtual = ctx;
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
    $('filtro-status').addEventListener('change', tabela);
    $('d-aprovar').addEventListener('click', function () { decidir('aprovar'); });
    $('d-reprovar').addEventListener('click', function () { decidir('reprovar'); });
    $('d-ajustar').addEventListener('click', ajustar);
    // Ao voltar para a aba (depois de ajustar), atualiza a lista.
    document.addEventListener('visibilitychange', async function () {
      if (document.visibilityState !== 'visible' || !R.central(reg)) return;
      try { pedidos = await R.listar(reg, ctx.token); redesenhar(); } catch (e) { /* mantém a lista atual */ }
    });
    $('conferir').addEventListener('submit', conferir);
    $('d-fechar').addEventListener('click', function () { $('dialogo').close(); });
  }
  window.UnimedAcesso.proteger({ pagina: 'painel.html', aoLiberar: iniciar });
})();
