-- Expõe autores de feedback ao Admin sem revelar identidades sem consentimento.
-- Reutiliza a ordenação e a regra de admin_visibility de admin_list_users.
-- SECURITY DEFINER evita ampliar políticas ou acesso a tabelas subjacentes.

create or replace function public.admin_feedback_authors()
returns table (
  user_id uuid,
  user_number bigint,
  display_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
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
      users.raw_user_meta_data ->> 'name' as metadata_name,
      pg_catalog.row_number() over (order by users.created_at, users.id) as position,
      coalesce(consents.admin_visibility, false) as can_show_identity
    from auth.users as users
    left join public.user_consents as consents on consents.user_id = users.id
  )
  select
    ordered_users.id,
    ordered_users.position,
    case
      when ordered_users.can_show_identity
        then coalesce(nullif(profiles.name, ''), nullif(ordered_users.metadata_name, ''), 'Nome não informado')
      else 'Usuário nº ' || ordered_users.position::text
    end,
    case when ordered_users.can_show_identity then ordered_users.account_email else null end
  from ordered_users
  left join public.profiles as profiles on profiles.id = ordered_users.id
  where exists (
    select 1
    from public.feedback_messages as messages
    where messages.user_id = ordered_users.id
  )
  order by ordered_users.position;
end;
$$;

revoke all on function public.admin_feedback_authors() from public, anon;
grant execute on function public.admin_feedback_authors() to authenticated;

-- Rollback:
-- revoke execute on function public.admin_feedback_authors() from authenticated;
-- drop function if exists public.admin_feedback_authors();
