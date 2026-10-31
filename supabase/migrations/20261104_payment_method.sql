alter table public.entries
  add column if not exists payment_method text
  check (payment_method is null or payment_method in (
    'pix', 'debit', 'cash', 'credit_card', 'boleto', 'transfer', 'other'
  ));

alter table public.credit_cards
  add column if not exists previous_spent numeric(12,2) not null default 0
  check (previous_spent >= 0);

create or replace function public.import_financial_batch(
  p_entries jsonb,
  p_templates jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_entry public.entries%rowtype;
  v_template public.fixed_templates%rowtype;
  v_client_edited_at timestamptz;
  v_month text;
  v_conflicts jsonb := '[]'::jsonb;
  v_entry_versions jsonb;
  v_template_versions jsonb;
  v_touched uuid[] := '{}'::uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_typeof(p_templates) <> 'array' or
    jsonb_typeof(p_payments) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'invalid_batch');
  end if;
  if jsonb_array_length(p_entries) + jsonb_array_length(p_templates) +
    jsonb_array_length(p_payments) > 500 then
    return jsonb_build_object('success', false, 'error', 'batch_limit_exceeded', 'limit', 500);
  end if;

  begin
    for v_item in select value from jsonb_array_elements(p_entries) as input(value) loop
      v_client_edited_at := nullif(v_item->>'client_edited_at', '')::timestamptz;
      if v_client_edited_at is null then
        raise exception using errcode = 'P0001', message = 'missing_client_version';
      end if;
      select * into v_entry
      from public.entries
      where id = (v_item->>'id')::uuid and user_id = v_user_id
      for update;
      if found then
        if v_entry.deleted_at is not null then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'entries', 'id', v_entry.id));
        elsif v_entry.description is not distinct from v_item->>'description' and
          v_entry.amount = (v_item->>'amount')::numeric and
          v_entry.category is not distinct from v_item->>'category' and
          v_entry.type is not distinct from v_item->>'type' and
          v_entry.date is not distinct from v_item->>'date' and
          v_entry.paid is not distinct from coalesce((v_item->>'paid')::boolean, false) and
          v_entry.is_debt is not distinct from coalesce((v_item->>'is_debt')::boolean, false) and
          v_entry.debt_info is not distinct from nullif(v_item->'debt_info', 'null'::jsonb) and
          v_entry.active is not distinct from coalesce((v_item->>'active')::boolean, true) and
          v_entry.account_id is not distinct from nullif(v_item->>'account_id', '')::uuid and
          v_entry.payment_method is not distinct from nullif(v_item->>'payment_method', '') then
          null;
        elsif v_client_edited_at <= v_entry.updated_at then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'entries', 'id', v_entry.id));
        else
          update public.entries set
            description = v_item->>'description',
            amount = (v_item->>'amount')::numeric,
            category = v_item->>'category',
            type = v_item->>'type',
            date = v_item->>'date',
            paid = coalesce((v_item->>'paid')::boolean, false),
            is_debt = coalesce((v_item->>'is_debt')::boolean, false),
            debt_info = nullif(v_item->'debt_info', 'null'::jsonb),
            active = coalesce((v_item->>'active')::boolean, true),
            account_id = nullif(v_item->>'account_id', '')::uuid,
            payment_method = nullif(v_item->>'payment_method', ''),
            client_edited_at = v_client_edited_at
          where id = v_entry.id and user_id = v_user_id;
        end if;
      else
        insert into public.entries (
          id, user_id, description, amount, category, type, date, paid, is_debt,
          debt_info, active, account_id, payment_method, client_edited_at, deleted_at
        ) values (
          (v_item->>'id')::uuid, v_user_id, v_item->>'description',
          (v_item->>'amount')::numeric, v_item->>'category', v_item->>'type',
          v_item->>'date', coalesce((v_item->>'paid')::boolean, false),
          coalesce((v_item->>'is_debt')::boolean, false),
          nullif(v_item->'debt_info', 'null'::jsonb),
          coalesce((v_item->>'active')::boolean, true),
          nullif(v_item->>'account_id', '')::uuid,
          nullif(v_item->>'payment_method', ''), v_client_edited_at, null
        );
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(p_templates) as input(value) loop
      v_client_edited_at := nullif(v_item->>'client_edited_at', '')::timestamptz;
      if v_client_edited_at is null then
        raise exception using errcode = 'P0001', message = 'missing_client_version';
      end if;
      select * into v_template
      from public.fixed_templates
      where id = (v_item->>'id')::uuid and user_id = v_user_id
      for update;
      if found then
        if v_template.deleted_at is not null then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'templates', 'id', v_template.id));
        elsif v_template.description is not distinct from v_item->>'description' and
          v_template.amount = (v_item->>'amount')::numeric and
          v_template.category is not distinct from v_item->>'category' and
          v_template.type is not distinct from coalesce(v_item->>'type', 'fixed') and
          v_template.is_debt is not distinct from coalesce((v_item->>'is_debt')::boolean, false) and
          v_template.active is not distinct from coalesce((v_item->>'active')::boolean, true) and
          v_template.start_month is not distinct from v_item->>'start_month' and
          v_template.end_month is not distinct from nullif(v_item->>'end_month', '') and
          v_template.day is not distinct from coalesce(v_item->>'day', '01') and
          v_template.paid_months is not distinct from coalesce(v_item->'paid_months', '{}'::jsonb) and
          v_template.account_id is not distinct from nullif(v_item->>'account_id', '')::uuid then
          null;
        elsif v_client_edited_at <= v_template.updated_at then
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('kind', 'templates', 'id', v_template.id));
        else
          update public.fixed_templates set
            description = v_item->>'description',
            amount = (v_item->>'amount')::numeric,
            category = v_item->>'category',
            type = coalesce(v_item->>'type', 'fixed'),
            is_debt = coalesce((v_item->>'is_debt')::boolean, false),
            active = coalesce((v_item->>'active')::boolean, true),
            start_month = v_item->>'start_month',
            end_month = nullif(v_item->>'end_month', ''),
            day = coalesce(v_item->>'day', '01'),
            paid_months = coalesce(v_item->'paid_months', '{}'::jsonb),
            account_id = nullif(v_item->>'account_id', '')::uuid,
            client_edited_at = v_client_edited_at
          where id = v_template.id and user_id = v_user_id;
          v_touched := v_touched || (v_item->>'id')::uuid;
        end if;
      else
        insert into public.fixed_templates (
          id, user_id, description, amount, category, type, is_debt, active,
          start_month, end_month, day, paid_months, account_id, client_edited_at
        ) values (
          (v_item->>'id')::uuid, v_user_id, v_item->>'description',
          (v_item->>'amount')::numeric, v_item->>'category', coalesce(v_item->>'type', 'fixed'),
          coalesce((v_item->>'is_debt')::boolean, false),
          coalesce((v_item->>'active')::boolean, true), v_item->>'start_month',
          nullif(v_item->>'end_month', ''), coalesce(v_item->>'day', '01'),
          coalesce(v_item->'paid_months', '{}'::jsonb),
          nullif(v_item->>'account_id', '')::uuid, v_client_edited_at
        );
        v_touched := v_touched || (v_item->>'id')::uuid;
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(p_payments) as input(value) loop
      v_month := v_item->>'ym';
      v_client_edited_at := nullif(v_item->>'client_edited_at', '')::timestamptz;
      if v_month !~ '^\d{4}-\d{2}$' or v_client_edited_at is null then
        raise exception using errcode = 'P0001', message = 'invalid_payment_version';
      end if;
      select * into v_template
      from public.fixed_templates
      where id = (v_item->>'id')::uuid and user_id = v_user_id
      for update;
      if not found or v_template.deleted_at is not null then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'kind', 'payments', 'id', v_item->>'id', 'ym', v_month
        ));
      elsif v_template.paid_months->>v_month = 'true' then
        null;
      elsif v_template.id = any(v_touched) then
        update public.fixed_templates set
          paid_months = coalesce(paid_months, '{}'::jsonb) || jsonb_build_object(v_month, true),
          client_edited_at = pg_catalog.clock_timestamp()
        where id = v_template.id and user_id = v_user_id;
      elsif v_client_edited_at <= v_template.updated_at then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'kind', 'payments', 'id', v_template.id, 'ym', v_month
        ));
      else
        update public.fixed_templates set
          paid_months = coalesce(paid_months, '{}'::jsonb) || jsonb_build_object(v_month, true),
          client_edited_at = v_client_edited_at
        where id = v_template.id and user_id = v_user_id;
        v_touched := v_touched || v_template.id;
      end if;
    end loop;

    if jsonb_array_length(v_conflicts) > 0 then
      raise exception using errcode = 'P0001', message = 'sync_conflict';
    end if;

    select coalesce(jsonb_object_agg(id::text, updated_at), '{}'::jsonb) into v_entry_versions
    from public.entries
    where user_id = v_user_id and id in (
      select (value->>'id')::uuid from jsonb_array_elements(p_entries) as input(value)
    );
    select coalesce(jsonb_object_agg(id::text, updated_at), '{}'::jsonb) into v_template_versions
    from public.fixed_templates
    where user_id = v_user_id and id in (
      select (value->>'id')::uuid from jsonb_array_elements(p_templates || p_payments) as input(value)
    );
    return jsonb_build_object('success', true, 'conflicts', '[]'::jsonb, 'versions',
      jsonb_build_object('entries', v_entry_versions, 'templates', v_template_versions));
  exception
    when sqlstate 'P0001' then
      return jsonb_build_object('success', false, 'error', sqlerrm, 'conflicts', v_conflicts);
    when others then
      return jsonb_build_object('success', false, 'error', sqlerrm, 'conflicts', v_conflicts);
  end;
end;
$$;

revoke execute on function public.import_financial_batch(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_financial_batch(jsonb, jsonb, jsonb) to authenticated;
