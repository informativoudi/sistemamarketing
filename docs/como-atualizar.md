# Como atualizar

Tudo o que muda com frequência é um arquivo JSON em `config/`. Não precisa mexer em código.

## Ligar ou desligar uma tendência

Em `config/tendencias.json`, troque o `status`:

- `"ativa"`: aparece nas peças
- `"teste"`: fica registrada, mas não aparece
- `"arquivada"`: ciclo encerrado

Para um ciclo novo (ex.: 2028), mude `"ciclo"` e a lista. O ciclo fica gravado em cada peça, então dá para saber com quais tendências ela foi feita.

## Mudar uma regra da marca

`config/marca.json`: cores, fontes, raio do box, logos, imagens aprovadas e áreas.
Ao mudar algo do manual, suba o número de `"versao"` (ex.: `2027.1` → `2027.2`). A versão também fica gravada em cada peça.

## Ajustar o e-mail marketing

`config/formatos/email-marketing.json`:

- limites de caracteres de cada campo (`max`)
- quando o texto vira curto, médio ou longo (`arvore.variante`)
- tamanhos do título (`arvore.titulo.degraus`)
- cores de cada tema (`temas`)

## Adicionar uma imagem aprovada

1. Coloque o arquivo em `assets/fotos/` (JPG, até 1200 px de largura).
2. Acrescente em `imagensAprovadas` no `config/marca.json`.

## Liberar um formato novo

1. Crie `config/formatos/<formato>.json` com campos e árvore.
2. Organize os campos em `secoes` (veja abaixo). A tela é a mesma para todos os formatos: seções, prévia, rascunho, edição depois de gerar e exportações já vêm prontos.
3. Crie `src/modelos/<formato>.js` com o desenho.
4. Inclua o script no `index.html` e mude `"ativo": true` em `config/formatos/indice.json`.

### Seções do formulário

```json
"secoes": [
  { "id": "essencial", "nome": "Conteúdo", "fixa": true, "campos": ["publico", "tema", "titulo", "texto"] },
  { "id": "botao", "nome": "Botão", "campos": ["ctaTexto", "ctaLink"], "vazio": "Sem botão" }
]
```

- `fixa: true`: sempre aberta, sem título (use para o essencial).
- As outras abrem e fecham. Fechadas, mostram um resumo do que foi preenchido ou o texto de `vazio`.
- `"ordem"` é o campo especial da ordem dos blocos.
- Um campo que não estiver em nenhuma seção entra na primeira, para nada sumir.
- Sem `secoes`, o formulário vira uma seção única.

Outras opções dos campos:
- `"formatacao": true` mostra negrito, itálico, realce e box (no texto longo); `"simples"` só negrito e itálico; `"realce"` só o realce. Sem a chave, o campo não tem formatação.
- Box de parágrafo: no texto fica como `>>(cor) parágrafo`. Selecionar o parágrafo inteiro e clicar numa cor de realce cria o box; o botão "Box" põe ou tira o box do parágrafo onde está o cursor.
- `"ideal": 60` deixa o contador amarelo quando passa do tamanho ideal, antes do máximo.
- Em `blocos.preenchidoPor`, diga qual campo enche cada bloco; blocos vazios ficam apagados na lista de ordem.

## Logos, público e assinatura do e-mail

- `config/formatos/email-marketing.json → publicos`: **Interno** usa a marca do Grupo Unimed Uberlândia; **Externo** usa a marca Unimed Uberlândia e o selo ANS.
- Os arquivos ficam em `assets/logos/` (PNG para e-mail, SVG para as telas). Se a marca mudar, troque os arquivos mantendo o nome.
- O cabeçalho e a assinatura do e-mail usam a área de quem pede. O campo "Nome no cabeçalho" permite trocar por um programa ou comitê.

## Regras de linguagem

`config/marca.json → linguagem`: limite de palavras por frase, itens por lista, exclamações e a lista de estrangeirismos com a sugestão em português. São avisos: não impedem gerar a peça.

## Imagens, formatação e blocos do e-mail

`config/formatos/email-marketing.json`:

- `arvore.imagem.layouts`: tamanho de cada quadro para 1, 2 ou 3 imagens. As fotos são recortadas no navegador e, no site publicado, enviadas para a pasta pública `pecas/<código>/` do Supabase (parte 6 de `docs/banco-supabase.sql`).
- `formatacao.realces`: cores do realce (use só cores de apoio e cítrico; laranja é do botão).
- `blocos.padrao`: ordem inicial dos blocos do meio do e-mail.

## Como a pessoa usa a tela

- **Nome e área** ficam guardados no aparelho; nas próximas vezes aparecem numa linha só, com "Trocar".
- **Rascunho automático**: o que foi digitado fica guardado no aparelho. Se a página fechar, ao voltar ao formato aparece "Recuperamos seu rascunho" com a opção "Começar do zero".
- **Editar esta peça**: depois de gerar, volta ao formulário preenchido. A nova geração vira `UNI-EM-…-V2`, `-V3`… e o registro guarda `versao_de` (o código anterior) dentro do conteúdo. A versão anterior continua no painel.
- **Se o banco não responder**, a peça fica pronta para copiar e baixar, com o botão "Tentar registrar de novo".
- **No celular**, as abas Editar | Prévia ficam fixas no topo, e a prévia encolhe para caber na tela.
- **A prévia usa os arquivos do próprio site**; a peça final usa o endereço público (`baseUrlPublica`), que funciona dentro da caixa de entrada.
