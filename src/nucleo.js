/* Núcleo da Marca: mostra as regras fixas lidas de config/marca.json. */
(function () {
  'use strict';
  var A = window.UnimedAcesso, el = A.el;
  var NOMES_COR = { institucional: 'Verde institucional', escuro: 'Verde escuro', petroleo: 'Petróleo', citrico: 'Cítrico', agua: 'Água', amarelo: 'Amarelo', laranja: 'Laranja', laranjaEscuro: 'Laranja escuro', areia: 'Areia', pastelAmarelo: 'Pastel amarelo', pastelVerde: 'Pastel verde', pastelAzul: 'Pastel azul', branco: 'Branco', fundoPagina: 'Fundo de página', texto: 'Texto', textoForte: 'Texto forte', textoSuave: 'Texto suave', borda: 'Borda', link: 'Link' };

  function cartao(titulo, sub, filhos) {
    return el('div', { 'class': 'cartao bloco' }, [el('h2', { texto: titulo }), sub ? el('p', { 'class': 'sub', texto: sub }) : null].concat(filhos));
  }

  async function iniciar() {
    var m;
    try { m = await fetch('config/marca.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
    catch (e) { document.getElementById('nucleo').appendChild(el('p', { 'class': 'alerta erro', texto: 'Não foi possível ler config/marca.json.' })); return; }
    var alvo = document.getElementById('nucleo');

    alvo.appendChild(el('div', { 'class': 'kpis' }, [
      el('div', { 'class': 'kpi' }, [el('b', { texto: m.versao }), el('span', { texto: 'versão da marca' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(Object.keys(m.cores).length) }), el('span', { texto: 'cores' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(m.imagensAprovadas.length) }), el('span', { texto: 'imagens aprovadas' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(m.areas.length) }), el('span', { texto: 'áreas cadastradas' })])
    ]));

    alvo.appendChild(cartao('Cores', 'Valores oficiais usados por todos os modelos.', [
      el('div', { 'class': 'amostras' }, Object.keys(m.cores).map(function (k) {
        return el('div', { 'class': 'amostra' }, [el('i', { style: 'background:' + m.cores[k] }), el('b', { texto: NOMES_COR[k] || k }), el('code', { texto: m.cores[k] })]);
      }))
    ]));

    alvo.appendChild(el('div', { 'class': 'graficos' }, [
      cartao('Tipografia', m.tipografia._nota, [
        el('p', { 'class': 'tipo-amostra', style: 'font-weight:900;text-transform:uppercase', texto: 'Humano por natureza' }),
        el('p', { 'class': 'detalhe' }, [el('b', { texto: 'Família: ' }), el('code', { texto: m.tipografia.familia })]),
        el('p', { 'class': 'detalhe' }, [el('b', { texto: 'Slab: ' }), el('code', { texto: m.tipografia.familiaSlab })])
      ]),
      cartao('Forma box', m.forma._nota, [
        el('div', { 'class': 'formas' }, [
          el('div', { 'class': 'forma', style: 'border-radius:' + m.forma.raioCard }, [el('span', { texto: 'Card · ' + m.forma.raioCard })]),
          el('div', { 'class': 'forma botao', style: 'border-radius:' + m.forma.raioBotao }, [el('span', { texto: 'Botão' })])
        ])
      ])
    ]));

    alvo.appendChild(cartao('Logos', m.logos._regra, [
      el('div', { 'class': 'logos' }, [
        el('div', { 'class': 'logo claro' }, [el('img', { src: m.logos.claro, alt: 'Logo Unimed Uberlândia em fundo claro' })]),
        el('div', { 'class': 'logo escuro' }, [el('img', { src: m.logos.escuro, alt: 'Logo Unimed Uberlândia em fundo escuro' })])
      ])
    ]));

    alvo.appendChild(cartao('Imagens aprovadas', 'Só estas aparecem para escolha no gerador.', [
      el('div', { 'class': 'galeria' }, m.imagensAprovadas.map(function (i) {
        return el('figure', {}, [el('img', { src: i.arquivo, alt: i.descricao, loading: 'lazy' }), el('figcaption', { texto: i.descricao })]);
      }))
    ]));

    alvo.appendChild(el('div', { 'class': 'graficos' }, [
      cartao('Áreas', 'Aparecem na lista "Sua área" de quem pede.', [el('ul', { 'class': 'pilulas' }, m.areas.map(function (a) { return el('li', { texto: a }); }))]),
      cartao('Rodapé', 'Assinatura usada nas peças.', [
        el('p', { 'class': 'detalhe', texto: m.rodape.assinatura }),
        el('p', { 'class': 'detalhe', texto: m.rodape.site }),
        el('p', { 'class': 'detalhe', texto: m.rodape.coordenadas })
      ])
    ]));

    alvo.appendChild(el('p', { 'class': 'rodape-nota', texto: 'Para mudar uma regra, altere config/marca.json e suba o número da versão.' }));
  }

  A.proteger({ pagina: 'nucleo.html', aoLiberar: iniciar });
})();
