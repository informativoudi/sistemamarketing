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
      el('div', { 'class': 'kpi' }, [el('b', { texto: String(((m.setores || {}).lista || []).length) }), el('span', { texto: 'setores' })])
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
    if (m.icones && (m.icones.porPalavra || m.icones.porArea)) {
      var regrasIc = m.icones.porPalavra || [];
      // Quantos setores reais caem em cada ícone (mesma regra do gerador).
      var setores = (m.setores && m.setores.lista) || [];
      var achar = function (nome) {
        var a = nome.toLowerCase();
        var r = regrasIc.filter(function (x) { return x.palavras.some(function (w) { return new RegExp('(^|[^a-zà-ú])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(a); }); })[0];
        return r ? r.icone : m.icones.padrao;
      };
      var porIcone = {};
      setores.forEach(function (st) { var k = achar(st.nome); (porIcone[k] = porIcone[k] || []).push(st.nome); });
      var icones = Object.keys(porIcone).sort(function (a, b) { return porIcone[b].length - porIcone[a].length; });
      alvo.appendChild(cartao('Ícones das áreas', setores.length + ' setores, cada um com o ícone escolhido pelas palavras do nome. Passe o mouse para ver os setores.', [
        regra(m.icones._regra),
        el('div', { 'class': 'icones-area' }, icones.map(function (k) {
          return el('figure', { title: porIcone[k].join('\n') }, [
            el('span', { 'class': 'icone-quadro', style: 'background:' + m.cores.verdeEscuro }, [el('img', { src: m.icones.pasta + k + '.svg', alt: '' })]),
            el('figcaption', {}, [el('b', { texto: ({ 'rede-assistencial-regulacao': 'Rede e assistência', 'rotinas-administrativas': 'Administrativo', relatorios: 'Gestão e números', 'governanca-auditoria': 'Governança', 'tecnologia-sistemas': 'Tecnologia', 'gestao-de-chamados': 'Atendimento', 'juridico-ouvidoria': 'Jurídico e ouvidoria', 'apoio-ao-colaborador': 'Pessoas', 'assessoria-processos-projetos': 'Processos e projetos', 'comercial-relacionamento': 'Comunicação', 'relacionamento-cooperado': 'Cooperado', 'bem-vindo': 'Padrão', 'abra-seu-chamado': 'Chamados' })[k] || k.replace(/-/g, ' ') }), el('span', { 'class': 'sub', texto: ' · ' + porIcone[k].length + (porIcone[k].length > 1 ? ' setores' : ' setor') })])
          ]);
        }))
      ]));
    }
    if (m.icones && m.icones.padraoPorTema) {
      var pt = m.icones.padraoPorTema;
      alvo.appendChild(cartao('Ícones por tema', null, [
        regra(pt._regra),
        el('div', { 'class': 'temas-icones' }, Object.keys(pt).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (t) {
          return el('div', { 'class': 'tema-icones' }, [el('b', { texto: t }), el('ul', { 'class': 'pilulas' }, pt[t].map(function (x) { return el('li', { texto: x }); }))]);
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

    // Banco de imagens por tema e filial (filtro por tema).
    var temasBanco = ((m.bancoImagens || {}).temas) || [];
    var galeria = el('div', { 'class': 'galeria' });
    var desenharGaleria = function (tema) {
      galeria.textContent = '';
      m.imagensAprovadas.filter(function (i) { return !tema || (i.temas || []).indexOf(tema) >= 0; }).forEach(function (i) {
        galeria.appendChild(el('figure', {}, [el('img', { src: i.arquivo, alt: i.descricao, loading: 'lazy' }), el('figcaption', {}, [i.descricao,
          el('span', { 'class': 'tags' }, (i.temas || []).map(function (t) { return el('span', { 'class': 'selo', texto: t }); }).concat((i.filiais || []).length ? [el('span', { 'class': 'selo st-aprovada', texto: i.filiais.join(', ') })] : [el('span', { 'class': 'selo st-substituida', texto: 'Todas as filiais' })]))])]));
      });
    };
    var filtros = el('div', { 'class': 'segmento filtro-temas', role: 'radiogroup', 'aria-label': 'Filtrar por tema' });
    [''].concat(temasBanco).forEach(function (t, i) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': i === 0 ? 'true' : 'false', texto: t || 'Todas', onclick: function () {
        filtros.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', 'false'); }); b.setAttribute('aria-checked', 'true'); desenharGaleria(t);
      } });
      filtros.appendChild(b);
    });
    desenharGaleria('');
    alvo.appendChild(cartao('Banco de imagens', m.imagensAprovadas.length + ' imagens. No gerador, as do tema escolhido e da filial de quem pede aparecem primeiro. Quem pede também pode enviar a própria imagem; o recorte e os cantos da marca são aplicados igual.', [
      regra((m.bancoImagens || {})._regra), filtros, galeria
    ]));

    // Assinatura em letras dos serviços e recursos próprios (MS.024).
    var at = m.assinaturaTextual;
    if (at && at.servicos) {
      alvo.appendChild(cartao('Assinatura dos serviços próprios', at.quando || null, [
        regra(at._regra),
        el('div', { 'class': 'assinaturas' }, Object.keys(at.servicos).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) {
          var sv = at.servicos[k];
          return el('figure', { 'class': 'assinatura-ms' }, [
            el('div', { 'class': 'assinatura-box' }, [el('p', { 'class': 'as-nome', texto: sv.nome }), sv.apoio ? el('p', { 'class': 'as-apoio', texto: sv.apoio }) : null]),
            el('figcaption', { texto: k })
          ]);
        })),
        el('p', { 'class': 'ajuda', texto: 'Fonte: ' + (at.fonte || 'MS.024') + '. Edite nomes e frases de apoio em config/marca.json → assinaturaTextual.servicos.' })
      ]));
    }

    var lista = (m.setores && m.setores.lista) || [];
    var porFilial = {};
    lista.forEach(function (st) { (porFilial[st.filial] = porFilial[st.filial] || []).push(st.nome); });
    alvo.appendChild(cartao('Setores', lista.length + ' setores em ' + Object.keys(porFilial).length + ' filiais. Aparecem na primeira tela ("Seu setor") e viram o cabeçalho da peça e a assinatura do e-mail.', Object.keys(porFilial).map(function (f) {
      return el('details', { 'class': 'filial' }, [el('summary', {}, [el('b', { texto: f }), ' · ' + porFilial[f].length]), el('ul', { 'class': 'pilulas' }, porFilial[f].map(function (a) { return el('li', { texto: a }); }))]);
    })));

    // Campanhas do ano (config/campanhas.json).
    try {
      var cs = await fetch('config/campanhas.json', { cache: 'no-store' }).then(function (r) { return r.json(); });
      alvo.appendChild(cartao('Campanhas do ano', cs.guardaChuva ? 'Todas debaixo do guarda-chuva ' + cs.guardaChuva.nome + '. Cada uma ajusta a Key Art da linha: estilo, destaque, selo e ícones.' : null, [
        el('div', { 'class': 'campanhas-cards' }, cs.lista.map(function (c) {
          return el('div', { 'class': 'campanha-card', style: '--cor:' + (m.cores[c.destaque] || ({ rosa: '#f4aab8', amarelo: '#f9b000', citrico: '#d3d92b' })[c.destaque] || m.cores.citrico) + ';cursor:default' }, [
            el('span', { 'class': 'campanha-nome', texto: c.nome }),
            el('span', { 'class': 'campanha-info', texto: (c.periodo || '') + ' · linhas: ' + (c.linhas || []).join(' e ') + ' · estilo ' + c.estiloPadrao + (c.aguardandoMaterial ? ' · aguardando material' : '') }),
            el('p', { 'class': 'detalhe', style: 'margin:8px 0 0;font-size:13px', texto: c.essencia })
          ]);
        }))
      ]));
    } catch (e) { /* sem campanhas */ }

    // Mudanças nas regras: feitas com o Claude (licença do Marketing), que altera os arquivos e publica no GitHub.
    alvo.appendChild(el('section', { 'class': 'cartao bloco como-mudar' }, [
      el('h2', { texto: 'Como mudar uma regra' }),
      el('p', { 'class': 'sub' }, ['As áreas pedem mudanças em ', el('a', { href: 'mudanca.html', texto: 'Pedir mudança' }), ' e o Marketing acompanha em ', el('a', { href: 'mudancas.html', texto: 'Pedidos de mudança' }), '.']),
      el('p', { 'class': 'sub', texto: 'Para fazer a mudança, peça ao Claude em palavras (ex.: "inclua a área Ouvidoria", "na peça quadrada, limite o título a 60 caracteres"). Ele altera os arquivos de regras, mostra o que mudou e publica no GitHub. O site atualiza em 1 a 2 minutos.' }),
      el('p', { 'class': 'ajuda', texto: 'As regras ficam em config/marca.json (marca) e config/formatos/ (cada formato). Também dá para editar direto no GitHub.' })
    ]));
  }

  A.proteger({ pagina: 'nucleo.html', aoLiberar: iniciar });
})();
