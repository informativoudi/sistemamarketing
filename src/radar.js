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

    if (t.campanha) {
      var cores = {};
      try { cores = (await fetch('config/marca.json', { cache: 'no-store' }).then(function (r) { return r.json(); })).cores || {}; } catch (e) { cores = {}; }
      var cor = function (k) { return cores[k] || k; };
      alvo.appendChild(el('div', { 'class': 'cartao bloco campanha-radar' }, [
        el('h2', { texto: 'Campanhas internas e externas' }),
        el('p', { 'class': 'sub', texto: 'Visual principal: ciclo ' + t.ciclo + (t.conceito ? ' · "' + t.conceito + '"' : '') + '. Vale para as peças de imagem marcadas como Campanha interna ou Campanha externa (o e-mail marketing segue só Interno e Externo).' }),
        el('div', { 'class': 'papeis' }, [
          el('div', { 'class': 'papel' }, [el('div', { 'class': 'papel-cores' }, [el('i', { style: 'background:' + cor(t.campanha.fundo) })]), el('div', {}, [el('b', { texto: 'Fundo' }), el('p', { texto: t.campanha.fundo })])]),
          el('div', { 'class': 'papel' }, [el('div', { 'class': 'papel-cores' }, [el('i', { style: 'background:' + cor(t.campanha.destaque) })]), el('div', {}, [el('b', { texto: 'Destaque' }), el('p', { texto: t.campanha.destaque })])]),
          el('div', { 'class': 'papel' }, [el('div', {}, [el('b', { texto: 'Mote' }), el('p', { texto: t.campanha.mote || '—' })])])
        ])
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

    alvo.appendChild(el('p', { 'class': 'rodape-nota', texto: 'Para ligar, desligar ou criar tendências, peça ao assistente acima (ou troque o status em config/tendencias.json).' }));

    if (window.UnimedAssistente) window.UnimedAssistente.montar(alvo, {
      area: 'radar',
      titulo: 'Pedir ao assistente de tendências',
      descricao: 'Puxe tendências, ligue ou desligue, ou peça um branding novo ou ajustado para as campanhas internas e externas. O ' + (t.ciclo || '2027') + ' continua o principal até você dizer o contrário.',
      placeholder: 'Ex.: crie um branding para a campanha de inverno usando o azul de apoio como destaque…',
      exemplos: ['Coloque o "Bento assimétrico dark & neon" em ativa', 'Desligue a textura real nas campanhas', 'Crie um branding de campanha para o Outubro Rosa, mantendo o 2027 como base', 'Troque o destaque das campanhas para o laranja?'],
      arquivos: async function () {
        return {
          'config/tendencias.json': await fetch('config/tendencias.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
          'config/marca.json': await fetch('config/marca.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
        };
      }
    });
  }

  A.proteger({ pagina: 'radar.html', aoLiberar: iniciar });
})();
