-- Data de referência para o saldo inicial; contas existentes permanecem nulas.
alter table public.accounts
  add column if not exists balance_date date;
