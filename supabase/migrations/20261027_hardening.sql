alter table public.entries
  drop constraint if exists entries_date_chk,
  add constraint entries_date_chk check (date ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$') not valid,
  add constraint entries_len_chk check (
    char_length(description) between 1 and 300 and char_length(category) between 1 and 100
    and (debt_info is null or pg_column_size(debt_info) <= 4096)) not valid;

alter table public.fixed_templates
  drop constraint if exists templates_start_chk,
  drop constraint if exists templates_end_chk,
  drop constraint if exists templates_day_chk,
  add constraint templates_start_chk check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$') not valid,
  add constraint templates_end_chk check (end_month is null or end_month ~ '^\d{4}-(0[1-9]|1[0-2])$') not valid,
  add constraint templates_day_chk check (day is null or day ~ '^(0[1-9]|[12]\d|3[01])$') not valid,
  add constraint templates_len_chk check (
    char_length(description) between 1 and 300 and char_length(category) between 1 and 100
    and pg_column_size(paid_months) <= 8192) not valid;

-- Depois de conferir os dados existentes, validar uma a uma:
-- alter table public.entries validate constraint entries_date_chk;  (idem para as demais)

alter table public.profiles
  add constraint profiles_avatar_len_chk
  check (avatar is null or char_length(avatar) <= 400000) not valid;
