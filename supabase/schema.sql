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
  client_edited_at timestamptz,
  deleted_at      timestamptz,
  constraint accounts_user_id_id_key unique (user_id, id)
);

create table if not exists public.credit_cards (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  total_limit numeric(12,2) not null check (total_limit > 0),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day     integer not null check (due_day between 1 and 31),
  brand       text not null default 'Outra'
    check (brand in ('Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra')),
  issuer_bank text not null default 'Outro'
    check (issuer_bank in ('Nubank', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Inter', 'C6', 'BTG', 'Mercado Pago', 'PicPay', 'Outro')),
  last_four   text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  custom_color text check (custom_color is null or custom_color ~ '^#[0-9A-Fa-f]{6}$'),
  account_id  uuid,
  previous_spent numeric(12,2) not null default 0 check (previous_spent >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  client_edited_at timestamptz,
  deleted_at  timestamptz,
  constraint credit_cards_user_id_id_key unique (user_id, id)
);

create table if not exists public.credit_card_purchases (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  card_id            uuid,
  card_name          text not null check (char_length(btrim(card_name)) between 1 and 100),
  account_id         uuid,
  description        text not null check (char_length(btrim(description)) between 1 and 300),
  amount             numeric(12,2) not null check (amount > 0),
  category           text not null check (char_length(btrim(category)) between 1 and 100),
  purchase_date      text not null,
  installment_count  integer not null check (installment_count between 1 and 24),
  closing_day        integer not null check (closing_day between 1 and 31),
  due_day            integer not null check (due_day between 1 and 31),
  paid_installments  jsonb not null default '[]'::jsonb check (jsonb_typeof(paid_installments) = 'array'),
  paid_dates         jsonb not null default '{}'::jsonb check (jsonb_typeof(paid_dates) = 'object'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  client_edited_at   timestamptz,
  deleted_at         timestamptz,
  constraint credit_card_purchases_user_id_id_key unique (user_id, id),
  constraint credit_card_purchases_card_fk foreign key (user_id, card_id)
    references public.credit_cards(user_id, id) on delete set null (card_id)
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
  payment_method text check (payment_method is null or payment_method in (
    'pix', 'debit', 'cash', 'credit_card', 'boleto', 'transfer', 'other'
  )),
  created_at  timestamptz default now(),
  updated_at  timestamptz not null default now(),
  client_edited_at timestamptz,
  deleted_at  timestamptz
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
  updated_at  timestamptz not null default now(),
  client_edited_at timestamptz,
  deleted_at  timestamptz
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  avatar     text,
  updated_at timestamptz not null default now(),
  client_edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.goals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null,
  limit_amount numeric(12,2) not null check (limit_amount >= 0),
  created_at   timestamptz default now(),
  updated_at   timestamptz not null default now(),
  client_edited_at timestamptz,
  deleted_at   timestamptz,
  primary key (user_id, category)
);

create table if not exists public.fixed_import_rules (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rules      jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  updated_at timestamptz not null default now(),
  client_edited_at timestamptz,
  deleted_at timestamptz
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

create table if not exists public.usage_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'screen_dashboard',
    'screen_incomes',
    'screen_expenses',
    'screen_accounts',
    'screen_contact',
    'screen_import',
    'import_completed',
    'import_parse_error',
    'import_save_error',
    'sync_error'
  )),
  created_at timestamptz not null default now()
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
alter table public.credit_cards   enable row level security;
alter table public.credit_card_purchases enable row level security;
alter table public.fixed_import_rules enable row level security;
alter table public.app_admins      enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.usage_events enable row level security;

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

drop policy if exists credit_cards_own on public.credit_cards;
create policy credit_cards_own on public.credit_cards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists credit_card_purchases_own on public.credit_card_purchases;
create policy credit_card_purchases_own on public.credit_card_purchases
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists fixed_import_rules_own on public.fixed_import_rules;
create policy fixed_import_rules_own on public.fixed_import_rules
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

drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists entries_user_date_idx on public.entries (user_id, date);
create index if not exists fixed_templates_user_idx on public.fixed_templates (user_id);
create index if not exists accounts_user_idx on public.accounts (user_id);
create index if not exists credit_cards_user_idx on public.credit_cards (user_id);
create index if not exists credit_card_purchases_user_date_idx
  on public.credit_card_purchases (user_id, purchase_date);
create index if not exists feedback_messages_user_created_idx on public.feedback_messages (user_id, created_at);
create index if not exists feedback_messages_status_created_idx on public.feedback_messages (status, created_at);
create index if not exists usage_events_created_name_idx on public.usage_events (created_at, event_name);
create index if not exists usage_events_user_idx on public.usage_events (user_id);

-- ============================================================
-- PERMISSÕES (privilégio mínimo)
-- ============================================================
revoke all on public.entries, public.fixed_templates, public.profiles, public.goals, public.accounts, public.credit_cards, public.credit_card_purchases, public.fixed_import_rules from anon;
revoke all on public.app_admins, public.feedback_messages from anon;
revoke all on public.usage_events from public, anon, authenticated;
grant insert (user_id, event_name) on public.usage_events to authenticated;
revoke truncate, references, trigger on public.usage_events from authenticated;
revoke truncate, references, trigger
  on public.entries, public.fixed_templates, public.profiles, public.goals, public.accounts, public.credit_cards, public.credit_card_purchases, public.fixed_import_rules from authenticated;
grant select, insert, update, delete
  on public.entries, public.fixed_templates, public.profiles, public.goals, public.accounts, public.credit_cards, public.credit_card_purchases, public.fixed_import_rules to authenticated;
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

create or replace function public.set_sync_record_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  server_time timestamptz := pg_catalog.clock_timestamp();
begin
  if tg_op = 'UPDATE' then
    if new.client_edited_at is null or new.client_edited_at <= old.updated_at then
      return null;
    end if;
    if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
      new.deleted_at := server_time;
    end if;
  elsif new.deleted_at is not null then
    new.deleted_at := server_time;
  end if;
  new.updated_at := server_time;
  return new;
end;
$$;
revoke execute on function public.set_sync_record_timestamps() from public, anon, authenticated;

create or replace function public.get_sync_server_time()
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return pg_catalog.clock_timestamp();
end;
$$;
revoke execute on function public.get_sync_server_time() from public, anon;
grant execute on function public.get_sync_server_time() to authenticated;

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
drop trigger if exists entries_sync_timestamps on public.entries;
create trigger entries_sync_timestamps before insert or update on public.entries
  for each row execute function public.set_sync_record_timestamps();

drop trigger if exists templates_set_updated_at on public.fixed_templates;
drop trigger if exists templates_sync_timestamps on public.fixed_templates;
create trigger templates_sync_timestamps before insert or update on public.fixed_templates
  for each row execute function public.set_sync_record_timestamps();

drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists profiles_sync_timestamps on public.profiles;
create trigger profiles_sync_timestamps before insert or update on public.profiles
  for each row execute function public.set_sync_record_timestamps();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists credit_cards_set_updated_at on public.credit_cards;
create trigger credit_cards_set_updated_at before update on public.credit_cards
  for each row execute function public.set_updated_at();

drop trigger if exists credit_card_purchases_set_updated_at on public.credit_card_purchases;
create trigger credit_card_purchases_set_updated_at before update on public.credit_card_purchases
  for each row execute function public.set_updated_at();

drop trigger if exists fixed_import_rules_set_updated_at on public.fixed_import_rules;
create trigger fixed_import_rules_set_updated_at before update on public.fixed_import_rules
  for each row execute function public.set_updated_at();

drop trigger if exists entries_sync_timestamps on public.entries;
create trigger entries_sync_timestamps before insert or update on public.entries
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists templates_sync_timestamps on public.fixed_templates;
create trigger templates_sync_timestamps before insert or update on public.fixed_templates
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists profiles_sync_timestamps on public.profiles;
create trigger profiles_sync_timestamps before insert or update on public.profiles
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists goals_sync_timestamps on public.goals;
create trigger goals_sync_timestamps before insert or update on public.goals
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists accounts_sync_timestamps on public.accounts;
create trigger accounts_sync_timestamps before insert or update on public.accounts
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists credit_cards_sync_timestamps on public.credit_cards;
create trigger credit_cards_sync_timestamps before insert or update on public.credit_cards
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists credit_card_purchases_sync_timestamps on public.credit_card_purchases;
create trigger credit_card_purchases_sync_timestamps before insert or update on public.credit_card_purchases
  for each row execute function public.set_sync_record_timestamps();
drop trigger if exists fixed_import_rules_sync_timestamps on public.fixed_import_rules;
create trigger fixed_import_rules_sync_timestamps before insert or update on public.fixed_import_rules
  for each row execute function public.set_sync_record_timestamps();

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
-- PAINEL ADMINISTRATIVO E EVENTOS DE USO AGREGADOS
-- ============================================================
create or replace function public.delete_my_usage_events()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.usage_events where user_id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_usage_events() from public, anon;
grant execute on function public.delete_my_usage_events() to authenticated;

create or replace function public.admin_analytics_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  with months as (
    select series.month_start::date as month_start
    from pg_catalog.generate_series(
      pg_catalog.date_trunc('month', current_date) - interval '11 months',
      pg_catalog.date_trunc('month', current_date),
      interval '1 month'
    ) as series(month_start)
  ),
  registration_months as (
    select
      pg_catalog.to_char(months.month_start, 'YYYY-MM') as period,
      (
        select pg_catalog.count(*)
        from auth.users
        where created_at >= months.month_start
          and created_at < months.month_start + interval '1 month'
      ) as event_count
    from months
  ),
  days as (
    select series.day_start::date as day_start
    from pg_catalog.generate_series(
      current_date - 29,
      current_date,
      interval '1 day'
    ) as series(day_start)
  ),
  imports_by_day as (
    select
      pg_catalog.to_char(days.day_start, 'YYYY-MM-DD') as period,
      (
        select pg_catalog.count(*)
        from public.usage_events
        where event_name = 'import_completed'
          and created_at >= days.day_start
          and created_at < days.day_start + interval '1 day'
      ) as event_count
    from days
  )
  select pg_catalog.jsonb_build_object(
    'users', pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from auth.users),
      'newWeek', (
        select pg_catalog.count(*) from auth.users
        where created_at >= pg_catalog.date_trunc('week', now())
      ),
      'newMonth', (
        select pg_catalog.count(*) from auth.users
        where created_at >= pg_catalog.date_trunc('month', now())
      ),
      'active7Days', (
        select pg_catalog.count(*) from auth.users
        where last_sign_in_at >= now() - interval '7 days'
      ),
      'active30Days', (
        select pg_catalog.count(*) from auth.users
        where last_sign_in_at >= now() - interval '30 days'
      )
    ),
    'registrations', coalesce(
      (select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('period', period, 'count', event_count)
        order by period
      ) from registration_months),
      '[]'::jsonb
    ),
    'records', pg_catalog.jsonb_build_object(
      'entries', (select pg_catalog.count(*) from public.entries where deleted_at is null),
      'accounts', (select pg_catalog.count(*) from public.accounts where deleted_at is null),
      'cards', (select pg_catalog.count(*) from public.credit_cards where deleted_at is null),
      'goals', (select pg_catalog.count(*) from public.goals where deleted_at is null)
    ),
    'feedback', pg_catalog.jsonb_build_object(
      'status', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('name', status, 'count', total)
          order by status
        )
        from (
          select status, pg_catalog.count(*) as total
          from public.feedback_messages
          group by status
        ) as feedback_status
      ), '[]'::jsonb),
      'categories', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('name', category, 'count', total)
          order by category
        )
        from (
          select category, pg_catalog.count(*) as total
          from public.feedback_messages
          group by category
        ) as feedback_category
      ), '[]'::jsonb)
    ),
    'usage', pg_catalog.jsonb_build_object(
      'uniqueUsers30Days', (
        select pg_catalog.count(distinct user_id)
        from public.usage_events
        where created_at >= now() - interval '30 days'
      ),
      'screens', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('name', event_name, 'count', total)
          order by total desc, event_name
        )
        from (
          select event_name, pg_catalog.count(*) as total
          from public.usage_events
          where created_at >= now() - interval '30 days'
            and event_name like 'screen_%'
          group by event_name
        ) as screen_counts
      ), '[]'::jsonb),
      'importsByDay', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('period', period, 'count', event_count)
          order by period
        )
        from imports_by_day
      ), '[]'::jsonb),
      'errors', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('name', event_name, 'count', total)
          order by total desc, event_name
        )
        from (
          select event_name, pg_catalog.count(*) as total
          from public.usage_events
          where created_at >= now() - interval '30 days'
            and event_name in ('import_parse_error', 'import_save_error', 'sync_error')
          group by event_name
        ) as error_counts
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_analytics_summary() from public, anon;
grant execute on function public.admin_analytics_summary() to authenticated;

create or replace function public.prune_usage_events()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count bigint;
begin
  delete from public.usage_events
  where created_at < now() - interval '12 months';
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke execute on function public.prune_usage_events() from public, anon, authenticated;

create or replace function public.prune_sync_tombstones()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare removed_count bigint := 0; affected bigint;
begin
  delete from public.entries where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.fixed_templates where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.goals where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.accounts where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.credit_cards where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.credit_card_purchases where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.profiles where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  delete from public.fixed_import_rules where deleted_at < pg_catalog.clock_timestamp() - interval '90 days';
  get diagnostics affected = row_count; removed_count := removed_count + affected;
  return removed_count;
end;
$$;
revoke execute on function public.prune_sync_tombstones() from public, anon, authenticated;

do $$
declare table_name text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach table_name in array array[
    'entries', 'fixed_templates', 'profiles', 'goals', 'accounts',
    'credit_cards', 'credit_card_purchases', 'fixed_import_rules'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute pg_catalog.format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'gastopro-prune-usage-events';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'gastopro-prune-usage-events',
    '15 3 * * *',
    'select public.prune_usage_events();'
  );
end;
$$;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'gastopro-prune-sync-tombstones';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'gastopro-prune-sync-tombstones',
    '30 3 * * *',
    'select public.prune_sync_tombstones();'
  );
end;
$$;

-- ============================================================
-- PENDENTE
-- ============================================================
-- * Supabase Storage para o avatar (hoje é Base64 em profiles.avatar)

create or replace function public.import_financial_batch(
  p_entries jsonb,
  p_templates jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_entry public.entries%rowtype;
  v_template public.fixed_templates%rowtype;
  v_client_edited_at timestamptz;
  v_month text;
  v_conflicts jsonb := '[]'::jsonb;
  v_entry_versions jsonb;
  v_template_versions jsonb;
  v_touched uuid[] := '{}'::uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_typeof(p_templates) <> 'array' or
    jsonb_typeof(p_payments) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'invalid_batch');
  end if;
  if jsonb_array_length(p_entries) + jsonb_array_length(p_templates) +
    jsonb_array_length(p_payments) > 500 then
    return jsonb_build_object('success', false, 'error', 'batch_limit_exceeded', 'limit', 500);
  end if;

  begin
    for v_item in select value from jsonb_array_elements(p_entries) as input(value) loop
      v_client_edited_at := nullif(v_item->>'client_edited_at', '')::timestamptz;
      if v_client_edited_at is null then
        raise exception using errcode = 'P0001', message = 'missing_client_version';
      end if;
      select * into v_entry
      from public.entries
      where id = (v_item->>'id')::uuid and user_id = v_user_id
      for update;
      if found then
        if v_entry.deleted_at is not null then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'entries', 'id', v_entry.id));
        elsif v_entry.description is not distinct from v_item->>'description' and
          v_entry.amount = (v_item->>'amount')::numeric and
          v_entry.category is not distinct from v_item->>'category' and
          v_entry.type is not distinct from v_item->>'type' and
          v_entry.date is not distinct from v_item->>'date' and
          v_entry.paid is not distinct from coalesce((v_item->>'paid')::boolean, false) and
          v_entry.is_debt is not distinct from coalesce((v_item->>'is_debt')::boolean, false) and
          v_entry.debt_info is not distinct from nullif(v_item->'debt_info', 'null'::jsonb) and
          v_entry.active is not distinct from coalesce((v_item->>'active')::boolean, true) and
          v_entry.account_id is not distinct from nullif(v_item->>'account_id', '')::uuid and
          v_entry.payment_method is not distinct from nullif(v_item->>'payment_method', '') then
          null;
        elsif v_client_edited_at <= v_entry.updated_at then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'entries', 'id', v_entry.id));
        else
          update public.entries set
            description = v_item->>'description',
            amount = (v_item->>'amount')::numeric,
            category = v_item->>'category',
            type = v_item->>'type',
            date = v_item->>'date',
            paid = coalesce((v_item->>'paid')::boolean, false),
            is_debt = coalesce((v_item->>'is_debt')::boolean, false),
            debt_info = nullif(v_item->'debt_info', 'null'::jsonb),
            active = coalesce((v_item->>'active')::boolean, true),
            account_id = nullif(v_item->>'account_id', '')::uuid,
            payment_method = nullif(v_item->>'payment_method', ''),
            client_edited_at = v_client_edited_at
          where id = v_entry.id and user_id = v_user_id;
        end if;
      else
        insert into public.entries (
          id, user_id, description, amount, category, type, date, paid, is_debt,
          debt_info, active, account_id, payment_method, client_edited_at, deleted_at
        ) values (
          (v_item->>'id')::uuid, v_user_id, v_item->>'description',
          (v_item->>'amount')::numeric, v_item->>'category', v_item->>'type',
          v_item->>'date', coalesce((v_item->>'paid')::boolean, false),
          coalesce((v_item->>'is_debt')::boolean, false),
          nullif(v_item->'debt_info', 'null'::jsonb),
          coalesce((v_item->>'active')::boolean, true),
          nullif(v_item->>'account_id', '')::uuid,
          nullif(v_item->>'payment_method', ''), v_client_edited_at, null
        );
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(p_templates) as input(value) loop
      v_client_edited_at := nullif(v_item->>'client_edited_at', '')::timestamptz;
      if v_client_edited_at is null then
        raise exception using errcode = 'P0001', message = 'missing_client_version';
      end if;
      select * into v_template
      from public.fixed_templates
      where id = (v_item->>'id')::uuid and user_id = v_user_id
      for update;
      if found then
        if v_template.deleted_at is not null then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'templates', 'id', v_template.id));
        elsif v_template.description is not distinct from v_item->>'description' and
          v_template.amount = (v_item->>'amount')::numeric and
          v_template.category is not distinct from v_item->>'category' and
          v_template.type is not distinct from coalesce(v_item->>'type', 'fixed') and
          v_template.is_debt is not distinct from coalesce((v_item->>'is_debt')::boolean, false) and
          v_template.active is not distinct from coalesce((v_item->>'active')::boolean, true) and
          v_template.start_month is not distinct from v_item->>'start_month' and
          v_template.end_month is not distinct from nullif(v_item->>'end_month', '') and
          v_template.day is not distinct from coalesce(v_item->>'day', '01') and
          v_template.paid_months is not distinct from coalesce(v_item->'paid_months', '{}'::jsonb) and
          v_template.account_id is not distinct from nullif(v_item->>'account_id', '')::uuid then
          null;
        elsif v_client_edited_at <= v_template.updated_at then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'templates', 'id', v_template.id));
        else
          update public.fixed_templates set
            description = v_item->>'description',
            amount = (v_item->>'amount')::numeric,
            category = v_item->>'category',
            type = coalesce(v_item->>'type', 'fixed'),
            is_debt = coalesce((v_item->>'is_debt')::boolean, false),
            active = coalesce((v_item->>'active')::boolean, true),
            start_month = v_item->>'start_month',
            end_month = nullif(v_item->>'end_month', ''),
            day = coalesce(v_item->>'day', '01'),
            paid_months = coalesce(v_item->'paid_months', '{}'::jsonb),
            account_id = nullif(v_item->>'account_id', '')::uuid,
            client_edited_at = v_client_edited_at
          where id = v_template.id and user_id = v_user_id;
          v_touched := v_touched || (v_item->>'id')::uuid;
        end if;
      else
        insert into public.fixed_templates (
          id, user_id, description, amount, category, type, is_debt, active,
          start_month, end_month, day, paid_months, account_id, client_edited_at
        ) values (
          (v_item->>'id')::uuid, v_user_id, v_item->>'description',
          (v_item->>'amount')::numeric, v_item->>'category', coalesce(v_item->>'type', 'fixed'),
          coalesce((v_item->>'is_debt')::boolean, false),
          coalesce((v_item->>'active')::boolean, true), v_item->>'start_month',
          nullif(v_item->>'end_month', ''), coalesce(v_item->>'day', '01'),
          coalesce(v_item->'paid_months', '{}'::jsonb),
          nullif(v_item->>'account_id', '')::uuid, v_client_edited_at
        );
        v_touched := v_touched || (v_item->>'id')::uuid;
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(p_payments) as input(value) loop
      v_month := v_item->>'ym';
      v_client_edited_at := nullif(v_item->>'client_edited_at', '')::timestamptz;
      if v_month !~ '^\d{4}-\d{2}$' or v_client_edited_at is null then
        raise exception using errcode = 'P0001', message = 'invalid_payment_version';
      end if;
      select * into v_template
      from public.fixed_templates
      where id = (v_item->>'id')::uuid and user_id = v_user_id
      for update;
      if not found or v_template.deleted_at is not null then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'kind', 'payments', 'id', v_item->>'id', 'ym', v_month
        ));
      elsif v_template.paid_months->>v_month = 'true' then
        null;
      elsif v_template.id = any(v_touched) then
        update public.fixed_templates set
          paid_months = coalesce(paid_months, '{}'::jsonb) || jsonb_build_object(v_month, true),
          client_edited_at = pg_catalog.clock_timestamp()
        where id = v_template.id and user_id = v_user_id;
      elsif v_client_edited_at <= v_template.updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'kind', 'payments', 'id', v_template.id, 'ym', v_month
        ));
      else
        update public.fixed_templates set
          paid_months = coalesce(paid_months, '{}'::jsonb) || jsonb_build_object(v_month, true),
          client_edited_at = v_client_edited_at
        where id = v_template.id and user_id = v_user_id;
        v_touched := v_touched || v_template.id;
      end if;
    end loop;

    if jsonb_array_length(v_conflicts) > 0 then
      raise exception using errcode = 'P0001', message = 'sync_conflict';
    end if;

    select coalesce(jsonb_object_agg(id::text, updated_at), '{}'::jsonb) into v_entry_versions
    from public.entries
    where user_id = v_user_id and id in (
      select (value->>'id')::uuid from jsonb_array_elements(p_entries) as input(value)
    );
    select coalesce(jsonb_object_agg(id::text, updated_at), '{}'::jsonb) into v_template_versions
    from public.fixed_templates
    where user_id = v_user_id and id in (
      select (value->>'id')::uuid from jsonb_array_elements(p_templates || p_payments) as input(value)
    );
    return jsonb_build_object('success', true, 'conflicts', '[]'::jsonb, 'versions',
      jsonb_build_object('entries', v_entry_versions, 'templates', v_template_versions));
  exception
    when sqlstate 'P0001' then
      return jsonb_build_object('success', false, 'error', sqlerrm, 'conflicts', v_conflicts);
    when others then
      return jsonb_build_object('success', false, 'error', sqlerrm, 'conflicts', v_conflicts);
  end;
end;
$$;

create or replace function public.delete_account_transactional(
  p_account_id uuid,
  p_client_edited_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_updated_at timestamptz;
  v_account public.accounts%rowtype;
  v_conflicts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_client_edited_at is null then
    return jsonb_build_object('success', false, 'error', 'missing_client_version');
  end if;

  begin
    for v_id, v_updated_at in
      select id, updated_at from public.entries
      where user_id = v_user_id and account_id = p_account_id and deleted_at is null
      order by id for update
    loop
      if p_client_edited_at <= v_updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'entries', 'id', v_id));
      else
        update public.entries set account_id = null, client_edited_at = p_client_edited_at
        where id = v_id and user_id = v_user_id;
      end if;
    end loop;

    for v_id, v_updated_at in
      select id, updated_at from public.fixed_templates
      where user_id = v_user_id and account_id = p_account_id and deleted_at is null
      order by id for update
    loop
      if p_client_edited_at <= v_updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'templates', 'id', v_id));
      else
        update public.fixed_templates set account_id = null, client_edited_at = p_client_edited_at
        where id = v_id and user_id = v_user_id;
      end if;
    end loop;

    for v_id, v_updated_at in
      select id, updated_at from public.credit_cards
      where user_id = v_user_id and account_id = p_account_id and deleted_at is null
      order by id for update
    loop
      if p_client_edited_at <= v_updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'creditCards', 'id', v_id));
      else
        update public.credit_cards set account_id = null, client_edited_at = p_client_edited_at
        where id = v_id and user_id = v_user_id;
      end if;
    end loop;

    for v_id, v_updated_at in
      select id, updated_at from public.credit_card_purchases
      where user_id = v_user_id and account_id = p_account_id and deleted_at is null
      order by id for update
    loop
      if p_client_edited_at <= v_updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'creditCardPurchases', 'id', v_id));
      else
        update public.credit_card_purchases set account_id = null, client_edited_at = p_client_edited_at
        where id = v_id and user_id = v_user_id;
      end if;
    end loop;

    select * into v_account from public.accounts
    where id = p_account_id and user_id = v_user_id for update;
    if found and v_account.deleted_at is null then
      if p_client_edited_at <= v_account.updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'accounts', 'id', p_account_id));
      else
        update public.accounts set deleted_at = pg_catalog.clock_timestamp(),
          client_edited_at = p_client_edited_at
        where id = p_account_id and user_id = v_user_id;
      end if;
    end if;

    if jsonb_array_length(v_conflicts) > 0 then
      raise exception using errcode = 'P0001', message = 'sync_conflict';
    end if;

    return jsonb_build_object('success', true, 'conflicts', '[]'::jsonb);
  exception
    when sqlstate 'P0001' then
      return jsonb_build_object('success', false, 'error', sqlerrm, 'conflicts', v_conflicts);
    when others then
      return jsonb_build_object('success', false, 'error', sqlerrm, 'conflicts', v_conflicts);
  end;
end;
$$;

revoke execute on function public.import_financial_batch(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_financial_batch(jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.delete_account_transactional(uuid, timestamptz) from public, anon;
grant execute on function public.delete_account_transactional(uuid, timestamptz) to authenticated;
