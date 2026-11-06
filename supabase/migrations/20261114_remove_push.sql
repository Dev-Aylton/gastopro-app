-- As tabelas caem antes porque uma policy depende da função.
drop table if exists public.push_notification_log;
drop table if exists public.push_due_dates;
drop table if exists public.push_subscriptions;
drop function if exists public.push_replace_due_dates(jsonb);
drop function if exists public.push_subscription_count_for_current_user();
