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
  constraint credit_card_purchases_user_id_id_key unique (user_id, id),
  constraint credit_card_purchases_card_fk foreign key (user_id, card_id)
    references public.credit_cards(user_id, id) on delete set null (card_id)
);

alter table public.credit_card_purchases enable row level security;

drop policy if exists credit_card_purchases_own on public.credit_card_purchases;
create policy credit_card_purchases_own on public.credit_card_purchases
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists credit_card_purchases_user_date_idx
  on public.credit_card_purchases (user_id, purchase_date);

revoke all on public.credit_card_purchases from anon;
revoke truncate, references, trigger on public.credit_card_purchases from authenticated;
grant select, insert, update, delete on public.credit_card_purchases to authenticated;

drop trigger if exists credit_card_purchases_set_updated_at on public.credit_card_purchases;
create trigger credit_card_purchases_set_updated_at before update on public.credit_card_purchases
  for each row execute function public.set_updated_at();
