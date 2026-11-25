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
4. Em **Configurações → Variáveis e segredos**, adicione um **Segredo** chamado `USUARIOS` com o login do primeiro administrador em JSON, por exemplo `{"joander":"senha-forte"}`. Os logins das outras pessoas são criados depois, na página **Acessos** do site.
5. Copie o endereço do Worker (`https://unimed-pecas.SUA-CONTA.workers.dev`) e coloque em `config/sistema.json`:

```json
"registro": { "modo": "cloudflare", "api": "https://unimed-pecas.SUA-CONTA.workers.dev" }
```

## Segurança

- **Registrar e enviar fotos** é aberto: qualquer pessoa que gera uma peça precisa conseguir. O Worker aceita só pedidos com código válido e imagens de até 5 MB.
- **Ler os pedidos** exige a senha do Marketing.
- **Incluir alguém ou trocar uma senha:** página **Acessos** do site. **Login reserva de administrador:** segredo `USUARIOS` no Worker.

## Levar para uma conta só da Unimed

Repita os passos numa conta Cloudflare da Unimed. Antes, crie o banco D1 `unimed-pecas` e o KV `unimed-imagens`; para a tabela, rode o SQL abaixo no console do D1. Depois troque o endereço em `config/sistema.json`.

```sql
CREATE TABLE IF NOT EXISTS pedidos (codigo TEXT PRIMARY KEY, criado_em TEXT NOT NULL, nome TEXT, area TEXT, formato TEXT, titulo TEXT, dados TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pedidos_data ON pedidos (criado_em DESC);
```

## Segurança (como a API se protege)

- **Login:** usuário + senha → a API devolve um passe que vale 12 horas. A senha nunca fica salva no navegador; no banco fica só o hash (PBKDF2, 100 mil rodadas, sal único por pessoa). **Sair** derruba o passe na hora; trocar a senha de alguém derruba os passes dessa pessoa.
- **Força bruta:** 5 senhas erradas seguidas bloqueiam o usuário (e o IP) por 15 minutos.
- **Registro imutável:** pedidos e fotos são gravados uma vez só. Ninguém consegue sobrescrever uma peça ou trocar a foto de um e-mail já disparado.
- **Spam e cota:** até 60 pedidos e 150 fotos por hora por IP. As fotos são conferidas pela assinatura do arquivo (JPEG, PNG ou WebP de verdade).
- **Peça aberta no painel:** roda numa área isolada (`iframe sandbox`), sem executar nenhum código que venha dentro do HTML.
- **Privacidade:** o IP não é guardado; os limites usam um código (hash) que expira em até 2 horas.
