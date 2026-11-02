-- Registra quando um administrador leu uma mensagem sem ampliar as colunas editáveis.
alter table public.feedback_messages
  add column if not exists admin_read_at timestamptz;

revoke all on public.feedback_messages from public, anon;
revoke update (admin_read_at) on public.feedback_messages from public, anon, authenticated;
grant update (admin_read_at) on public.feedback_messages to authenticated;

drop policy if exists feedback_messages_update_admin on public.feedback_messages;
create policy feedback_messages_update_admin on public.feedback_messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
