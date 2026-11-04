-- EXEMPLO: executar manualmente no SQL Editor; não é migration.
-- Nunca adicionar valores reais de URL ou CRON_SECRET ao repositório.
-- Cadastre gastopro_project_url e gastopro_cron_secret no Vault.
-- Armazene a chave anon pública como gastopro_anon_key para autenticar
-- no gateway; o handler também exige CRON_SECRET no cabeçalho dedicado.
-- Confirme que pg_cron/pg_net estão disponíveis e o fuso do cron no projeto.
create extension if not exists pg_cron;
create extension if not exists pg_net;

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
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'gastopro_anon_key'
        ),
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'gastopro_anon_key'
        ),
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'gastopro_cron_secret'
        )
      ),
      body := '{}'::jsonb
    );
  $job$
);
