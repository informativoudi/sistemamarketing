/* Núcleo da Marca: mostra as regras fixas lidas de config/marca.json (vindas dos manuais oficiais). */
(function () {
  'use strict';
  var A = window.UnimedAcesso, el = A.el;

  function cartao(titulo, sub, filhos) {
    return el('div', { 'class': 'cartao bloco' }, [el('h2', { texto: titulo }), sub ? el('p', { 'class': 'sub', texto: sub }) : null].concat(filhos));
  }
  function regra(texto) { return texto ? el('p', { 'class': 'regra', texto: texto }) : null; }

  async function iniciar() {
    var m;
    var alvo = document.getElementById('nucleo');
    try { m = await fetch('config/marca.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
    catch (e) { alvo.appendChild(el('p', { 'class': 'alerta erro', texto: 'Não foi possível ler config/marca.json.' })); return; }
    var cores = Object.keys(m.cores).filter(function (k) { return k.charAt(0) !== '_'; });

    alvo.appendChild(el('div', { 'class': 'kpis' }, [
      el('div', { 'class': 'kpi' }, [el('b', { texto: m.versao }), el('span', { texto: 'versão da marca' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(cores.length) }), el('span', { texto: 'cores' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(m.imagensAprovadas.length) }), el('span', { texto: 'imagens aprovadas' })]),
      el('div', { 'class': 'kpi' }, [el('b', { texto: String((m.fontes || []).length) }), el('span', { texto: 'manuais de origem' })])
    ]));

    if (m.fontes) {
      alvo.appendChild(cartao('Manuais de origem', 'As regras abaixo vêm destes documentos.', [
        el('ul', { 'class': 'pilulas' }, m.fontes.map(function (f) { return el('li', { texto: f.nome + ' · ' + f.codigo }); }))
      ]));
    }

    alvo.appendChild(cartao('Logos', null, [
      regra(m.logos._regra),
      el('div', { 'class': 'logos' }, ['interno', 'externo'].map(function (k) {
        var l = m.logos[k];
        return el('figure', { 'class': 'logo-uso' }, [
          el('div', { 'class': 'logo claro' }, [el('img', { src: l.svg || l.claro, alt: 'Logo ' + l.nome })]),
          el('figcaption', {}, [el('b', { texto: k === 'interno' ? 'Interno' : 'Externo' }), ' · ' + l.nome])
        ]);
      })),
      m.ans ? el('p', { 'class': 'detalhe' }, [el('img', { src: m.ans.selo, alt: 'ANS - nº ' + m.ans.numero, style: 'height:20px;vertical-align:middle;margin-right:10px' }), m.ans._regra]) : null
    ]));

    alvo.appendChild(cartao('Cores', null, [
      regra(m.cores._regra),
      el('div', { 'class': 'amostras' }, cores.map(function (k) {
        return el('div', { 'class': 'amostra' }, [el('i', { style: 'background:' + m.cores[k] }), el('b', { texto: (m.nomesCores && m.nomesCores[k]) || k }), el('code', { texto: m.cores[k] })]);
      }))
    ]));

    if (m.papeisCores) {
      var pc = m.papeisCores;
      var nomesPapel = { marca: 'Marca', estrutura: 'Estrutura', acao: 'Ação (botão)', destaque: 'Destaque', fundo: 'Fundo', texto: 'Texto' };
      alvo.appendChild(cartao('Papel de cada cor', null, [
        regra(pc._regra),
        el('div', { 'class': 'papeis' }, Object.keys(pc).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) {
          var cor = pc[k].cor === 'apoio'
            ? ['apoioAreia', 'apoioVerde', 'apoioAzul', 'apoioAmarelo'].map(function (a) { return m.cores[a]; })
            : [m.cores[pc[k].cor]];
          return el('div', { 'class': 'papel' }, [
            el('div', { 'class': 'papel-cores' }, cor.map(function (c) { return el('i', { style: 'background:' + c }); })),
            el('div', {}, [el('b', { texto: nomesPapel[k] || k }), el('p', { texto: pc[k].uso })])
          ]);
        }))
      ]));
    }
    if (m.icones && m.icones.porArea) {
      alvo.appendChild(cartao('Ícones das áreas', null, [
        regra(m.icones._regra),
        el('div', { 'class': 'icones-area' }, Object.keys(m.icones.porArea).map(function (a) {
          return el('figure', {}, [
            el('span', { 'class': 'icone-quadro', style: 'background:' + m.cores.verdeEscuro }, [el('img', { src: m.icones.pasta + m.icones.porArea[a] + '.svg', alt: '' })]),
            el('figcaption', { texto: a })
          ]);
        }))
      ]));
    }

    var hier = (m.tipografia && m.tipografia.hierarquia) || {};
    alvo.appendChild(el('div', { 'class': 'graficos' }, [
      cartao('Tipografia', null, [
        regra(m.tipografia._regra),
        el('p', { 'class': 'tipo-amostra', style: 'font-weight:700', texto: 'Presença que transforma' }),
        el('ul', { 'class': 'hierarquia' }, Object.keys(hier).map(function (k) {
          var nomes = { chapeu: 'Chapéu', titulo: 'Título', subtitulo: 'Subtítulo', tituloSecundario: 'Intertítulo', texto: 'Texto' };
          return el('li', {}, [el('b', { texto: (nomes[k] || k) + ': ' }), hier[k]]);
        }))
      ]),
      cartao('Forma box', null, [
        regra(m.forma._regra),
        el('div', { 'class': 'formas' }, [
          el('div', { 'class': 'forma', style: 'border-radius:' + m.forma.raioCard }, [el('span', { texto: 'Card' })]),
          el('div', { 'class': 'forma botao', style: 'border-radius:' + m.forma.raioBotao }, [el('span', { texto: 'Botão' })])
        ])
      ])
    ]));

    if (m.linguagem) {
      alvo.appendChild(cartao('Tom de voz', null, [
        regra(m.linguagem._regra),
        el('ul', { 'class': 'hierarquia' }, m.linguagem.principios.map(function (p) { return el('li', { texto: p }); })),
        el('p', { 'class': 'detalhe' }, [el('b', { texto: 'O gerador avisa quando encontra: ' }), 'título só em maiúsculas, mais de ' + m.linguagem.maxExclamacoes + ' exclamação, frases com mais de ' + m.linguagem.frasesLongasPalavras + ' palavras, listas com mais de ' + m.linguagem.maxItensLista + ' itens, botão genérico e estrangeirismos (' + Object.keys(m.linguagem.estrangeirismos).length + ' termos na lista).'])
      ]));
    }

    alvo.appendChild(cartao('Imagens aprovadas', m.fotografia ? m.fotografia._regra : 'Só estas aparecem para escolha no gerador.', [
      el('div', { 'class': 'galeria' }, m.imagensAprovadas.map(function (i) {
        return el('figure', {}, [el('img', { src: i.arquivo, alt: i.descricao, loading: 'lazy' }), el('figcaption', { texto: i.descricao })]);
      }))
    ]));

    alvo.appendChild(cartao('Áreas', 'Aparecem na lista "Sua área" e viram o cabeçalho e a assinatura do e-mail.', [
      el('ul', { 'class': 'pilulas' }, m.areas.map(function (a) { return el('li', { texto: a }); }))
    ]));

    alvo.appendChild(el('p', { 'class': 'rodape-nota', texto: 'Para mudar uma regra, peça ao assistente acima (ou altere config/marca.json e suba o número da versão).' }));

    // Assistente com IA: mudanças na marca e nos formatos.
    var indice = await fetch('config/formatos/indice.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return { formatos: [] }; });
    var escolhaFormato;
    if (window.UnimedAssistente) window.UnimedAssistente.montar(alvo, {
      area: 'nucleo',
      titulo: 'Pedir mudança na marca',
      descricao: 'Peça em palavras o que mudar nas regras da marca ou de um formato. O assistente mostra o antes e o depois; você testa na prévia e só publica se aprovar.',
      placeholder: 'Ex.: inclua a área "Ouvidoria" com o ícone de atendimento; limite o título da peça quadrada a 60 caracteres…',
      exemplos: ['Inclua a área "Ouvidoria" na lista de áreas', 'Na peça quadrada, limite o título a 60 caracteres', 'Tire o PDF dos downloads do Banner Portal', 'Mude o mote do fechamento para "Cuidar é o que nos move"'],
      extra: function () {
        escolhaFormato = el('select', { id: 'assistente-formato' }, [el('option', { value: '', texto: 'Só as regras da marca' })].concat(indice.formatos.filter(function (f) { return f.ativo; }).map(function (f) { return el('option', { value: f.id, texto: 'Marca + formato ' + f.nome }); })));
        return el('div', { 'class': 'campo assistente-escopo' }, [el('label', { 'for': 'assistente-formato', texto: 'O que o assistente pode mexer' }), escolhaFormato]);
      },
      arquivos: async function () {
        var arq = { 'config/marca.json': await fetch('config/marca.json', { cache: 'no-store' }).then(function (r) { return r.json(); }) };
        var f = escolhaFormato && escolhaFormato.value;
        if (f) arq['config/formatos/' + f + '.json'] = await fetch('config/formatos/' + f + '.json', { cache: 'no-store' }).then(function (r) { return r.json(); });
        return arq;
      }
    });
  }

  A.proteger({ pagina: 'nucleo.html', aoLiberar: iniciar });
})();
