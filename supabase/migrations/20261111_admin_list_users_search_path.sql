-- Após executar, confira pg_get_functiondef, proconfig e proacl em pg_proc.
-- Verifique também que a definição e os grants correspondem ao schema.sql.
create or replace function public.admin_list_users()
returns table (
  user_number bigint,
  display_name text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
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
      pg_catalog.row_number() over (order by users.created_at, users.id) as position,
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
    case when ordered_users.can_show_identity then ordered_users.account_email::text else null end,
    ordered_users.signup_at,
    case when ordered_users.can_show_identity then ordered_users.last_seen_at else null end
  from ordered_users
  left join public.profiles as profiles on profiles.id = ordered_users.id
  order by ordered_users.position;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated, service_role;
