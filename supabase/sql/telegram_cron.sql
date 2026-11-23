-- Ejecutar después de desplegar telegram-alertas.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create function private.msf_pedir_alertas_telegram() returns bigint
language sql security definer set search_path='' as $$
  select net.http_post(
    url := 'https://oowovebnejpulbgyyeiv.supabase.co/functions/v1/telegram-alertas',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',worker_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) from private.telegram_config;
$$;
revoke all on function private.msf_pedir_alertas_telegram() from public,anon,authenticated;
select cron.schedule('msf-telegram-stock','*/2 * * * *','select private.msf_pedir_alertas_telegram();');
