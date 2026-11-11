-- Banco do Gerador de Peças (Supabase / Postgres) com área restrita.
-- Rode tudo no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- O passo a passo completo está em docs/acesso-restrito.md.

-- ============ 1. Pedidos (cada peça gerada) ============
create table if not exists public.pedidos (
  codigo            text primary key,
  criado_em         timestamptz not null default now(),
  nome              text not null,
  area              text not null,
  formato           text not null,
  tema              text,
  variante          text,
  titulo            text,
  caracteres        integer,
  imagem            text,
  tem_data          boolean,
  tem_botao         boolean,
  conteudo          jsonb,
  html              text,
  hash              text,
  versao_marca      text,
  ciclo_tendencias  text
);
create index if not exists pedidos_criado_em on public.pedidos (criado_em desc);
create index if not exists pedidos_area on public.pedidos (area);
alter table public.pedidos enable row level security;

-- ============ 2. Acessos (quem entra na área restrita, pelo usuário do GitHub) ============
-- papel "dono": vê tudo e gerencia acessos. papel "equipe": vê painel, núcleo e radar.
create table if not exists public.acessos (
  github     text primary key check (github = lower(github)),
  nome       text,
  papel      text not null default 'equipe' check (papel in ('dono', 'equipe')),
  criado_em  timestamptz not null default now()
);
alter table public.acessos enable row level security;

-- Usuário do GitHub de quem está logado (vem do login).
create or replace function public.meu_github() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', ''))
$$;

-- Papel de quem está logado (null = sem acesso).
create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.acessos where github = public.meu_github() and public.meu_github() <> ''
$$;
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select public.meu_papel() is not null
$$;
revoke all on function public.meu_papel() from public;
revoke all on function public.tem_acesso() from public;
grant execute on function public.meu_github() to anon, authenticated;
grant execute on function public.meu_papel() to anon, authenticated;
grant execute on function public.tem_acesso() to anon, authenticated;

-- ============ 3. Regras de leitura e escrita ============
-- Permissões das tabelas (as políticas abaixo filtram linha a linha).
grant usage on schema public to anon, authenticated;
grant insert on public.pedidos to anon, authenticated;
grant select on public.pedidos to authenticated;
grant select, insert, update, delete on public.acessos to authenticated;

drop policy if exists "registrar pedido" on public.pedidos;
drop policy if exists "ler pedidos (piloto)" on public.pedidos;
drop policy if exists "equipe le pedidos" on public.pedidos;

-- Qualquer pessoa no gerador REGISTRA um pedido; ninguém altera nem apaga pelo site.
create policy "registrar pedido" on public.pedidos
  for insert to anon, authenticated with check (true);
-- Só quem tem acesso LÊ os pedidos (painel e "Conferir peça").
create policy "equipe le pedidos" on public.pedidos
  for select to authenticated using (public.tem_acesso());

drop policy if exists "equipe ve acessos" on public.acessos;
drop policy if exists "dono inclui acesso" on public.acessos;
drop policy if exists "dono altera acesso" on public.acessos;
drop policy if exists "dono remove acesso" on public.acessos;

create policy "equipe ve acessos" on public.acessos
  for select to authenticated using (public.tem_acesso());
create policy "dono inclui acesso" on public.acessos
  for insert to authenticated with check (public.meu_papel() = 'dono');
create policy "dono altera acesso" on public.acessos
  for update to authenticated
  using (public.meu_papel() = 'dono' and github <> public.meu_github())
  with check (public.meu_papel() = 'dono');
create policy "dono remove acesso" on public.acessos
  for delete to authenticated
  using (public.meu_papel() = 'dono' and github <> public.meu_github());

-- ============ 4. Só entra quem está na lista ============
-- Um GitHub fora da lista não consegue nem criar a conta no primeiro login.
create or replace function public.bloquear_cadastro_nao_autorizado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.acessos
    where github = lower(coalesce(new.raw_user_meta_data ->> 'user_name', ''))
  ) then
    raise exception 'Este usuário do GitHub não tem acesso liberado.';
  end if;
  return new;
end $$;

drop trigger if exists antes_de_cadastrar on auth.users;
create trigger antes_de_cadastrar
  before insert on auth.users
  for each row execute function public.bloquear_cadastro_nao_autorizado();

-- ============ 5. Seu acesso (rode separado, com o SEU usuário do GitHub) ============
-- insert into public.acessos (github, nome, papel) values ('seu-usuario', 'Seu nome', 'dono');
