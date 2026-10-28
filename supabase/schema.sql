-- GastoPro — Esquema do banco (Supabase / PostgreSQL)
-- Reflete o banco de produção em 28/10/2026.
-- Pode ser executado mais de uma vez sem erro (idempotente).
-- Qualquer mudança no banco deve ser registrada neste arquivo.

create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================
-- TABELAS
-- ============================================================
create table if not exists public.entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount      numeric(12,2) not null,
  category    text not null,
  type        text not null,
  date        text not null,
  paid        boolean not null default false,
  is_debt     boolean not null default false,
  debt_info   jsonb,
  active      boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.fixed_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount      numeric(12,2) not null,
  category    text not null,
  type        text not null default 'fixed',
  is_debt     boolean not null default false,
  active      boolean not null default true,
  start_month text not null,
  end_month   text,
  day         text default '01',
  paid_months jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  avatar     text,
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null,
  limit_amount numeric(12,2) not null check (limit_amount >= 0),
  created_at   timestamptz default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, category)
);

-- ============================================================
-- REGRAS DE VALIDAÇÃO (CHECK)
-- ============================================================
alter table public.entries drop constraint if exists entries_type_chk;
alter table public.entries drop constraint if exists entries_amount_chk;
alter table public.entries drop constraint if exists entries_date_chk;
alter table public.entries drop constraint if exists entries_len_chk;
alter table public.entries
  add constraint entries_type_chk   check (type in ('income','variable','fixed','debt')),
  add constraint entries_amount_chk check (amount >= 0),
  add constraint entries_date_chk   check (date ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'),
  add constraint entries_len_chk check (
    char_length(description) between 1 and 300 and char_length(category) between 1 and 100
    and (debt_info is null or pg_column_size(debt_info) <= 4096));

alter table public.fixed_templates drop constraint if exists templates_type_chk;
alter table public.fixed_templates drop constraint if exists templates_amount_chk;
alter table public.fixed_templates drop constraint if exists templates_start_chk;
alter table public.fixed_templates drop constraint if exists templates_end_chk;
alter table public.fixed_templates drop constraint if exists templates_day_chk;
alter table public.fixed_templates drop constraint if exists templates_len_chk;
alter table public.fixed_templates
  add constraint templates_type_chk   check (type in ('fixed','debt','variable')),
  add constraint templates_amount_chk check (amount >= 0),
  add constraint templates_start_chk  check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  add constraint templates_end_chk    check (end_month is null or end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  add constraint templates_day_chk    check (day is null or day ~ '^(0[1-9]|[12]\d|3[01])$'),
  add constraint templates_len_chk check (
    char_length(description) between 1 and 300 and char_length(category) between 1 and 100
    and pg_column_size(paid_months) <= 8192);

alter table public.profiles drop constraint if exists profiles_avatar_len_chk;
alter table public.profiles
  add constraint profiles_avatar_len_chk
  check (avatar is null or char_length(avatar) <= 400000);

alter table public.goals drop constraint if exists goals_category_len_chk;
alter table public.goals
  add constraint goals_category_len_chk
  check (char_length(category) between 1 and 100);

-- ============================================================
-- ROW LEVEL SECURITY (cada usuário só acessa os próprios dados)
-- ============================================================
alter table public.entries         enable row level security;
alter table public.fixed_templates enable row level security;
alter table public.profiles        enable row level security;
alter table public.goals           enable row level security;

drop policy if exists entries_own on public.entries;
create policy entries_own on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists templates_own on public.fixed_templates;
create policy templates_own on public.fixed_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists goals_own on public.goals;
create policy goals_own on public.goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists entries_user_date_idx on public.entries (user_id, date);
create index if not exists fixed_templates_user_idx on public.fixed_templates (user_id);

-- ============================================================
-- PERMISSÕES (privilégio mínimo)
-- ============================================================
revoke all on public.entries, public.fixed_templates, public.profiles, public.goals from anon;
revoke truncate, references, trigger
  on public.entries, public.fixed_templates, public.profiles, public.goals from authenticated;
grant select, insert, update, delete
  on public.entries, public.fixed_templates, public.profiles, public.goals to authenticated;

-- ============================================================
-- updated_at AUTOMÁTICO
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

drop trigger if exists templates_set_updated_at on public.fixed_templates;
create trigger templates_set_updated_at
  before update on public.fixed_templates
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ============================================================
-- PENDENTE
-- ============================================================
-- * Sincronização das metas com a tabela goals no app (hoje só localStorage)
-- * Supabase Storage para o avatar (hoje é Base64 em profiles.avatar)
