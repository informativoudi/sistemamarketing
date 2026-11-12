# Unimed Uberlândia · Sistema de Marca e Gerador de Peças

Qualquer área da Unimed escolhe o formato, preenche o conteúdo e recebe a peça pronta no padrão da marca. Tudo funciona por **regras e árvores de decisão**, sem IA e sem custo por uso. Cada peça gerada fica registrada com um código único.

**Piloto:** e-mail marketing. Os outros formatos aparecem como "em breve" e são liberados um a um.

## Como está organizado

```
config/
  marca.json            Núcleo da Marca: cores, tipografia, forma box, logos, imagens aprovadas, áreas
  tendencias.json       Radar de Tendências: cada tendência com status ativa / teste / arquivada
  sistema.json          Configuração técnica (onde os pedidos são registrados)
  formatos/
    indice.json         Catálogo de formatos (ativo ou "em breve")
    email-marketing.json  Campos, limites e árvore de decisão do e-mail
src/
  motor.js              Valida o que foi preenchido e aplica a árvore de decisão
  modelos/
    email-marketing.js  Desenha o e-mail (HTML em tabelas, compatível com Outlook e Gmail)
  registro.js           Grava cada pedido (navegador ou banco Supabase)
  app.js                Tela de uso
  acesso.js             Login da área restrita (Entrar com GitHub) e permissões
  painel.js             Painel de administração
  nucleo.js / radar.js  Telas do Núcleo da Marca e do Radar de Tendências
  acessos.js            Incluir e remover quem entra na área restrita
  ui.css                Visual da interface
assets/                 Logos (PNG para e-mail), fotos aprovadas, fontes
index.html              Tela "O que você precisa criar?" (aberta para todos)
painel.html             Área restrita · pedidos por área, formato, tempo e "Conferir peça"
nucleo.html             Área restrita · regras fixas da marca
radar.html              Área restrita · tendências do ciclo e status
acessos.html            Área restrita · quem tem acesso (só "dono")
docs/                   Guia de atualização, área restrita e script do banco
```

## Como a árvore decide (e-mail marketing)

| Situação | Decisão |
|---|---|
| Texto até 300 caracteres | Modelo **curto**: título grande, sem imagem, data em destaque |
| Texto de 301 a 900 | Modelo **médio**: imagem, título, intertítulos, texto, data e botão |
| Texto acima de 900 | Modelo **longo**: intertítulos e imagens; cada bloco aparece uma vez só |
| Público interno / externo | Interno: marca do Grupo Unimed Uberlândia. Externo: marca Unimed Uberlândia + registro ANS. Evento (mesmo externo): marca do Grupo |
| Área de quem pede | Vira o cabeçalho e a assinatura do e-mail (dá para trocar por um programa ou comitê) |
| Interno | Visual 2027 sutil (inspirado na Atualização CERVELLO): ícone da área no quadro box, nome da área em dois tons, grade de 12 colunas quase invisível e faixa curta do mosaico |
| Imagens (até 3) | Tamanho fixo, mesmo se a foto for vertical: 1 = horizontal 536 × 300; 2 = lado a lado 264 × 220; 3 = mosaico (352 × 300 + duas de 176 × 146). A pessoa arrasta a foto no quadro e ajusta o zoom |
| Formatação | Título sem formatação. Subtítulo: **negrito** e *itálico*. Texto: negrito, itálico, realce arredondado (cores de apoio e cítrico; laranja fica para o botão) e **box**: um parágrafo inteiro selecionado vira um box de destaque com a forma da marca |
| Ordem dos blocos | Imagens, título, data, texto e botão mudam de ordem e aparecem uma vez só; cabeçalho e fechamento são fixos |
| Fechamento | Mote "Presença que transforma" + site (em `config/marca.json` → `rodape`). ANS só nas peças externas |
| Linhas com "- " | Viram lista; aviso acima de 5 itens |
| Linguagem | Avisa: título só em maiúsculas, excesso de "!", frases longas, botão genérico, estrangeirismos |
| Título com até 40 / 60 / 90 caracteres | Fonte cai um degrau a cada faixa; acima de 90 é bloqueado |
| Tem data | Bloco padrão de data (dia, mês, dia da semana, horário, local) |
| Tem botão | Exige texto e link `https://` juntos; botão laranja no formato box |
| Tema | Faixa: Institucional (verde escuro), Saúde (verde Unimed), Evento (cítrico), Aviso (laranja) |

As regras seguem os manuais oficiais: Aplicação da Marca Unimed (MS.139), Linguagem da Marca (MS.138) e Manual de Marca do Grupo Unimed Uberlândia. O resumo de cada regra aparece na página **Núcleo da Marca**.

## Papel de cada cor

| Papel | Cor | Onde entra |
|---|---|---|
| Marca | Verde institucional | Logo, chapéu, marcadores de lista, última palavra do nome da área |
| Estrutura | Verde petróleo | Títulos, nome da área, rodapé, quadro dos ícones |
| Ação | Laranja | Só o botão e o quadradinho de assinatura 2027 |
| Destaque | Verde cítrico | Data, números, barra curta acima do chapéu, detalhe dos ícones |
| Fundo | Cores de apoio | Bloco da área (muda com o tema) e caixa da data |

## Cartilhas e documentos

Seguem o padrão **Cartilha Padrão Unimed**, não o visual 2027 das peças internas. As regras já estão em `config/formatos/cartilha-documento.json` (cabeçalho em todas as páginas, capa, seções, sem alterar o texto, entrega em Word). O formato aparece como "em breve" até ser liberado.

## Baixar a peça

Depois de gerar, a peça sai em **HTML** (para disparo), **Imagem (PNG)**, **PDF** (botão continua clicável) e **PowerPoint** com os textos editáveis, nas mesmas posições do e-mail. As ferramentas de exportação ficam em `src/vendor/` (html2canvas, jsPDF e PptxGenJS, todas com licença MIT).

Os números ficam em `config/formatos/email-marketing.json`. Mude ali e todas as peças novas seguem.

## Edição rápida

O formulário é organizado em seções: o essencial fica aberto e o resto (imagens, data, botão, cabeçalho e ordem) abre só quando precisa, com um resumo do que já foi preenchido. Uma barra fixa mostra o que falta e o botão Gerar. Nome e área ficam guardados, o rascunho é salvo sozinho e, depois de gerar, **Editar esta peça** cria uma nova versão (`-V2`, `-V3`…) sem redigitar nada. No celular, as abas Editar | Prévia trocam de tela. Detalhes em `docs/como-atualizar.md`.

## PowerPoint

O realce vira uma forma arredondada atrás do texto (o marca-texto do PowerPoint é reto), o box e os botões mantêm o canto reto da marca, e as linhas leves da faixa do cabeçalho entram como imagem. Os textos continuam editáveis.

## Fonte Unimed Sans

Coloque os arquivos em `assets/fonts/` e liste em `config/marca.json` → `tipografia.arquivos`. A prévia, a imagem, o PDF e o PowerPoint passam a usar a fonte da marca; no e-mail, ela aparece onde o leitor permite (Apple Mail, iOS) e cai no Arial no resto.

## Rastreabilidade

Cada peça recebe um código (`UNI-EM-2027-XXXXXX`), guardado dentro do HTML (não aparece na peça) e nas anotações do PowerPoint. O registro guarda quem pediu, a área, a data, o conteúdo, o HTML final e a "impressão digital" (hash SHA-256) desse HTML. No painel, **Conferir peça** compara um HTML disparado com a versão oficial e mostra se houve alteração.

## Área restrita

Painel, Núcleo da Marca, Radar de Tendências e Acessos pedem **Entrar com GitHub**. Só entra quem tem o usuário do GitHub na lista de acessos; o primeiro "dono" é cadastrado direto no banco e, depois, inclui outras pessoas pela tela **Acessos**. Passo a passo em `docs/acesso-restrito.md`.

Sem banco ligado, a área restrita abre só no computador local (para testes) e fica fechada no site publicado.

## Testar no computador

As regras são lidas por `fetch`, então abra por um servidor local (não clicando no arquivo):

```
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Publicar

1. Ative o **GitHub Pages** do repositório (branch `main`, pasta raiz).
2. Em `config/sistema.json`, preencha `baseUrlPublica` com o endereço do site. As imagens do e-mail precisam de endereço completo para aparecer na caixa de entrada.
3. Para ligar o login e o painel compartilhado, siga `docs/acesso-restrito.md`.

## Antes de abrir para a empresa toda

- **Acesso:** o gerador é público para quem tem o link; a área restrita é protegida por login. Um passo futuro é entrar com a conta Microsoft corporativa (preenche nome e área sozinho).
- **Fontes:** os arquivos da Unimed Sans não vão para o repositório público até a licença ser confirmada. Sem eles, a interface usa a fonte do sistema (os e-mails não mudam: já usam Arial).
- **LGPD:** o sistema guarda nomes de colaboradores. Valide com TI e Jurídico.
- **Lista de áreas:** a lista em `config/marca.json` é um ponto de partida; ajuste para as áreas reais.

Veja `docs/como-atualizar.md` para o passo a passo de manutenção.
