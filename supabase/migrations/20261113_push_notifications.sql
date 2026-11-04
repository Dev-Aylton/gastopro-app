create table if not exists public.push_subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);

create table if not exists public.push_due_dates (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  due_date date not null,
  item_count integer not null check (item_count > 0),
  primary key (user_id, due_date)
);

create table if not exists public.push_notification_log (
  user_id uuid not null,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, due_date)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_due_dates enable row level security;
alter table public.push_notification_log enable row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated, service_role;
revoke all on table public.push_due_dates from public, anon, authenticated, service_role;
revoke all on table public.push_notification_log from public, anon, authenticated, service_role;

grant select, insert, delete on table public.push_subscriptions to authenticated;
grant select, insert, delete on table public.push_due_dates to authenticated;
grant select, delete on table public.push_subscriptions to service_role;
grant select on table public.push_due_dates to service_role;
grant select, insert on table public.push_notification_log to service_role;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_due_dates_select_own on public.push_due_dates;
create policy push_due_dates_select_own on public.push_due_dates
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_due_dates_insert_own on public.push_due_dates;
create policy push_due_dates_insert_own on public.push_due_dates
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists push_due_dates_delete_own on public.push_due_dates;
create policy push_due_dates_delete_own on public.push_due_dates
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- This index supports the scheduled worker's cross-user date-range scan.
create index if not exists push_due_dates_due_date_idx
  on public.push_due_dates (due_date);

create or replace function public.push_replace_due_dates(p_dates jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_due_date date;
  v_item_count numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_dates is null or jsonb_typeof(p_dates) is distinct from 'array' then
    raise exception 'p_dates must be a JSON array';
  end if;
  if jsonb_array_length(p_dates) > 100 then
    raise exception 'p_dates may contain at most 100 items';
  end if;

  for v_item in
    select input.item
    from jsonb_array_elements(p_dates) as input(item)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'Each due date item must be an object';
    end if;
    if jsonb_object_length(v_item) <> 2 then
      raise exception 'Each due date item must contain exactly due_date and item_count';
    end if;
    if jsonb_typeof(v_item -> 'due_date') is distinct from 'string' then
      raise exception 'due_date must be a string';
    end if;
    if (v_item ->> 'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'due_date must use YYYY-MM-DD format';
    end if;
    begin
      v_due_date := (v_item ->> 'due_date')::date;
    exception when others then
      raise exception 'due_date must be a valid calendar date';
    end;
    if v_due_date::text <> (v_item ->> 'due_date') then
      raise exception 'due_date must be a valid calendar date';
    end if;
    if jsonb_typeof(v_item -> 'item_count') is distinct from 'number' then
      raise exception 'item_count must be a positive integer';
    end if;
    if (v_item ->> 'item_count') !~ '^[0-9]+$' then
      raise exception 'item_count must be a positive integer';
    end if;
    v_item_count := (v_item ->> 'item_count')::numeric;
    if v_item_count <= 0 or v_item_count > 2147483647 or
      trunc(v_item_count) <> v_item_count then
      raise exception 'item_count must be a positive 32-bit integer';
    end if;
  end loop;

  if exists (
    select input.item ->> 'due_date'
    from jsonb_array_elements(p_dates) as input(item)
    group by input.item ->> 'due_date'
    having count(*) > 1
  ) then
    raise exception 'p_dates must not contain duplicate due_date values';
  end if;

  delete from public.push_due_dates
  where user_id = v_user_id;

  insert into public.push_due_dates (user_id, due_date, item_count)
  select v_user_id, (input.item ->> 'due_date')::date,
    (input.item ->> 'item_count')::integer
  from jsonb_array_elements(p_dates) as input(item);
end;
$$;

revoke execute on function public.push_replace_due_dates(jsonb) from public, anon, authenticated;
grant execute on function public.push_replace_due_dates(jsonb) to authenticated;
