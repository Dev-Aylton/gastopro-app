-- GastoPro — Esquema do banco (Supabase / PostgreSQL)
-- Reflete o banco de produção em 28/10/2026 e as alterações pendentes registradas em migrations.
-- Pode ser executado mais de uma vez sem erro (idempotente).
-- Qualquer mudança no banco deve ser registrada neste arquivo.

create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================
-- TABELAS
-- ============================================================
create table if not exists public.accounts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  institution     text,
  type            text not null,
  initial_balance numeric(12,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint accounts_user_id_id_key unique (user_id, id)
);

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
  account_id  uuid,
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
  account_id  uuid,
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

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.feedback_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('duvida', 'sugestao', 'problema')),
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  status text not null default 'new' check (status in ('new', 'answered')),
  reply text check (reply is null or char_length(reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts drop constraint if exists accounts_name_chk;
alter table public.accounts drop constraint if exists accounts_institution_chk;
alter table public.accounts drop constraint if exists accounts_type_chk;
alter table public.accounts drop constraint if exists accounts_initial_balance_chk;
alter table public.accounts
  add constraint accounts_name_chk check (
    char_length(name) between 1 and 100 and char_length(btrim(name)) > 0),
  add constraint accounts_institution_chk check (institution is null or char_length(institution) <= 100),
  add constraint accounts_type_chk check (type in ('PF', 'PJ')),
  add constraint accounts_initial_balance_chk check (abs(initial_balance) <= 9999999999.99);

alter table public.entries add column if not exists account_id uuid;
alter table public.fixed_templates add column if not exists account_id uuid;
alter table public.entries drop constraint if exists entries_account_owner_fk;
alter table public.entries
  add constraint entries_account_owner_fk
  foreign key (user_id, account_id) references public.accounts(user_id, id)
  on delete set null (account_id);
alter table public.fixed_templates drop constraint if exists templates_account_owner_fk;
alter table public.fixed_templates
  add constraint templates_account_owner_fk
  foreign key (user_id, account_id) references public.accounts(user_id, id)
  on delete set null (account_id);

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
alter table public.accounts        enable row level security;
alter table public.app_admins      enable row level security;
alter table public.feedback_messages enable row level security;

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

drop policy if exists accounts_own on public.accounts;
create policy accounts_own on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists app_admins_read_own on public.app_admins;
create policy app_admins_read_own on public.app_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_messages_read_own_or_admin on public.feedback_messages;
create policy feedback_messages_read_own_or_admin on public.feedback_messages
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists feedback_messages_insert_own_new on public.feedback_messages;
create policy feedback_messages_insert_own_new on public.feedback_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'new'
    and reply is null
    and replied_at is null
  );

drop policy if exists feedback_messages_delete_own on public.feedback_messages;
create policy feedback_messages_delete_own on public.feedback_messages
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_messages_update_admin on public.feedback_messages;
create policy feedback_messages_update_admin on public.feedback_messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists entries_user_date_idx on public.entries (user_id, date);
create index if not exists fixed_templates_user_idx on public.fixed_templates (user_id);
create index if not exists accounts_user_idx on public.accounts (user_id);
create index if not exists feedback_messages_user_created_idx on public.feedback_messages (user_id, created_at);
create index if not exists feedback_messages_status_created_idx on public.feedback_messages (status, created_at);

-- ============================================================
-- PERMISSÕES (privilégio mínimo)
-- ============================================================
revoke all on public.entries, public.fixed_templates, public.profiles, public.goals, public.accounts from anon;
revoke all on public.app_admins, public.feedback_messages from anon;
revoke truncate, references, trigger
  on public.entries, public.fixed_templates, public.profiles, public.goals, public.accounts from authenticated;
grant select, insert, update, delete
  on public.entries, public.fixed_templates, public.profiles, public.goals, public.accounts to authenticated;
revoke all on public.app_admins from authenticated;
grant select on public.app_admins to authenticated;
revoke all on public.feedback_messages from authenticated;
grant select, delete on public.feedback_messages to authenticated;
grant insert (user_id, category, message) on public.feedback_messages to authenticated;
grant update (reply, status, replied_at) on public.feedback_messages to authenticated;
revoke truncate, references, trigger on public.app_admins, public.feedback_messages from authenticated;

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

create or replace function public.enforce_feedback_daily_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*) into recent_count
  from public.feedback_messages
  where user_id = new.user_id
    and created_at >= now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception 'Limite de 5 mensagens nas últimas 24 horas atingido. Tente novamente mais tarde.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_feedback_daily_limit() from public, anon, authenticated;

drop trigger if exists feedback_messages_daily_limit on public.feedback_messages;
create trigger feedback_messages_daily_limit
  before insert on public.feedback_messages
  for each row execute function public.enforce_feedback_daily_limit();

drop trigger if exists feedback_messages_set_updated_at on public.feedback_messages;
create trigger feedback_messages_set_updated_at
  before update on public.feedback_messages
  for each row execute function public.set_updated_at();

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

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

-- ============================================================
-- EXCLUSÃO DA PRÓPRIA CONTA (LGPD)
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- PENDENTE
-- ============================================================
-- * Supabase Storage para o avatar (hoje é Base64 em profiles.avatar)
