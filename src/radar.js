/* Radar de Tendências: mostra o ciclo e o status de cada tendência (config/tendencias.json). */
(function () {
  'use strict';
  var A = window.UnimedAcesso, el = A.el;
  var STATUS = { ativa: ['Ativa', 'ok', 'Chega às peças geradas.'], teste: ['Em teste', 'teste', 'Guardada; não aparece nas peças.'], arquivada: ['Arquivada', 'arquivada', 'Ciclo encerrado.'] };

  async function iniciar() {
    var alvo = document.getElementById('radar');
    var t;
    try { t = await fetch('config/tendencias.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
    catch (e) { alvo.appendChild(el('p', { 'class': 'alerta erro', texto: 'Não foi possível ler config/tendencias.json.' })); return; }
    var lista = t.tendencias || [];
    var conta = function (s) { return lista.filter(function (x) { return x.status === s; }).length; };

    alvo.appendChild(el('div', { 'class': 'kpis' }, [
      el('div', { 'class': 'kpi' }, [el('b', { texto: t.ciclo }), el('span', { texto: 'ciclo' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: t.conceito, style: 'font-size:22px;line-height:1.15' }), el('span', { texto: 'conceito guarda-chuva' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(conta('ativa')) }), el('span', { texto: 'ativas' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(conta('teste')) }), el('span', { texto: 'em teste' })])
    ]));

    var ordem = { ativa: 0, teste: 1, arquivada: 2 };
    alvo.appendChild(el('div', { 'class': 'tendencias' }, lista.slice().sort(function (a, b) { return (a.status in ordem ? ordem[a.status] : 9) - (b.status in ordem ? ordem[b.status] : 9); }).map(function (x) {
      var s = STATUS[x.status] || [x.status, '', ''];
      return el('article', { 'class': 'cartao tendencia ' + s[1] }, [
        el('div', { 'class': 'tendencia-topo' }, [el('span', { 'class': 'selo ' + s[1], texto: s[0] }), el('code', { texto: x.id })]),
        el('h3', { texto: x.nome }),
        el('p', { texto: x.comoAplica }),
        el('p', { 'class': 'detalhe', texto: s[2] })
      ]);
    })));

    alvo.appendChild(el('p', { 'class': 'rodape-nota', texto: 'Para ligar ou desligar uma tendência, troque o status em config/tendencias.json: "ativa", "teste" ou "arquivada".' }));
  }

  A.proteger({ pagina: 'radar.html', aoLiberar: iniciar });
})();
