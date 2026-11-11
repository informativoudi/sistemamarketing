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
  acesso.js             Login da área restrita (Supabase) e permissões
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
| Texto de 301 a 900 | Modelo **médio**: imagem, título, texto, data e botão |
| Texto acima de 900 | Modelo **longo**: linhas curtas viram intertítulos, botão repetido após o 1º parágrafo |
| Título com até 40 / 60 / 90 caracteres | Fonte cai um degrau a cada faixa; acima de 90 é bloqueado |
| Tem data | Bloco padrão de data (dia, mês, dia da semana, horário, local) |
| Tem botão | Exige texto e link `https://` juntos; CTA no formato box |
| Tema | Institucional (petróleo), Saúde (institucional), Evento (cítrico), Aviso (laranja) |

Os números ficam em `config/formatos/email-marketing.json`. Mude ali e todas as peças novas seguem.

## Rastreabilidade

Cada peça recebe um código (`UNI-EM-2027-XXXXXX`) que aparece no rodapé. O registro guarda quem pediu, a área, a data, o conteúdo, o HTML final e a "impressão digital" (hash SHA-256) desse HTML. No painel, **Conferir peça** compara um HTML disparado com a versão oficial e mostra se houve alteração.

## Área restrita

Painel, Núcleo da Marca, Radar de Tendências e Acessos pedem e-mail e senha. Só entra quem está na lista de acessos; o primeiro "dono" é cadastrado direto no banco e, depois, inclui outras pessoas pela tela **Acessos**. Passo a passo em `docs/acesso-restrito.md`.

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
