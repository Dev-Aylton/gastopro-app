-- Painel administrativo e eventos mínimos de uso. Executar manualmente no SQL Editor.

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

create index if not exists usage_events_created_name_idx
  on public.usage_events (created_at, event_name);
create index if not exists usage_events_user_idx
  on public.usage_events (user_id);

alter table public.usage_events enable row level security;

drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.usage_events from public, anon, authenticated;
grant insert (user_id, event_name) on public.usage_events to authenticated;
revoke truncate, references, trigger on public.usage_events from authenticated;

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
      'entries', (select pg_catalog.count(*) from public.entries),
      'accounts', (select pg_catalog.count(*) from public.accounts),
      'cards', (select pg_catalog.count(*) from public.credit_cards),
      'goals', (select pg_catalog.count(*) from public.goals)
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
