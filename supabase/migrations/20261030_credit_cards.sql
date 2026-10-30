create table if not exists public.credit_cards (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  total_limit numeric(12,2) not null check (total_limit > 0),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day     integer not null check (due_day between 1 and 31),
  account_id  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint credit_cards_user_id_id_key unique (user_id, id)
);

alter table public.credit_cards enable row level security;

drop policy if exists credit_cards_own on public.credit_cards;
create policy credit_cards_own on public.credit_cards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists credit_cards_user_idx on public.credit_cards (user_id);

revoke all on public.credit_cards from anon;
revoke truncate, references, trigger on public.credit_cards from authenticated;
grant select, insert, update, delete on public.credit_cards to authenticated;

drop trigger if exists credit_cards_set_updated_at on public.credit_cards;
create trigger credit_cards_set_updated_at before update on public.credit_cards
  for each row execute function public.set_updated_at();
