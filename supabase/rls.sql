-- Row Level Security policies for per-user financial data.

alter table public.entries enable row level security;
alter table public.fixed_templates enable row level security;

create policy "Users manage their own entries"
  on public.entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own fixed templates"
  on public.fixed_templates
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
