# Registro central no Cloudflare

O site continua no GitHub Pages. Um pequeno serviço no Cloudflare (o Worker `unimed-pecas`) faz três coisas:

- **Registro:** guarda cada peça gerada, com quem pediu, a área, a data e o conteúdo (banco D1 `unimed-pecas`).
- **Fotos dos e-mails:** guarda as fotos recortadas, com endereço público, para o e-mail disparado mostrar as imagens (KV `unimed-imagens`).
- **Senha do painel:** confere a senha do Marketing, que libera o painel, o Núcleo da Marca e o Radar.

O código do Worker está em `worker/unimed-pecas.js`.

## Montar o Worker (uma vez)

O banco D1 `unimed-pecas` (com a tabela `pedidos`) e o KV `unimed-imagens` já estão criados na conta.

1. Em dash.cloudflare.com, abra **Workers e Pages → Criar → Worker**. Comece pelo "Hello World", dê o nome `unimed-pecas` e clique em **Implantar**.
2. Clique em **Editar código**, apague tudo, cole o conteúdo de `worker/unimed-pecas.js` e clique em **Implantar**.
3. Em **Configurações → Vinculações**, adicione:
   - **Banco de dados D1:** nome da variável `DB`, banco `unimed-pecas`.
   - **Namespace KV:** nome da variável `IMAGENS`, namespace `unimed-imagens`.
4. Em **Configurações → Variáveis e segredos**, adicione um **Segredo** chamado `USUARIOS` com os logins do Marketing em JSON, por exemplo `{"joander":"senha1","maria":"senha2"}`. (Opcional: um segredo `SENHA` com uma senha geral, que vale sem usuário.)
5. Copie o endereço do Worker (`https://unimed-pecas.SUA-CONTA.workers.dev`) e coloque em `config/sistema.json`:

```json
"registro": { "modo": "cloudflare", "api": "https://unimed-pecas.SUA-CONTA.workers.dev" }
```

## Segurança

- **Registrar e enviar fotos** é aberto: qualquer pessoa que gera uma peça precisa conseguir. O Worker aceita só pedidos com código válido e imagens de até 5 MB.
- **Ler os pedidos** exige a senha do Marketing.
- **Trocar uma senha ou incluir alguém:** edite o segredo `USUARIOS` no Worker. Quem estiver logado com a senha antiga precisa entrar de novo.

## Levar para uma conta só da Unimed

Repita os passos numa conta Cloudflare da Unimed. Antes, crie o banco D1 `unimed-pecas` e o KV `unimed-imagens`; para a tabela, rode o SQL abaixo no console do D1. Depois troque o endereço em `config/sistema.json`.

```sql
CREATE TABLE IF NOT EXISTS pedidos (codigo TEXT PRIMARY KEY, criado_em TEXT NOT NULL, nome TEXT, area TEXT, formato TEXT, titulo TEXT, dados TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pedidos_data ON pedidos (criado_em DESC);
```
