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
2. Crie `src/modelos/<formato>.js` com o desenho.
3. Inclua o script no `index.html` e mude `"ativo": true` em `config/formatos/indice.json`.
