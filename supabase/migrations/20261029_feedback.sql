-- Canal Fale comigo: executar manualmente no SQL Editor do Supabase.
-- Esta migração pode ser executada mais de uma vez.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.feedback_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('duvida', 'sugestao', 'problema')),
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  status text not null default 'new' check (status in ('new', 'answered')),
  reply text check (reply is null or char_length(reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_messages_user_created_idx
  on public.feedback_messages (user_id, created_at);
create index if not exists feedback_messages_status_created_idx
  on public.feedback_messages (status, created_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.app_admins enable row level security;
alter table public.feedback_messages enable row level security;

drop policy if exists app_admins_read_own on public.app_admins;
create policy app_admins_read_own on public.app_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_messages_read_own_or_admin on public.feedback_messages;
create policy feedback_messages_read_own_or_admin on public.feedback_messages
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists feedback_messages_insert_own_new on public.feedback_messages;
create policy feedback_messages_insert_own_new on public.feedback_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'new'
    and reply is null
    and replied_at is null
  );

drop policy if exists feedback_messages_delete_own on public.feedback_messages;
create policy feedback_messages_delete_own on public.feedback_messages
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_messages_update_admin on public.feedback_messages;
create policy feedback_messages_update_admin on public.feedback_messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.app_admins, public.feedback_messages from anon;
revoke all on public.app_admins from authenticated;
grant select on public.app_admins to authenticated;
revoke all on public.feedback_messages from authenticated;
grant select, delete on public.feedback_messages to authenticated;
grant insert (user_id, category, message) on public.feedback_messages to authenticated;
grant update (reply, status, replied_at) on public.feedback_messages to authenticated;
revoke truncate, references, trigger on public.app_admins, public.feedback_messages from authenticated;

drop trigger if exists feedback_messages_set_updated_at on public.feedback_messages;
create trigger feedback_messages_set_updated_at
  before update on public.feedback_messages
  for each row execute function public.set_updated_at();

create or replace function public.enforce_feedback_daily_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*) into recent_count
  from public.feedback_messages
  where user_id = new.user_id
    and created_at >= now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception 'Limite de 5 mensagens nas últimas 24 horas atingido. Tente novamente mais tarde.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_feedback_daily_limit() from public, anon, authenticated;
drop trigger if exists feedback_messages_daily_limit on public.feedback_messages;
create trigger feedback_messages_daily_limit
  before insert on public.feedback_messages
  for each row execute function public.enforce_feedback_daily_limit();
