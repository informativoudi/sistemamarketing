/* ============================================================
   Atualizar peças em lote com a Key Art / marca atual
   Para cada peça escolhida: abre o formato, aplica o mesmo conteúdo
   com as regras de hoje, registra uma nova versão (…-V2, -V3) já
   aprovada e deixa pronto o e-mail para quem pediu.
   Fotos enviadas do computador não ficam guardadas: essas peças
   ficam de fora (precisam ser refeitas com a foto original).
   ============================================================ */
(function () {
  'use strict';
  var Ac = window.UnimedAcesso, R = window.UnimedRegistro, A = window.UnimedAprovacao, Rc = window.UnimedRecorte, M = window.UnimedMotor, el = Ac.el;
  var $ = function (id) { return document.getElementById(id); };
  var ctx, marca, tendencias, indice, campanhas, pedidos = [], formatos = {}, nomesFormato = {};

  function limpar(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  async function json(u) { var r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' (' + r.status + ')'); return r.json(); }
  async function formato(id) { if (!formatos[id]) formatos[id] = await json('config/formatos/' + id + '.json'); return formatos[id]; }
  function baseLocal() { return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, ''); }
  function efetivo(f, dados) {
    if (!f.tamanhos) return f;
    var x = f.tamanhos[dados.tamanho] || f.tamanhos[Object.keys(f.tamanhos)[0]];
    var e = Object.assign({}, f, x); e.quadro = x.largura || f.quadro; return e;
  }
  function filialDe(area) { var s = ((marca.setores || {}).lista || []).filter(function (x) { return x.nome === area; })[0]; return s ? s.filial : ''; }
  function linhaDe(p) { return (p.conteudo && p.conteudo.publico) || (p.formato === 'campanha-kit' ? 'Campanha externa' : ''); }
  function campanhaDe(p) { return (p.conteudo && p.conteudo.campanha) || ''; }
  /* Peça que não dá para refazer sozinho: foto enviada do computador ou imagens de documento. */
  function semFoto(p) {
    var c = p.conteudo || {};
    if ((c.imagens || []).some(function (i) { return /^enviada-/.test(i.id); })) return true;
    if ((c.noticias || []).some(function (n) { return /^enviada-/.test(n.imagem || ''); })) return true;
    return Object.keys(c).some(function (k) { return Array.isArray(c[k]) && c[k].length && c[k][0] && c[k][0].nome && c[k][0].w && !c[k][0].id; });
  }
  function antiga(p) { return p.versao_marca !== marca.versao || String(p.ciclo_tendencias) !== String(tendencias.ciclo) || !!(campanhaDe(p)); }

  function candidatas() {
    var linha = $('u-linha').value, camp = $('u-campanha').value, fmt = $('u-formato').value, so = $('u-antigas').checked;
    return pedidos.filter(function (p) {
      if (p.status !== 'aprovada' || !p.conteudo || !p.formato || !nomesFormato[p.formato]) return false;
      var l = linhaDe(p);
      if (linha === 'campanhas' ? !/^Campanha/.test(l) : linha && l !== linha) return false;
      if (camp && campanhaDe(p) !== camp) return false;
      if (fmt && p.formato !== fmt) return false;
      if (so && p.versao_marca === marca.versao && String(p.ciclo_tendencias) === String(tendencias.ciclo)) return false;
      return true;
    });
  }

  function desenhar() {
    var lista = candidatas(), corpo = $('u-linhas'); corpo.textContent = '';
    lista.forEach(function (p) {
      var bloq = semFoto(p);
      var cb = el('input', { type: 'checkbox', value: p.codigo, 'aria-label': 'Atualizar ' + p.codigo });
      if (bloq) { cb.disabled = true; cb.title = 'Usa foto enviada do computador: refaça com a foto original.'; }
      cb.addEventListener('change', resumo);
      corpo.appendChild(el('tr', {}, [
        el('td', {}, [cb]),
        el('td', { 'class': 'cod', texto: p.codigo }),
        el('td', { texto: p.nome + ' · ' + p.area }),
        el('td', { texto: nomesFormato[p.formato] || p.formato }),
        el('td', {}, [linhaDe(p) || '—', campanhaDe(p) ? el('small', { 'class': 'versao-de', texto: campanhaDe(p) }) : null]),
        el('td', { texto: p.titulo }),
        el('td', {}, [(p.versao_marca ? 'marca ' + p.versao_marca : '') + (p.ciclo_tendencias ? ' · KA ' + p.ciclo_tendencias : ''), bloq ? el('small', { 'class': 'versao-de', texto: 'foto do computador: não dá para atualizar' }) : null])
      ]));
    });
    $('u-vazio').hidden = lista.length > 0;
    $('u-todas').checked = false;
    resumo();
  }
  function escolhidas() { return Array.prototype.map.call(document.querySelectorAll('#u-linhas input:checked'), function (c) { return c.value; }); }
  function resumo() {
    var n = escolhidas().length;
    $('u-resumo').textContent = n ? n + (n > 1 ? ' peças escolhidas' : ' peça escolhida') + '. Cada uma vira uma nova versão aprovada; a anterior sai de uso.' : 'Escolha as peças que quer atualizar.';
    $('u-gerar').disabled = !n;
    $('u-gerar').textContent = n ? 'Gerar ' + n + (n > 1 ? ' novas versões' : ' nova versão') : 'Gerar novas versões';
  }

  /* Refaz uma peça com as regras de hoje e registra a nova versão. */
  async function refazer(p) {
    var f = await formato(p.formato);
    var md = window.UnimedModelos[f.modelo || f.id];
    var conteudo = Object.assign({}, p.conteudo); delete conteudo.versao_de;
    var dados = Object.assign({}, conteudo, { area: p.area, filial: filialDe(p.area), _imagensAprovadas: marca.imagensAprovadas, _linguagem: marca.linguagem });
    var fe = efetivo(f, dados);
    var plano = md && md.decidir ? md.decidir(fe, marca, tendencias, dados) : M.decidir(fe, marca, tendencias, dados);
    var imgs = (plano.imagens ? plano.imagens.itens.slice() : []);
    (plano.noticias || []).forEach(function (n) { if (n.imagem) imgs.push(n.imagem); });
    (plano.figuras || []).forEach(function (x) { imgs.push(x); });
    for (var i = 0; i < imgs.length; i++) {
      var it = imgs[i], forma = md && md.formaImagem ? md.formaImagem(plano, it, marca) : null;
      try { it.src = await Rc.cortar(it.arquivo, it.w, it.h, it, 2, forma); } catch (e) { /* segue com o arquivo original */ }
    }
    var html = (f.exportar || []).indexOf('html') >= 0;
    // Número da nova versão: a próxima livre depois da atual.
    var m = /^(.*?)(?:-V(\d+))?$/.exec(p.codigo), n = m[2] ? Number(m[2]) : 1;
    var cfg = ctx.sistema.registro || {};
    for (var tent = 1; tent <= 6; tent++) {
      var codigo = m[1] + '-V' + (n + tent);
      if (html && imgs.length) {
        for (var k = 0; k < imgs.length; k++) {
          try { imgs[k].src = await R.enviarImagem(cfg, codigo + '/imagem-' + (k + 1) + '.jpg', Rc.paraBlob(imgs[k].src)); } catch (e) { /* fica embutida */ }
        }
      }
      var base = html ? (ctx.sistema.baseUrlPublica || baseLocal()) : baseLocal();
      var saida = plano.kit ? md.render(plano, dados, marca, { codigo: codigo, baseUrl: base, leve: true }) : md.render(plano, dados, marca, { codigo: codigo, baseUrl: base });
      var registro = {
        codigo: codigo, criado_em: new Date().toISOString(), nome: p.nome, area: p.area, email: p.email || null,
        formato: p.formato, tema: dados.tema, variante: plano.variante || null, titulo: limpar(p.titulo || dados.titulo),
        caracteres: plano.caracteres || 0, imagem: (dados.imagens || []).map(function (x) { return x.id; }).join(', ') || null,
        tem_data: !!plano.data, tem_botao: !!plano.botao,
        conteudo: Object.assign({}, conteudo, { versao_de: p.codigo }), html: saida, hash: await R.hash(saida),
        versao_marca: marca.versao, ciclo_tendencias: tendencias.ciclo, atualizacao_em_lote: true
      };
      var r = await fetch(String(cfg.api || '').replace(/\/$/, '') + '/pedidos?aprovar=1', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ctx.token }, body: JSON.stringify(registro) });
      var d = await r.json().catch(function () { return {}; });
      if (r.status === 409) continue; // essa versão já existe: tenta a próxima
      if (!r.ok) throw new Error(d.erro || 'registro recusado (' + r.status + ')');
      return { codigo: codigo, t: d.t, status: d.status };
    }
    throw new Error('não achei um número de versão livre');
  }

  async function gerar() {
    var cods = escolhidas();
    if (!cods.length) return;
    var b = $('u-gerar'); b.disabled = true;
    $('u-resultado-caixa').hidden = false;
    var ul = $('u-resultado'); ul.textContent = '';
    var ok = 0;
    for (var i = 0; i < cods.length; i++) {
      var p = pedidos.filter(function (x) { return x.codigo === cods[i]; })[0];
      $('u-progresso').textContent = 'Atualizando ' + (i + 1) + ' de ' + cods.length + ': ' + p.codigo + '…';
      try {
        var r = await refazer(p);
        ok++;
        var link = A.link(ctx.sistema, r.codigo, r.t);
        var msg = A.mensagem({ nome: p.nome, email: p.email, titulo: p.titulo, codigo: r.codigo, formatoNome: nomesFormato[p.formato] }, { status: 'aprovada', atualizada: true, link: link, quem: ctx.nome || '' });
        ul.appendChild(el('li', {}, [
          el('div', { 'class': 'mud-topo' }, [el('b', { texto: p.codigo + ' → ' + r.codigo }), el('span', { 'class': 'selo st-aprovada', texto: 'Atualizada' })]),
          el('p', { 'class': 'mud-texto', texto: p.titulo + ' · ' + p.nome + ' (' + p.area + ')' }),
          el('div', { 'class': 'acoes', style: 'margin-top:6px' }, [
            p.email ? el('a', { 'class': 'btn-mini', href: A.mailto(msg) }, ['Avisar ' + (p.nome || '').split(/\s+/)[0] + ' pelo Outlook']) : el('span', { 'class': 'ajuda', texto: 'Sem e-mail de quem pediu.' }),
            el('a', { 'class': 'btn-mini', href: link, target: '_blank', rel: 'noopener' }, ['Ver a nova versão'])
          ])
        ]));
      } catch (e) {
        ul.appendChild(el('li', {}, [el('div', { 'class': 'mud-topo' }, [el('b', { texto: p.codigo }), el('span', { 'class': 'selo st-reprovada', texto: 'Não atualizada' })]), el('p', { 'class': 'mud-texto', texto: e.message })]));
      }
    }
    $('u-progresso').textContent = ok + ' de ' + cods.length + ' atualizadas. Avise quem pediu: o e-mail já sai escrito, com o link da versão nova.';
    try { pedidos = await R.listar(ctx.sistema.registro, ctx.token); } catch (e) { /* mantém */ }
    kpis(); desenhar();
    b.disabled = false;
  }

  function kpis() {
    var aprov = pedidos.filter(function (p) { return p.status === 'aprovada' && p.conteudo; });
    var velhas = aprov.filter(function (p) { return p.versao_marca !== marca.versao || String(p.ciclo_tendencias) !== String(tendencias.ciclo); });
    var caixa = $('u-kpis'); caixa.textContent = '';
    [[velhas.length, 'com visual anterior'], [aprov.length, 'peças aprovadas em uso'], [marca.versao, 'versão da marca'], ['KA ' + tendencias.ciclo, tendencias.conceito || 'Key Art atual']].forEach(function (k) {
      caixa.appendChild(el('div', { 'class': 'kpi' }, [el('b', { texto: String(k[0]), style: String(k[0]).length > 6 ? 'font-size:24px' : '' }), el('span', { texto: k[1] })]));
    });
  }

  async function iniciar(c) {
    ctx = c;
    try {
      var r = await Promise.all([json('config/marca.json'), json('config/tendencias.json'), json('config/formatos/indice.json'), json('config/campanhas.json').catch(function () { return { lista: [] }; })]);
      marca = r[0]; tendencias = r[1]; indice = r[2]; campanhas = r[3];
      tendencias.campanhasTematicas = campanhas; window.UnimedTendencias = tendencias;
      indice.formatos.forEach(function (f) { if (f.ativo) nomesFormato[f.id] = f.nome; });
      pedidos = await R.listar(c.sistema.registro || {}, c.token);
    } catch (e) { $('origem').hidden = false; $('origem').textContent = e.message; return; }
    campanhas.lista.forEach(function (x) { $('u-campanha').appendChild(el('option', { value: x.nome, texto: x.nome })); });
    Object.keys(nomesFormato).forEach(function (id) { $('u-formato').appendChild(el('option', { value: id, texto: nomesFormato[id] })); });
    ['u-linha', 'u-campanha', 'u-formato', 'u-antigas'].forEach(function (id) { $(id).addEventListener('change', desenhar); });
    $('u-todas').addEventListener('change', function () { document.querySelectorAll('#u-linhas input:not(:disabled)').forEach(function (x) { x.checked = $('u-todas').checked; }); resumo(); });
    $('u-gerar').addEventListener('click', gerar);
    kpis(); desenhar();
  }
  Ac.proteger({ pagina: 'atualizar.html', aoLiberar: iniciar });
})();
