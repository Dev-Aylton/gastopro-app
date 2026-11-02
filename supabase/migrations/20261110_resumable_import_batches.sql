begin;

alter table public.entries
  add column if not exists import_batch_id uuid;

alter table public.fixed_templates
  add column if not exists import_batch_id uuid;

create unique index if not exists entries_import_batch_id_id_key
  on public.entries (user_id, import_batch_id, id)
  where import_batch_id is not null;

create unique index if not exists templates_import_batch_id_id_key
  on public.fixed_templates (user_id, import_batch_id, id)
  where import_batch_id is not null;

create or replace function public.import_financial_batch(
  p_entries jsonb,
  p_templates jsonb,
  p_payments jsonb,
  p_import_batch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_entry_versions jsonb;
  v_template_versions jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_import_batch_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_import_batch_id');
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_typeof(p_templates) <> 'array' or
    jsonb_typeof(p_payments) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'invalid_batch');
  end if;
  if jsonb_array_length(p_entries) + jsonb_array_length(p_templates) +
    jsonb_array_length(p_payments) > 500 then
    return jsonb_build_object('success', false, 'error', 'batch_limit_exceeded', 'limit', 500);
  end if;

  v_result := public.import_financial_batch(p_entries, p_templates, p_payments);
  if not coalesce((v_result->>'success')::boolean, false) then
    return v_result;
  end if;

  update public.entries
  set import_batch_id = p_import_batch_id
  where user_id = v_user_id
    and id in (
      select (item->>'id')::uuid
      from jsonb_array_elements(p_entries) as input(item)
    );

  update public.fixed_templates
  set import_batch_id = p_import_batch_id
  where user_id = v_user_id
    and id in (
      select (item->>'id')::uuid
      from jsonb_array_elements(p_templates || p_payments) as input(item)
    );

  select coalesce(jsonb_object_agg(id::text, updated_at), '{}'::jsonb)
  into v_entry_versions
  from public.entries
  where user_id = v_user_id
    and id in (
      select (item->>'id')::uuid
      from jsonb_array_elements(p_entries) as input(item)
    );

  select coalesce(jsonb_object_agg(id::text, updated_at), '{}'::jsonb)
  into v_template_versions
  from public.fixed_templates
  where user_id = v_user_id
    and id in (
      select (item->>'id')::uuid
      from jsonb_array_elements(p_templates || p_payments) as input(item)
    );

  v_result := jsonb_set(
    v_result,
    '{versions}',
    coalesce(v_result->'versions', '{}'::jsonb),
    true
  );
  v_result := jsonb_set(v_result, '{versions,entries}', v_entry_versions, true);
  v_result := jsonb_set(v_result, '{versions,templates}', v_template_versions, true);
  return v_result;
end;
$$;

revoke execute on function public.import_financial_batch(jsonb, jsonb, jsonb, uuid)
  from public, anon;
grant execute on function public.import_financial_batch(jsonb, jsonb, jsonb, uuid)
  to authenticated;

commit;
