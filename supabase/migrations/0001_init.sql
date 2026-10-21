-- Comparador de Tabelas: estrutura inicial
-- Cada "tabela" (dataset) recebe várias versões ao longo do tempo.
-- As linhas de cada versão ficam em JSONB para aceitar qualquer formato de planilha.

create table if not exists public.datasets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  key_column  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.dataset_versions (
  id             uuid primary key default gen_random_uuid(),
  dataset_id     uuid not null references public.datasets (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label          text not null,
  reference_date date not null default current_date,
  file_name      text,
  columns        jsonb not null default '[]'::jsonb,
  rows           jsonb not null default '[]'::jsonb,
  row_count      integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists dataset_versions_dataset_idx
  on public.dataset_versions (dataset_id, reference_date, created_at);
create index if not exists datasets_user_idx on public.datasets (user_id);
create index if not exists dataset_versions_user_idx on public.dataset_versions (user_id);

alter table public.datasets enable row level security;
alter table public.dataset_versions enable row level security;

-- Cada usuário só vê e altera os próprios dados
create policy "datasets_select_own" on public.datasets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "datasets_insert_own" on public.datasets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "datasets_update_own" on public.datasets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "datasets_delete_own" on public.datasets
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "versions_select_own" on public.dataset_versions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "versions_insert_own" on public.dataset_versions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid()))
  );
create policy "versions_update_own" on public.dataset_versions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "versions_delete_own" on public.dataset_versions
  for delete to authenticated using ((select auth.uid()) = user_id);
