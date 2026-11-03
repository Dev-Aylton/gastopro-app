-- Adiciona o marcador de arquivamento administrativo sem alterar a policy existente.
alter table public.feedback_messages
  add column if not exists admin_archived_at timestamptz;

revoke all on public.feedback_messages from public, anon;
revoke update (admin_archived_at) on public.feedback_messages from public, anon, authenticated;
grant update (admin_archived_at) on public.feedback_messages to authenticated;
