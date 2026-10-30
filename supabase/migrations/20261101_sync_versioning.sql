-- Versionamento e exclusao logica dos registros sincronizados.
alter table public.entries add column if not exists deleted_at timestamptz;
alter table public.entries add column if not exists client_edited_at timestamptz;
alter table public.fixed_templates add column if not exists deleted_at timestamptz;
alter table public.fixed_templates add column if not exists client_edited_at timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists client_edited_at timestamptz;
alter table public.goals add column if not exists deleted_at timestamptz;
alter table public.goals add column if not exists client_edited_at timestamptz;
alter table public.accounts add column if not exists deleted_at timestamptz;
alter table public.accounts add column if not exists client_edited_at timestamptz;
alter table public.credit_cards add column if not exists deleted_at timestamptz;
alter table public.credit_cards add column if not exists client_edited_at timestamptz;
alter table public.credit_card_purchases add column if not exists deleted_at timestamptz;
alter table public.credit_card_purchases add column if not exists client_edited_at timestamptz;
alter table public.fixed_import_rules add column if not exists deleted_at timestamptz;
alter table public.fixed_import_rules add column if not exists client_edited_at timestamptz;

update public.entries set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.fixed_templates set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.profiles set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.goals set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.accounts set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.credit_cards set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.credit_card_purchases set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());
update public.fixed_import_rules set updated_at = coalesce(updated_at, clock_timestamp()), client_edited_at = coalesce(client_edited_at, updated_at, clock_timestamp());

alter table public.entries alter column updated_at set default now(), alter column updated_at set not null;
alter table public.fixed_templates alter column updated_at set default now(), alter column updated_at set not null;
alter table public.profiles alter column updated_at set default now(), alter column updated_at set not null;
alter table public.goals alter column updated_at set default now(), alter column updated_at set not null;
alter table public.accounts alter column updated_at set default now(), alter column updated_at set not null;
alter table public.credit_cards alter column updated_at set default now(), alter column updated_at set not null;
alter table public.credit_card_purchases alter column updated_at set default now(), alter column updated_at set not null;
alter table public.fixed_import_rules alter column updated_at set default now(), alter column updated_at set not null;

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
drop trigger if exists entries_set_updated_at on public.entries;
drop trigger if exists templates_set_updated_at on public.fixed_templates;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists goals_set_updated_at on public.goals;
drop trigger if exists accounts_set_updated_at on public.accounts;
drop trigger if exists credit_cards_set_updated_at on public.credit_cards;
drop trigger if exists credit_card_purchases_set_updated_at on public.credit_card_purchases;
drop trigger if exists fixed_import_rules_set_updated_at on public.fixed_import_rules;
create trigger entries_sync_timestamps before insert or update on public.entries for each row execute function public.set_sync_record_timestamps();
create trigger templates_sync_timestamps before insert or update on public.fixed_templates for each row execute function public.set_sync_record_timestamps();
create trigger profiles_sync_timestamps before insert or update on public.profiles for each row execute function public.set_sync_record_timestamps();
create trigger goals_sync_timestamps before insert or update on public.goals for each row execute function public.set_sync_record_timestamps();
create trigger accounts_sync_timestamps before insert or update on public.accounts for each row execute function public.set_sync_record_timestamps();
create trigger credit_cards_sync_timestamps before insert or update on public.credit_cards for each row execute function public.set_sync_record_timestamps();
create trigger credit_card_purchases_sync_timestamps before insert or update on public.credit_card_purchases for each row execute function public.set_sync_record_timestamps();
create trigger fixed_import_rules_sync_timestamps before insert or update on public.fixed_import_rules for each row execute function public.set_sync_record_timestamps();

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

create extension if not exists pg_cron;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'gastopro-prune-sync-tombstones';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('gastopro-prune-sync-tombstones', '30 3 * * *', 'select public.prune_sync_tombstones();');
end;
$$;

create or replace function public.admin_analytics_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  with months as (
    select series.month_start::date as month_start from pg_catalog.generate_series(
      pg_catalog.date_trunc('month', current_date) - interval '11 months',
      pg_catalog.date_trunc('month', current_date), interval '1 month') as series(month_start)
  ), registration_months as (
    select pg_catalog.to_char(months.month_start, 'YYYY-MM') as period,
      (select pg_catalog.count(*) from auth.users where created_at >= months.month_start and created_at < months.month_start + interval '1 month') as event_count
    from months
  ), days as (
    select series.day_start::date as day_start from pg_catalog.generate_series(current_date - 29, current_date, interval '1 day') as series(day_start)
  ), imports_by_day as (
    select pg_catalog.to_char(days.day_start, 'YYYY-MM-DD') as period,
      (select pg_catalog.count(*) from public.usage_events where event_name = 'import_completed' and created_at >= days.day_start and created_at < days.day_start + interval '1 day') as event_count
    from days
  )
  select pg_catalog.jsonb_build_object(
    'users', pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from auth.users),
      'newWeek', (select pg_catalog.count(*) from auth.users where created_at >= pg_catalog.date_trunc('week', now())),
      'newMonth', (select pg_catalog.count(*) from auth.users where created_at >= pg_catalog.date_trunc('month', now())),
      'active7Days', (select pg_catalog.count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
      'active30Days', (select pg_catalog.count(*) from auth.users where last_sign_in_at >= now() - interval '30 days')),
    'registrations', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('period', period, 'count', event_count) order by period) from registration_months), '[]'::jsonb),
    'records', pg_catalog.jsonb_build_object(
      'entries', (select pg_catalog.count(*) from public.entries where deleted_at is null),
      'accounts', (select pg_catalog.count(*) from public.accounts where deleted_at is null),
      'cards', (select pg_catalog.count(*) from public.credit_cards where deleted_at is null),
      'goals', (select pg_catalog.count(*) from public.goals where deleted_at is null)),
    'feedback', pg_catalog.jsonb_build_object(
      'status', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', status, 'count', total) order by status) from (select status, pg_catalog.count(*) as total from public.feedback_messages group by status) as feedback_status), '[]'::jsonb),
      'categories', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', category, 'count', total) order by category) from (select category, pg_catalog.count(*) as total from public.feedback_messages group by category) as feedback_category), '[]'::jsonb)),
    'usage', pg_catalog.jsonb_build_object(
      'uniqueUsers30Days', (select pg_catalog.count(distinct user_id) from public.usage_events where created_at >= now() - interval '30 days'),
      'screens', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', event_name, 'count', total) order by total desc, event_name) from (select event_name, pg_catalog.count(*) as total from public.usage_events where created_at >= now() - interval '30 days' and event_name like 'screen_%' group by event_name) as screen_counts), '[]'::jsonb),
      'importsByDay', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('period', period, 'count', event_count) order by period) from imports_by_day), '[]'::jsonb),
      'errors', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', event_name, 'count', total) order by total desc, event_name) from (select event_name, pg_catalog.count(*) as total from public.usage_events where created_at >= now() - interval '30 days' and event_name in ('import_parse_error', 'import_save_error', 'sync_error') group by event_name) as error_counts), '[]'::jsonb))
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_analytics_summary() from public, anon;
grant execute on function public.admin_analytics_summary() to authenticated;