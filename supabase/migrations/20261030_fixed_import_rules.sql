-- Regras pessoais de importação para classificar descrições recorrentes como fixas.
create table if not exists public.fixed_import_rules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint fixed_import_rules_array_chk check (jsonb_typeof(rules) = 'array')
);

alter table public.fixed_import_rules enable row level security;
drop policy if exists fixed_import_rules_own on public.fixed_import_rules;
create policy fixed_import_rules_own on public.fixed_import_rules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.fixed_import_rules from anon;
revoke truncate, references, trigger on public.fixed_import_rules from authenticated;
grant select, insert, update, delete on public.fixed_import_rules to authenticated;

drop trigger if exists fixed_import_rules_set_updated_at on public.fixed_import_rules;
create trigger fixed_import_rules_set_updated_at before update on public.fixed_import_rules
  for each row execute function public.set_updated_at();
