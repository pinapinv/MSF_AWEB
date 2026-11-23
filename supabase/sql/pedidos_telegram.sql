-- Aplicar después de mayoreo_toneladas.sql. Sin tokens ni IDs privados en el archivo.
begin;
alter table private.telegram_config add column webhook_activo boolean not null default false;
alter table private.telegram_config add column responsable_id uuid references auth.users(id);
do $$ begin
  if (select count(*) from public.administradores) <> 1 then
    raise exception 'Configurar explícitamente el administrador responsable antes de continuar';
  end if;
end $$;
update private.telegram_config set responsable_id=(select usuario_id from public.administradores) where singleton=true;

create table public.pedidos_telegram (
  id uuid primary key default gen_random_uuid(),
  solicitud_update bigint not null unique,
  cliente_chat_id text not null,
  producto_id uuid not null references public.productos(id),
  nombre_producto text not null,
  cantidad numeric(15,6) not null check(cantidad>0),
  precio_unitario numeric(12,2) not null check(precio_unitario>0),
  monto numeric(16,2) not null check(monto>0),
  estado text not null default 'pendiente' check(estado in ('pendiente','aceptada','denegada','sin_stock','precio_cambiado','vencida')),
  venta_id uuid references public.ventas(id),
  creada_en timestamptz not null default now(),
  decidida_en timestamptz
);
create index pedidos_telegram_cliente on public.pedidos_telegram(cliente_chat_id,creada_en desc);
alter table public.pedidos_telegram enable row level security;
revoke all on public.pedidos_telegram from public,anon,authenticated;
grant select on public.pedidos_telegram to authenticated;
create policy "Pedidos solo administradores" on public.pedidos_telegram for select to authenticated using ((select public.es_administrador()));

create table private.telegram_sesiones(chat_id text primary key,producto_id uuid not null references public.productos(id),actualizada_en timestamptz not null default now());
create table private.telegram_eventos(update_id bigint primary key,creada_en timestamptz not null default now());
create table private.telegram_salidas (
  id bigint generated always as identity primary key,
  payload jsonb not null,
  estado text not null default 'pendiente' check(estado in ('pendiente','enviando','enviada','incierta','rechazada')),
  mensaje_id text,
  creada_en timestamptz not null default now()
);
create index telegram_salidas_pendientes on private.telegram_salidas(id) where estado='pendiente';
alter table private.telegram_sesiones enable row level security;
alter table private.telegram_eventos enable row level security;
alter table private.telegram_salidas enable row level security;
revoke all on private.telegram_sesiones,private.telegram_eventos,private.telegram_salidas from public,anon,authenticated;

create function private.telegram_responder(p_chat text,p_texto text,p_botones jsonb default null) returns void
language sql security invoker set search_path='' as $$
  insert into private.telegram_salidas(payload) values(jsonb_strip_nulls(jsonb_build_object('chat_id',p_chat,'text',p_texto,'reply_markup',p_botones)));
$$;
revoke all on function private.telegram_responder(text,text,jsonb) from public,anon,authenticated;

create function public.telegram_evento(p_update bigint,p_chat text,p_actor text,p_texto text default '',p_callback text default '') returns void
language plpgsql security definer set search_path='' as $$
declare c private.telegram_config%rowtype; p public.productos%rowtype; pedido public.pedidos_telegram%rowtype;
  elegido uuid; cantidad numeric; pedido_id uuid; venta uuid; resultado text; anterior_uid text;
begin
  if p_update is null or p_update<0 or p_chat !~ '^[0-9]{1,20}$' or p_actor<>p_chat then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chat,0));
  insert into private.telegram_eventos(update_id) values(p_update) on conflict do nothing;
  if not found then return; end if;
  select * into c from private.telegram_config where singleton=true;
  if c.chat_id is null then return; end if;
  if p_callback<>'' then
    if p_chat<>c.chat_id or not exists(select 1 from public.administradores where usuario_id=c.responsable_id) then
      perform private.telegram_responder(p_chat,'Solo la persona administradora puede decidir las solicitudes.'); return;
    end if;
    if p_callback !~ '^[ad]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
    pedido_id:=substring(p_callback from 3)::uuid;
    -- Mismo orden de bloqueos que registrar_venta: producto antes del pedido.
    select x.* into p from public.productos x join public.pedidos_telegram o on o.producto_id=x.id where o.id=pedido_id for update of x;
    if not found then return; end if;
    select * into pedido from public.pedidos_telegram where id=pedido_id for update;
    if pedido.estado<>'pendiente' then
      perform private.telegram_responder(p_chat,'La solicitud '||pedido.id||' ya fue procesada: '||pedido.estado||'. No se descuenta stock otra vez.'); return;
    end if;
    if left(p_callback,1)='d' then resultado:='denegada';
    elsif pedido.creada_en<now()-interval '24 hours' then resultado:='vencida';
    elsif p.cotizacion_pendiente or p.precio is distinct from pedido.precio_unitario then resultado:='precio_cambiado';
    elsif p.stock<pedido.cantidad then resultado:='sin_stock';
    else
      anterior_uid:=current_setting('request.jwt.claim.sub',true);
      perform set_config('request.jwt.claim.sub',c.responsable_id::text,true);
      venta:=public.registrar_venta(p.id,pedido.cantidad,'Pedido Telegram '||pedido.id,pedido.id);
      perform set_config('request.jwt.claim.sub',coalesce(anterior_uid,''),true);
      resultado:='aceptada';
    end if;
    update public.pedidos_telegram set estado=resultado,venta_id=venta,decidida_en=now() where id=pedido.id;
    perform private.telegram_responder(p_chat,'Solicitud '||pedido.id||E'\n'||pedido.nombre_producto||' · '||pedido.cantidad||E' toneladas\nEstado: '||resultado||case when resultado='aceptada' then E'\nVenta registrada y stock descontado.' else E'\nSin descuento de stock.' end);
    perform private.telegram_responder(pedido.cliente_chat_id,'Mariscos de San Felipe'||E'\nSolicitud '||pedido.id||E'\n'||pedido.nombre_producto||' · '||pedido.cantidad||E' toneladas\n'||case resultado when 'aceptada' then 'Tu solicitud fue aceptada. Esto no confirma un pago automático; coordina pago y entrega con el negocio.' when 'denegada' then 'Tu solicitud fue denegada. Puedes consultar otra opción en el catálogo.' when 'sin_stock' then 'No hay stock suficiente al confirmar. Puedes enviar una nueva solicitud por otra cantidad.' when 'precio_cambiado' then 'El precio o disponibilidad requiere una nueva cotización. Vuelve al catálogo y envía otra solicitud.' else 'La solicitud venció. Envía una nueva desde el catálogo.' end);
    return;
  end if;
  if p_texto='/cancelar' then
    delete from private.telegram_sesiones where chat_id=p_chat;
    perform private.telegram_responder(p_chat,'Selección cancelada. Las solicitudes ya enviadas siguen pendientes de decisión. Elige otro producto en https://msf-aweb.vercel.app'); return;
  end if;
  if p_texto ~ '^/start(?:@\w+)? producto_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    elegido:=right(p_texto,36)::uuid;
    select * into p from public.productos where id=elegido;
    if not found or p.cotizacion_pendiente or p.precio is null or p.stock<=0 then
      perform private.telegram_responder(p_chat,'Este producto no está disponible para solicitar una venta. Consulta el catálogo o contacta al negocio para cotizar.'); return;
    end if;
    insert into private.telegram_sesiones(chat_id,producto_id) values(p_chat,p.id)
    on conflict(chat_id) do update set producto_id=excluded.producto_id,actualizada_en=now();
    perform private.telegram_responder(p_chat,'Producto: '||p.nombre||E'\nPrecio: MXN '||p.precio||E' por tonelada\nDisponible: '||p.stock||E' toneladas\n¿Cuántas toneladas quieres? Escribe solo la cantidad, por ejemplo 0.001 para 1 kg. Hasta seis decimales. La solicitud no reserva stock. /cancelar para cambiar de producto.'); return;
  end if;
  select producto_id into elegido from private.telegram_sesiones where chat_id=p_chat and actualizada_en>now()-interval '30 minutes';
  if elegido is null then
    perform private.telegram_responder(p_chat,'Para solicitar un producto, abre https://msf-aweb.vercel.app y pulsa Solicitar por Telegram. Después indica la cantidad en toneladas. /cancelar cancela una selección.'); return;
  end if;
  if p_texto !~ '^[0-9]{1,7}([.,][0-9]{1,6})?$' then
    perform private.telegram_responder(p_chat,'Escribe solo una cantidad positiva de toneladas, con hasta seis decimales. Ejemplo: 0.001 equivale a 1 kg.'); return;
  end if;
  cantidad:=replace(p_texto,',','.')::numeric;
  select * into p from public.productos where id=elegido for update;
  if cantidad<=0 or cantidad>p.stock or p.cotizacion_pendiente or p.precio is null or round(cantidad*p.precio,2)<=0 then
    perform private.telegram_responder(p_chat,'Cantidad no disponible o producto pendiente de cotización. Disponible: '||p.stock||' toneladas. Envía otra cantidad o /cancelar.'); return;
  end if;
  if exists(select 1 from public.pedidos_telegram where cliente_chat_id=p_chat and estado='pendiente' and creada_en>now()-interval '24 hours') then
    perform private.telegram_responder(p_chat,'Ya tienes una solicitud pendiente. Espera la respuesta del negocio antes de enviar otra.'); return;
  end if;
  insert into public.pedidos_telegram(solicitud_update,cliente_chat_id,producto_id,nombre_producto,cantidad,precio_unitario,monto)
  values(p_update,p_chat,p.id,p.nombre,cantidad,p.precio,round(cantidad*p.precio,2)) returning id into pedido_id;
  delete from private.telegram_sesiones where chat_id=p_chat;
  perform private.telegram_responder(p_chat,'Solicitud '||pedido_id||E'\n'||p.nombre||' · '||cantidad||E' toneladas\nTotal: MXN '||round(cantidad*p.precio,2)||E'\nEnviada al negocio. Todavía no se descuenta ni reserva stock. Espera su aceptación o rechazo.');
  perform private.telegram_responder(c.chat_id,'Nueva solicitud '||pedido_id||E'\nProducto: '||p.nombre||E'\nCantidad: '||cantidad||E' toneladas\nPrecio por tonelada: MXN '||p.precio||E'\nTotal: MXN '||round(cantidad*p.precio,2)||E'\nAceptar registra la venta y descuenta stock. No verifica el pago. Denegar no cambia existencias.',jsonb_build_object('inline_keyboard',jsonb_build_array(jsonb_build_array(jsonb_build_object('text','Aceptar y descontar stock','callback_data','a:'||pedido_id),jsonb_build_object('text','Denegar','callback_data','d:'||pedido_id)))));
end; $$;

create function public.telegram_tomar_salida() returns jsonb
language plpgsql security definer set search_path='' as $$
declare salida private.telegram_salidas%rowtype;
begin
  select * into salida from private.telegram_salidas where estado='pendiente' order by id for update skip locked limit 1;
  if not found then return null; end if;
  update private.telegram_salidas set estado='enviando' where id=salida.id;
  return jsonb_build_object('id',salida.id,'payload',salida.payload);
end; $$;
create function public.telegram_finalizar_salida(p_id bigint,p_estado text,p_mensaje text default null) returns void
language sql security definer set search_path='' as $$
  update private.telegram_salidas set estado=p_estado,mensaje_id=p_mensaje where id=p_id and estado='enviando' and p_estado in ('enviada','rechazada','incierta');
$$;
create function public.telegram_marcar_webhook() returns void
language sql security definer set search_path='' as $$
  update private.telegram_config set webhook_activo=true where singleton=true;
$$;
create or replace function public.config_worker_telegram() returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('codigo',codigo,'chat_id',chat_id,'update_offset',update_offset,'webhook_activo',webhook_activo) from private.telegram_config;
$$;
revoke all on function public.telegram_evento(bigint,text,text,text,text),public.telegram_tomar_salida(),public.telegram_finalizar_salida(bigint,text,text),public.telegram_marcar_webhook() from public,anon,authenticated;
grant execute on function public.telegram_evento(bigint,text,text,text,text),public.telegram_tomar_salida(),public.telegram_finalizar_salida(bigint,text,text),public.telegram_marcar_webhook() to service_role;
commit;
