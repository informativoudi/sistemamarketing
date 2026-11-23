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

    var linhas = t.campanhas || (t.campanha ? { externa: t.campanha } : null);
    if (linhas) {
      var cores = {};
      try { cores = (await fetch('config/marca.json', { cache: 'no-store' }).then(function (r) { return r.json(); })).cores || {}; } catch (e) { cores = {}; }
      var cor = function (k) { return cores[k] || k; };
      var nomeTend = function (id) { return (lista.filter(function (x) { return x.id === id; })[0] || {}).nome || id; };
      var ka = t.keyArt || {}, pal = ka.paleta || {}, est = ka.estilos || {};
      var corKA = function (k) { return pal[k] || cor(k); };
      var cartaoLinha = function (chave, l) {
        var e = est[l.estiloPadrao] || {};
        var amostra = el('div', { 'class': 'linha-amostra', style: 'background:' + corKA(e.fundo || 'petroleo') + ';color:' + corKA(e.texto || 'branco') }, [
          el('span', { style: 'color:' + corKA(e.legenda || 'citrico'), texto: ((l.selo || l.nome || chave) + ' · ' + (e.nome || '')).toUpperCase() }),
          el('b', { style: 'text-transform:uppercase;font-weight:900', texto: 'Título ' }),
          el('i', { style: 'background:' + corKA('laranja') })
        ]);
        amostra.querySelector('b').appendChild(el('em', { style: 'font-family:\'Unimed Slab\',Georgia,serif;font-style:normal;text-transform:none;color:' + corKA(e.destaque || 'citrico'), texto: 'campanha' }));
        return el('article', { 'class': 'linha-campanha' }, [
          amostra,
          el('h3', { texto: l.nome || chave }),
          el('p', { 'class': 'sub', texto: (l.fala ? 'Fala com: ' + l.fala + '. ' : '') + (l.tom || '') }),
          el('ul', { 'class': 'linha-regras' }, [
            el('li', { texto: 'Marca: ' + (l.marca === 'interno' ? 'Grupo Unimed Uberlândia' : 'Unimed Uberlândia (sempre a original, box verde)') + (l.ans ? ' + registro ANS' : ' · sem ANS') }),
            el('li', { texto: 'Estilos da Key Art: ' + (l.estilos || []).map(function (k) { return (est[k] || {}).nome || k; }).join(', ') + ' · padrão: ' + ((est[l.estiloPadrao] || {}).nome || l.estiloPadrao || '—') }),
            el('li', { texto: 'Tendências: ' + ((l.tendencias || []).map(nomeTend).join(', ') || '—') }),
            el('li', { texto: 'Mote: ' + (l.mote || '—') })
          ])
        ]);
      };
      alvo.appendChild(el('div', { 'class': 'cartao bloco campanha-radar' }, [
        el('h2', { texto: 'Linhas de campanha' }),
        el('p', { 'class': 'sub', texto: (t.campanhas && t.campanhas._regra) || ('Visual principal: ciclo ' + t.ciclo + '.') }),
        el('div', { 'class': 'linhas-campanha' }, Object.keys(linhas).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return cartaoLinha(k, linhas[k]); }))
      ]));
    }

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

    alvo.appendChild(el('section', { 'class': 'cartao bloco como-mudar' }, [
      el('h2', { texto: 'Como mudar as tendências' }),
      el('p', { 'class': 'sub', texto: 'Peça ao Claude em palavras (ex.: "coloque a tendência X em ativa", "crie o branding da campanha do Outubro Rosa"). Ele altera config/tendencias.json, mostra o que mudou e publica no GitHub. O ciclo ' + (t.ciclo || '2027') + ' continua o principal até você dizer o contrário.' })
    ]));
  }

  A.proteger({ pagina: 'radar.html', aoLiberar: iniciar });
})();
