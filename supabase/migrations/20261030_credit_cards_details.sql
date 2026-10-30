alter table public.credit_cards
  add column if not exists brand text not null default 'Outra'
    check (brand in ('Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra')),
  add column if not exists issuer_bank text not null default 'Outro'
    check (issuer_bank in ('Nubank', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Inter', 'C6', 'BTG', 'Mercado Pago', 'PicPay', 'Outro')),
  add column if not exists last_four text,
  add column if not exists custom_color text;

alter table public.credit_cards
  drop constraint if exists credit_cards_last_four_check,
  drop constraint if exists credit_cards_custom_color_check;

alter table public.credit_cards
  add constraint credit_cards_last_four_check
    check (last_four is null or last_four ~ '^[0-9]{4}$'),
  add constraint credit_cards_custom_color_check
    check (custom_color is null or custom_color ~ '^#[0-9A-Fa-f]{6}$');
