-- RM-025 parte A: contas bancárias e vínculo opcional com lançamentos/templates.
-- Não executar automaticamente; aplicar pelo painel do Supabase.

create extension if not exists "uuid-ossp" with schema extensions;

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

alter table public.entries add column if not exists account_id uuid;
alter table public.fixed_templates add column if not exists account_id uuid;

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

alter table public.accounts enable row level security;
drop policy if exists accounts_own on public.accounts;
create policy accounts_own on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists accounts_user_idx on public.accounts (user_id);
revoke all on public.accounts from anon;
revoke truncate, references, trigger on public.accounts from authenticated;
grant select, insert, update, delete on public.accounts to authenticated;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
