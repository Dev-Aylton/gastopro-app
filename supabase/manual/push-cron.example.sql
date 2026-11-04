-- EXEMPLO: executar manualmente no SQL Editor; não é migration.
-- Cadastre gastopro_project_url e gastopro_cron_secret no Vault.
-- O handler valida o valor do Vault no cabeçalho x-cron-secret.
-- Não coloque URL, chave ou segredo real neste arquivo.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_secret text;
begin
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = 'gastopro_cron_secret';

  if v_secret is null or length(v_secret) <> 64 or v_secret ~ '[^A-Za-z0-9_-]' then
    raise exception 'gastopro_cron_secret deve ter 64 caracteres seguros';
  end if;
end;
$$;

select cron.schedule(
  'gastopro-send-due-push',
  '0 12 * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'gastopro_project_url'
      ) || '/functions/v1/send-due-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'gastopro_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
