begin;
create table private.telegram_config (
  singleton boolean primary key default true check (singleton),
  worker_secret text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
  codigo uuid not null default gen_random_uuid(),
  chat_id text,
  update_offset bigint not null default 0,
  ultima_revision timestamptz,
  ultimo_error text
);
alter table private.telegram_config enable row level security;
revoke all on private.telegram_config from public,anon,authenticated;
insert into private.telegram_config(singleton) values(true);
alter table public.alertas_stock add column canal text check (canal in ('whatsapp','telegram'));

create function public.estado_telegram() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  return (select jsonb_build_object('codigo',codigo,'vinculado',chat_id is not null,
    'ultima_revision',ultima_revision,'ultimo_error',ultimo_error) from private.telegram_config);
end; $$;
revoke all on function public.estado_telegram() from public,anon;
grant execute on function public.estado_telegram() to authenticated;

create function public.validar_worker_telegram(p_secreto text) returns boolean
language sql security definer set search_path='' as $$
  select coalesce((select worker_secret=p_secreto from private.telegram_config),false);
$$;
create function public.config_worker_telegram() returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('codigo',codigo,'chat_id',chat_id,'update_offset',update_offset) from private.telegram_config;
$$;
create function public.vincular_telegram(p_codigo uuid,p_chat_id text) returns void
language sql security definer set search_path='' as $$
  update private.telegram_config set chat_id=p_chat_id where codigo=p_codigo and chat_id is null and p_chat_id ~ '^[0-9]+$';
$$;
create function public.revision_telegram(p_error text,p_offset bigint default 0) returns void
language sql security definer set search_path='' as $$
  update private.telegram_config set ultima_revision=now(),ultimo_error=left(p_error,80),update_offset=greatest(update_offset,p_offset) where singleton=true;
$$;
revoke all on function public.validar_worker_telegram(text),public.config_worker_telegram(),public.vincular_telegram(uuid,text),public.revision_telegram(text,bigint) from public,anon,authenticated;
grant execute on function public.validar_worker_telegram(text),public.config_worker_telegram(),public.vincular_telegram(uuid,text),public.revision_telegram(text,bigint) to service_role;
commit;
