# Área restrita: como ligar

A área restrita (Painel, Núcleo da Marca, Radar de Tendências e Acessos) usa o login do **Supabase**, que é gratuito para este volume. O gerador continua aberto para qualquer área criar peças.

Enquanto o banco não estiver ligado, a área restrita só abre no seu computador (`localhost`), sem senha, para testes. No site publicado ela mostra "ainda não foi ligada".

## 1. Criar o projeto (uma vez, ~10 min)

1. Entre em [supabase.com](https://supabase.com) e crie um projeto (região: São Paulo).
2. **SQL Editor → New query:** cole todo o conteúdo de `docs/banco-supabase.sql` e clique em **Run**.
3. Ainda no SQL Editor, rode uma linha com **o seu e-mail**, que vira o primeiro "dono":

   ```sql
   insert into public.acessos (email, nome, papel) values ('seu.email@exemplo.com', 'Seu nome', 'dono');
   ```

4. **Authentication → URL Configuration:** em *Site URL* coloque o endereço do site publicado (ex.: `https://informativoudi.github.io/sistemamarketing/`). Em *Redirect URLs* adicione o mesmo endereço seguido de `**`.
5. **Project Settings → API:** copie a *Project URL* e a chave *anon public*.

## 2. Ligar no site

Em `config/sistema.json`:

```json
"registro": {
  "modo": "supabase",
  "supabaseUrl": "https://SEU-PROJETO.supabase.co",
  "supabaseChaveAnonima": "a chave anon public",
  "tabela": "pedidos"
}
```

A chave *anon* foi feita para ficar no site: sozinha ela só consegue **registrar** pedidos. Ler pedidos e mexer em acessos exige login de alguém da lista. **Nunca** coloque a chave *service_role* no repositório.

## 3. Primeiro acesso

1. Abra o site → **Área restrita → Primeiro acesso**.
2. Digite seu e-mail e crie uma senha. Chega um e-mail de confirmação; clique no link.
3. Pronto: entre com e-mail e senha.

## Incluir outras pessoas

1. Na área restrita, abra **Acessos** (só aparece para quem é "dono").
2. Coloque o e-mail, o nome e o papel e clique em **Liberar acesso**.
3. Avise a pessoa para entrar em **Área restrita → Primeiro acesso**.

Para tirar o acesso, clique em **Remover**. A pessoa perde a leitura na hora.
E-mails que não estão na lista não conseguem nem criar senha.

## O que fica protegido e o que não fica

| Protegido por login | Público (precisa ser, para o gerador funcionar) |
|---|---|
| Pedidos: nomes, áreas, conteúdos, HTML oficial | As regras em `config/` (cores, tendências ativas, limites) |
| Painel e "Conferir peça" | O código das páginas |
| Lista de acessos | As imagens aprovadas e logos |

Material estratégico (apresentação de tendências, estudos, ideias em avaliação) **não deve ir para o repositório**: ele fica nos artefatos privados do Claude ou no seu drive.

## Esqueci a senha

**Área restrita → Esqueci a senha.** O link chega por e-mail e abre a tela de nova senha.

O Supabase gratuito manda poucos e-mails por hora. Se a equipe crescer, configure um SMTP próprio em *Authentication → Emails* (ex.: o e-mail corporativo).
