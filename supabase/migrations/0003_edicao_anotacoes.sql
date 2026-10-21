-- Edição sem perda de dados: histórico automático, lixeira e anotações.

alter table public.fechamentos
  add column if not exists descricao  text,
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

-- Anotações: no fechamento inteiro ou em um registro de uma base (pela chave).
-- Anotações de registro ficam visíveis em todos os fechamentos em que a chave aparecer.
create table if not exists public.anotacoes (
  id            uuid primary key default gen_random_uuid(),
  fechamento_id uuid references public.fechamentos (id) on delete set null,
  base          text check (base in ('alteracoes', 'info_uau', 'acomp_entregas')),
  chave         text,
  texto         text not null check (length(trim(texto)) > 0),
  autor         text not null default lower(auth.jwt() ->> 'email'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  deleted_at    timestamptz
);
create index if not exists anotacoes_fechamento_idx on public.anotacoes (fechamento_id);
create index if not exists anotacoes_chave_idx on public.anotacoes (base, chave);

-- Histórico: cada criação, edição e exclusão fica registrada com o antes e o depois.
create table if not exists public.historico (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid not null,
  acao        text not null,
  antes       jsonb,
  depois      jsonb,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists historico_registro_idx on public.historico (registro_id, created_at desc);

create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criado';
  elsif tg_op = 'DELETE' then
    v_acao := 'excluido_definitivo';
  elsif new.deleted_at is not null and old.deleted_at is null then
    v_acao := 'enviado_lixeira';
  elsif new.deleted_at is null and old.deleted_at is not null then
    v_acao := 'restaurado';
  else
    v_acao := 'editado';
  end if;
  insert into public.historico (tabela, registro_id, acao, antes, depois, autor)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    v_acao,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    lower(auth.jwt() ->> 'email')
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger fechamentos_historico after insert or update or delete on public.fechamentos
  for each row execute function public.registrar_historico();
create trigger anotacoes_historico after insert or update or delete on public.anotacoes
  for each row execute function public.registrar_historico();
create trigger fechamentos_updated before update on public.fechamentos
  for each row execute function public.set_updated_at();
create trigger anotacoes_updated before update on public.anotacoes
  for each row execute function public.set_updated_at();

alter table public.anotacoes enable row level security;
alter table public.historico enable row level security;

-- Qualquer pessoa com acesso lê e escreve anotações; edita/apaga as próprias (admin edita todas)
create policy anotacoes_select on public.anotacoes for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy anotacoes_insert on public.anotacoes for insert to authenticated
  with check ((select public.current_app_role()) is not null and autor = lower((select auth.jwt()) ->> 'email'));
create policy anotacoes_update on public.anotacoes for update to authenticated
  using (autor = lower((select auth.jwt()) ->> 'email') or (select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) is not null);

-- Histórico: só leitura (é escrito pelos gatilhos)
create policy historico_select on public.historico for select to authenticated
  using ((select public.current_app_role()) is not null);

-- Exclusão definitiva de fechamento: só administrador (os demais enviam para a lixeira)
alter policy fechamentos_delete on public.fechamentos
  using ((select public.current_app_role()) = 'admin');
