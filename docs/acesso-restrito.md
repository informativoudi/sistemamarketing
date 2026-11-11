# Área restrita: login com GitHub

A área restrita (Painel, Núcleo da Marca, Radar de Tendências e Acessos) usa **Entrar com GitHub**. Só entra quem tem o usuário do GitHub na lista de acessos. O gerador continua aberto para qualquer área criar peças.

Por que existe um banco (Supabase) no meio: o site é estático, e o GitHub não guarda os pedidos nem faz o login sozinho. O Supabase guarda os pedidos e cuida do login; o GitHub só confirma quem é a pessoa. O plano gratuito atende este volume.

Enquanto nada estiver ligado, a área restrita só abre no seu computador (`localhost`), para testes. No site publicado ela mostra "ainda não foi ligada".

## 1. Criar o banco (Supabase)

1. Entre em [supabase.com](https://supabase.com) com **Continue with GitHub** e crie um projeto (região: South America, São Paulo).
2. **SQL Editor → New query:** cole todo o conteúdo de `docs/banco-supabase.sql` e clique em **Run**.
3. Ainda no SQL Editor, rode esta linha com **o seu usuário do GitHub**. Ele vira o primeiro "dono":

   ```sql
   insert into public.acessos (github, nome, papel) values ('seu-usuario', 'Seu nome', 'dono');
   ```

4. **Project Settings → API:** anote a *Project URL* (ex.: `https://abcd.supabase.co`) e a chave pública (*anon public* ou *publishable*, que começa com `sb_publishable_`).

## 2. Criar o app de login no GitHub

1. No GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Preencha:
   - *Application name:* `Sistema de Marketing Unimed`
   - *Homepage URL:* o endereço do site (ex.: `https://informativoudi.github.io/sistemamarketing/`)
   - *Authorization callback URL:* `https://SEU-PROJETO.supabase.co/auth/v1/callback`
3. Clique em **Register application**, depois em **Generate a new client secret**. Copie o *Client ID* e o *Client secret*.

## 3. Ligar o GitHub no Supabase

1. **Authentication → Sign In / Providers → GitHub:** ative, cole o *Client ID* e o *Client secret* e salve.
2. **Authentication → URL Configuration:**
   - *Site URL:* o endereço do site.
   - *Redirect URLs:* o mesmo endereço seguido de `**` (ex.: `https://informativoudi.github.io/sistemamarketing/**`).

## 4. Ligar no site

Em `config/sistema.json`:

```json
"registro": {
  "modo": "supabase",
  "supabaseUrl": "https://SEU-PROJETO.supabase.co",
  "supabaseChaveAnonima": "a chave anon public",
  "tabela": "pedidos"
}
```

A chave *anon* foi feita para ficar no site: sozinha ela só consegue **registrar** pedidos. Ler pedidos e mexer em acessos exige login de alguém da lista.
**Nunca** coloque no repositório a chave *service_role* nem o *Client secret* do GitHub.

## Incluir outras pessoas

1. A pessoa precisa de uma conta no GitHub (grátis, em github.com).
2. Na área restrita, abra **Acessos** (só aparece para quem é "dono").
3. Coloque o usuário do GitHub, o nome e o papel e clique em **Liberar acesso**.
4. A pessoa entra em **Área restrita → Entrar com GitHub**.

Para tirar o acesso, clique em **Remover**: a pessoa perde a leitura na hora.
Um GitHub que não está na lista não consegue entrar.

## O que fica protegido e o que não fica

| Protegido por login | Público (precisa ser, para o gerador funcionar) |
|---|---|
| Pedidos: nomes, áreas, conteúdos, HTML oficial | As regras em `config/` (cores, tendências ativas, limites) |
| Painel e "Conferir peça" | O código das páginas |
| Lista de acessos | As imagens aprovadas e logos |

Material estratégico (apresentação de tendências, estudos, ideias em avaliação) **não deve ir para o repositório**.
