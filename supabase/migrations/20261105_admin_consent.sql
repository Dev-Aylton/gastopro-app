-- Preferencias opcionais de privacidade por conta.
create table if not exists public.user_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_visibility boolean not null default false,
  telemetry_enabled boolean not null default false,
  text_version text,
  accepted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_consents enable row level security;
revoke all on public.user_consents from public, anon, authenticated;
grant select, insert, update on public.user_consents to authenticated;

drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own on public.user_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_consents_insert_own on public.user_consents;
create policy user_consents_insert_own on public.user_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_consents_update_own on public.user_consents;
create policy user_consents_update_own on public.user_consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.update_user_consents_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_consents_updated_at on public.user_consents;
create trigger user_consents_updated_at
  before update on public.user_consents
  for each row execute function public.update_user_consents_timestamp();

revoke execute on function public.update_user_consents_timestamp() from public, anon, authenticated;

-- A telemetria só aceita eventos de usuários que ativaram essa opção.
drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_consents
      where user_consents.user_id = (select auth.uid())
        and user_consents.telemetry_enabled = true
    )
  );

-- Lista apenas a identidade consentida; os demais usuários são apresentados por posição.
create or replace function public.admin_list_users()
returns table (
  user_number bigint,
  display_name text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  live_entries bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  with ordered_users as (
    select
      users.id,
      users.email as account_email,
      users.created_at as signup_at,
      users.last_sign_in_at as last_seen_at,
      users.raw_user_meta_data ->> 'name' as metadata_name,
      row_number() over (order by users.created_at, users.id) as position,
      coalesce(consents.admin_visibility, false) as can_show_identity
    from auth.users as users
    left join public.user_consents as consents on consents.user_id = users.id
  )
  select
    ordered_users.position,
    case
      when ordered_users.can_show_identity
        then coalesce(nullif(profiles.name, ''), nullif(ordered_users.metadata_name, ''), 'Nome não informado')
      else 'Usuário nº ' || ordered_users.position::text
    end,
    case when ordered_users.can_show_identity then ordered_users.account_email else null end,
    ordered_users.signup_at,
    case when ordered_users.can_show_identity then ordered_users.last_seen_at else null end,
    case when ordered_users.can_show_identity then (
      select count(*)
      from public.entries
      where entries.user_id = ordered_users.id
        and entries.deleted_at is null
    ) else null end
  from ordered_users
  left join public.profiles as profiles on profiles.id = ordered_users.id
  order by ordered_users.position;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Substitui a função antiga sem argumentos para que o mês selecionado filtre as importações.
drop function if exists public.admin_analytics_summary();

create or replace function public.admin_analytics_summary(p_month text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  selected_month date;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_month is null then
    selected_month := pg_catalog.date_trunc('month', current_date)::date;
  elsif p_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    selected_month := (p_month || '-01')::date;
  else
    raise exception 'Invalid month' using errcode = '22023';
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
  -- Uma linha por dia do mês selecionado, inclusive dias sem importações.
  selected_month_days as (
    select series.day_start::date as day_start
    from pg_catalog.generate_series(
      selected_month,
      (selected_month + interval '1 month' - interval '1 day')::date,
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
    from selected_month_days as days
  )
  select pg_catalog.jsonb_build_object(
    -- Conta usuários totais, novos e ativos pelo último acesso.
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
    -- Conta cadastros por mês nos últimos doze meses.
    'registrations', coalesce(
      (select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('period', period, 'count', event_count)
        order by period
      ) from registration_months),
      '[]'::jsonb
    ),
    -- Conta registros vivos por tipo, sem expor conteúdo ou valores.
    'records', pg_catalog.jsonb_build_object(
      'entries', (select pg_catalog.count(*) from public.entries where deleted_at is null),
      'fixedTemplates', (select pg_catalog.count(*) from public.fixed_templates where deleted_at is null),
      'accounts', (select pg_catalog.count(*) from public.accounts where deleted_at is null),
      'cards', (select pg_catalog.count(*) from public.credit_cards where deleted_at is null),
      'goals', (select pg_catalog.count(*) from public.goals where deleted_at is null)
    ),
    -- Conta mensagens por status e categoria, sem incluir seus textos.
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
    -- Conta eventos consentidos por período; não devolve IDs nem dados financeiros.
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

revoke execute on function public.admin_analytics_summary(text) from public, anon;
grant execute on function public.admin_analytics_summary(text) to authenticated;
