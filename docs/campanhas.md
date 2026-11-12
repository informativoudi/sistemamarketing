# Campanhas: Key Art 2027, linha externa e linha interna

As campanhas usam a **Key Art 2027 · "Humano por natureza"** com todo o visual da tendência:
- **Neo-brutalismo e tipo cru:** título em tipografia mista (Black e Light em caixa alta, com uma palavra em Slab na cor de destaque) e o ponto laranja no fim.
- **Prova de processo:** grade de 12 colunas à mostra, marcas de corte, "FIG.01", coordenadas de Uberlândia e "KV 2027".
- **Texturas reais:** grão de papel ou papel claro.
- **Elementos:** mosaico de formas, pílulas e pontos com retícula, o símbolo em 3D e cards com ícones de linha.
- **Sombra dura e borda firme** nos botões e cards dos fundos claros.

## Regra fixa da marca

A marca **Unimed Uberlândia é sempre a original**, com o box verde e as letras brancas, em qualquer fundo. A versão de box branco nunca é usada (está em `config/marca.json`).

## Estilos da Key Art

| Estilo | Visual |
|---|---|
| Foto (Master) | Fundo petróleo e foto no quadro box, com marcas de corte e FIG. |
| Mosaico | Fundo petróleo com o mosaico de formas (a foto entra como um bloco do mosaico) |
| Pílulas e pontos | Papel claro, pílulas, retícula e o símbolo Unimed em 3D (a foto vira uma cápsula) |
| Ícones | Fundo amarelo, cards com ícones de linha e a faixa do mosaico |

- **Escolha do estilo:** no campo **Estilo da key art**. Em "Automático", vale o padrão da linha.
- **Estilo Ícones:** escreva até 6 palavras em **Destaques com ícone** e cada uma vira um card com o ícone mais próximo.
- **Palavra em Slab:** é a última palavra forte do título. Para escolher outra, escreva-a entre `*asteriscos*`.

## As duas linhas

| | Campanha externa | Campanha interna |
|---|---|---|
| Fala com | Clientes, beneficiários, cooperados e a cidade | Colaboradores e cooperados |
| Marca | Unimed Uberlândia (original) + registro ANS | Grupo Unimed Uberlândia, sem ANS |
| Selo | — | "Campanha interna" no chapéu |
| Estilo padrão | Foto (Master) | Ícones |

As regras ficam em `config/tendencias.json`: o bloco `keyArt` (paleta e estilos) e o bloco `campanhas` (`externa` e `interna`).

## Kit de campanha (KV + desdobramentos)

| Externa | Interna |
|---|---|
| KV principal · 1920 × 1080 | KV principal · 1920 × 1080 |
| Post feed · 1080 × 1350 | Post Viva Engage · 1080 × 1080 |
| Story · 1080 × 1920 | E-mail da campanha · HTML 600 px |
| E-mail da campanha · HTML 600 px | Banner intranet · 1500 × 500 |
| Banner site · 1500 × 500 | |

- **Downloads:** por peça (PNG, JPG, PDF no KV, HTML no e-mail) ou tudo junto em **Baixar o kit completo (.zip)**.
- **Peças avulsas:** os formatos de imagem com "Campanha externa" ou "Campanha interna" usam o mesmo desenho.
- **Para mudar as peças do kit:** edite a lista `kit` em `config/formatos/campanha-kit.json`.
