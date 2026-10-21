-- Estrutura "Alterações - Fechamento" + controle de acesso por perfil.
-- As tabelas genéricas da versão 0001 (datasets, dataset_versions) não são mais usadas pelo app.

-- Quem pode acessar o app e com qual perfil
create table public.app_users (
  email                text primary key check (email = lower(email)),
  role                 text not null check (role in ('admin', 'editor', 'leitor')),
  nome                 text,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);

-- Perfil do usuário logado (null = sem acesso)
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.app_users where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- Marca que o usuário já trocou a senha temporária
create or replace function public.mark_password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.app_users set must_change_password = false
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
revoke execute on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- Cada fechamento enviado (uma planilha com as 3 bases)
create table public.fechamentos (
  id             uuid primary key default gen_random_uuid(),
  label          text not null,
  reference_date date not null,
  file_name      text,
  created_by     text default lower(auth.jwt() ->> 'email'),
  created_at     timestamptz not null default now()
);

-- As linhas de cada base do fechamento
create table public.fechamento_bases (
  id            uuid primary key default gen_random_uuid(),
  fechamento_id uuid not null references public.fechamentos (id) on delete cascade,
  base          text not null check (base in ('alteracoes', 'info_uau', 'acomp_entregas')),
  columns       jsonb not null default '[]'::jsonb,
  rows          jsonb not null default '[]'::jsonb,
  row_count     integer not null default 0,
  unique (fechamento_id, base)
);
create index fechamento_bases_fechamento_idx on public.fechamento_bases (fechamento_id);
create index fechamentos_date_idx on public.fechamentos (reference_date);

alter table public.app_users enable row level security;
alter table public.fechamentos enable row level security;
alter table public.fechamento_bases enable row level security;

-- app_users: cada um vê o próprio cadastro; admin vê e gerencia todos
create policy app_users_select on public.app_users for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email') or (select public.current_app_role()) = 'admin');
create policy app_users_admin_insert on public.app_users for insert to authenticated
  with check ((select public.current_app_role()) = 'admin');
create policy app_users_admin_update on public.app_users for update to authenticated
  using ((select public.current_app_role()) = 'admin') with check ((select public.current_app_role()) = 'admin');
create policy app_users_admin_delete on public.app_users for delete to authenticated
  using ((select public.current_app_role()) = 'admin');

-- fechamentos e bases: qualquer perfil lê; admin e editor enviam e excluem
create policy fechamentos_select on public.fechamentos for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy fechamentos_insert on public.fechamentos for insert to authenticated
  with check ((select public.current_app_role()) in ('admin', 'editor'));
create policy fechamentos_update on public.fechamentos for update to authenticated
  using ((select public.current_app_role()) in ('admin', 'editor')) with check ((select public.current_app_role()) in ('admin', 'editor'));
create policy fechamentos_delete on public.fechamentos for delete to authenticated
  using ((select public.current_app_role()) in ('admin', 'editor'));

create policy bases_select on public.fechamento_bases for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy bases_insert on public.fechamento_bases for insert to authenticated
  with check ((select public.current_app_role()) in ('admin', 'editor'));
create policy bases_delete on public.fechamento_bases for delete to authenticated
  using ((select public.current_app_role()) in ('admin', 'editor'));

-- Depois de aplicar, cadastre o primeiro administrador:
-- insert into public.app_users (email, role, nome) values ('seu-email@exemplo.com', 'admin', 'Seu nome');
