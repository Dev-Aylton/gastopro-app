-- Adiciona as tabelas sincronizadas a Realtime sem duplicar membros existentes.
do $$
declare
  table_name text;
begin
  if not exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach table_name in array array[
    'entries',
    'fixed_templates',
    'profiles',
    'goals',
    'accounts',
    'credit_cards',
    'credit_card_purchases',
    'fixed_import_rules'
  ] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute pg_catalog.format(
        'alter publication supabase_realtime add table public.%I', table_name
      );
    end if;
  end loop;
end;
$$;