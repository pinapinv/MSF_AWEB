begin;
create table public.carritos_telegram (
 id uuid primary key, solicitud jsonb not null, cliente_chat_id text,
 estado text not null default 'borrador' check(estado in ('borrador','pendiente','aceptada','denegada','sin_stock','precio_cambiado','vencida')),
 total numeric(16,2) not null default 0, resumen text not null default '', creada_en timestamptz not null default now(),decidida_en timestamptz
);
create table public.carrito_lineas (
 id uuid primary key default gen_random_uuid(),carrito_id uuid not null references public.carritos_telegram(id),
 producto_id uuid not null references public.productos(id),nombre text not null,cantidad numeric(15,6) not null check(cantidad>0 and mod(cantidad,0.5)=0),
 precio numeric(12,2) not null,monto numeric(16,2) not null, unique(carrito_id,producto_id)
);
alter table public.carritos_telegram enable row level security;
alter table public.carrito_lineas enable row level security;
revoke all on public.carritos_telegram,public.carrito_lineas from public,anon,authenticated;
grant select on public.carritos_telegram,public.carrito_lineas to authenticated;
create policy "Carritos administrativos" on public.carritos_telegram for select to authenticated using ((select public.es_administrador()));
create policy "Líneas administrativas" on public.carrito_lineas for select to authenticated using ((select public.es_administrador()));
create index carritos_fecha on public.carritos_telegram(creada_en);
create function public.crear_carrito(p_solicitud uuid,p_lineas jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previo public.carritos_telegram%rowtype; linea jsonb;p public.productos%rowtype;q numeric; v_resumen text; v_total numeric;
begin
 if p_solicitud is null or jsonb_typeof(p_lineas)<>'array' or jsonb_array_length(p_lineas) not between 1 and 20 then raise exception 'Carrito inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_solicitud::text,0));
 select * into previo from public.carritos_telegram where id=p_solicitud;
 if found then
   if previo.solicitud<>p_lineas then raise exception 'La solicitud ya se usó con otro carrito'; end if;
   return jsonb_build_object('id',previo.id,'total',previo.total,'resumen',previo.resumen);
 end if;
 -- Límite global de borradores para esta instalación; no se reserva stock.
 perform pg_advisory_xact_lock(hashtextextended('msf_crear_carrito',0));
 if (select count(*) from public.carritos_telegram where creada_en>now()-interval '1 hour')>=1000 then raise exception 'Demasiadas solicitudes. Intenta más tarde'; end if;
 insert into public.carritos_telegram(id,solicitud) values(p_solicitud,p_lineas);
 for linea in select value from jsonb_array_elements(p_lineas) loop
   q:=(linea->>'cantidad')::numeric;
   if q is null or q::text in ('NaN','Infinity','-Infinity') or q<=0 or q>9999999 or mod(q,0.5)<>0 then raise exception 'Usa toneladas enteras o medias'; end if;
   select * into p from public.productos where id=(linea->>'producto_id')::uuid;
   if not found or p.cotizacion_pendiente or p.precio is null or p.stock<q then raise exception 'Producto no disponible o cantidad superior al stock'; end if;
   insert into public.carrito_lineas(carrito_id,producto_id,nombre,cantidad,precio,monto) values(p_solicitud,p.id,p.nombre,q,p.precio,round(q*p.precio,2));
 end loop;
 select string_agg(nombre||' · '||cantidad::double precision||' t · MXN '||monto,E'\n' order by nombre),sum(monto) into v_resumen,v_total from public.carrito_lineas where carrito_id=p_solicitud;
 update public.carritos_telegram set total=v_total,resumen=v_resumen where id=p_solicitud;
 return jsonb_build_object('id',p_solicitud,'total',v_total,'resumen',v_resumen);
end; $$;
revoke all on function public.crear_carrito(uuid,jsonb) from public;
grant execute on function public.crear_carrito(uuid,jsonb) to anon,authenticated;

create function private.telegram_carrito_evento(p_chat text,p_texto text,p_callback text) returns void
language plpgsql security invoker set search_path='' as $$
declare c private.telegram_config%rowtype; carrito public.carritos_telegram%rowtype; id_carrito uuid;
 linea record; p public.productos%rowtype; resultado text; anterior_uid text;
begin
 select * into c from private.telegram_config where singleton=true;
 if p_callback<>'' then
   if p_chat<>c.chat_id or not exists(select 1 from public.administradores where usuario_id=c.responsable_id) then
     perform private.telegram_responder(p_chat,'Solo el administrador puede aceptar o denegar el carrito.'); return;
   end if;
   id_carrito:=substring(p_callback from 4)::uuid;
   -- Bloquear todos los productos en orden antes del encabezado del carrito.
   perform p2.id from public.productos p2 join public.carrito_lineas l on l.producto_id=p2.id where l.carrito_id=id_carrito order by p2.id for update of p2;
   select * into carrito from public.carritos_telegram where id=id_carrito for update;
   if not found then return; end if;
   if carrito.estado<>'pendiente' then perform private.telegram_responder(p_chat,'El carrito ya está procesado: '||carrito.estado||'. Sin nuevo descuento.');return;end if;
   resultado:='aceptada';
   if left(p_callback,2)='cd' then resultado:='denegada';
   elsif carrito.creada_en<now()-interval '24 hours' then resultado:='vencida';
   else
     for linea in select * from public.carrito_lineas where carrito_id=id_carrito order by producto_id loop
       select * into p from public.productos where id=linea.producto_id;
       if p.cotizacion_pendiente or p.precio is distinct from linea.precio then resultado:='precio_cambiado';exit;end if;
       if p.stock<linea.cantidad then resultado:='sin_stock';exit;end if;
     end loop;
   end if;
   if resultado='aceptada' then
     anterior_uid:=current_setting('request.jwt.claim.sub',true);
     perform set_config('request.jwt.claim.sub',c.responsable_id::text,true);
     for linea in select * from public.carrito_lineas where carrito_id=id_carrito order by producto_id loop
       perform public.registrar_venta(linea.producto_id,linea.cantidad,'Carrito Telegram '||id_carrito,linea.id);
     end loop;
     perform set_config('request.jwt.claim.sub',coalesce(anterior_uid,''),true);
   end if;
   update public.carritos_telegram set estado=resultado,decidida_en=now() where id=id_carrito;
   perform private.telegram_responder(p_chat,'Carrito '||id_carrito||E'\nEstado: '||resultado||case when resultado='aceptada' then E'\nVentas registradas y stock descontado en todos los productos.' else E'\nNo se descontó ningún producto.' end);
   perform private.telegram_responder(carrito.cliente_chat_id,'Mariscos de San Felipe'||E'\nCarrito '||id_carrito||E'\n'||carrito.resumen||E'\nTotal MXN '||carrito.total||E'\nEstado: '||resultado||case when resultado='aceptada' then E'\nCoordina pago y entrega con el negocio. No se verifican pagos automáticos.' else E'\nSin descuento de stock. Puedes preparar un nuevo carrito.' end);
 else
   id_carrito:=right(p_texto,36)::uuid;
   select * into carrito from public.carritos_telegram where id=id_carrito for update;
   if not found then perform private.telegram_responder(p_chat,'Carrito no encontrado. Prepara otro desde la página.');return;end if;
   if carrito.creada_en<now()-interval '24 hours' then perform private.telegram_responder(p_chat,'Este carrito venció. Prepara uno nuevo desde la página.');return;end if;
   if carrito.estado<>'borrador' then perform private.telegram_responder(p_chat,'Este carrito ya fue enviado. Espera la decisión del negocio o prepara otro desde la página.');return;end if;
   update public.carritos_telegram set cliente_chat_id=p_chat,estado='pendiente' where id=id_carrito;
   perform private.telegram_responder(p_chat,'Carrito '||id_carrito||E'\n'||carrito.resumen||E'\nTotal MXN '||carrito.total||E'\nEnviado al negocio. Sin reserva ni descuento de stock hasta que se acepte.');
   perform private.telegram_responder(c.chat_id,'Nuevo carrito '||id_carrito||E'\n'||carrito.resumen||E'\nTotal MXN '||carrito.total||E'\nAceptar registra todas las ventas y descuenta stock. No verifica el pago.',jsonb_build_object('inline_keyboard',jsonb_build_array(jsonb_build_array(jsonb_build_object('text','Aceptar carrito','callback_data','ca:'||id_carrito),jsonb_build_object('text','Denegar carrito','callback_data','cd:'||id_carrito)))));
 end if;
end; $$;
revoke all on function private.telegram_carrito_evento(text,text,text) from public,anon,authenticated;

create or replace function public.telegram_evento(p_update bigint,p_chat text,p_actor text,p_texto text default '',p_callback text default '') returns void
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
  if p_texto ~ '^/start(?:@\w+)? carrito_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_callback ~ '^c[ad]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private.telegram_carrito_evento(p_chat,p_texto,p_callback); return;
  end if;
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
    perform private.telegram_responder(p_chat,'Solicitud '||pedido.id||E'\n'||pedido.nombre_producto||' · '||pedido.cantidad::double precision||E' toneladas\nEstado: '||resultado||case when resultado='aceptada' then E'\nVenta registrada y stock descontado.' else E'\nSin descuento de stock.' end);
    perform private.telegram_responder(pedido.cliente_chat_id,'Mariscos de San Felipe'||E'\nSolicitud '||pedido.id||E'\n'||pedido.nombre_producto||' · '||pedido.cantidad::double precision||E' toneladas\n'||case resultado when 'aceptada' then 'Tu solicitud fue aceptada. Esto no confirma un pago automático; coordina pago y entrega con el negocio.' when 'denegada' then 'Tu solicitud fue denegada. Puedes consultar otra opción en el catálogo.' when 'sin_stock' then 'No hay stock suficiente al confirmar. Puedes enviar una nueva solicitud por otra cantidad.' when 'precio_cambiado' then 'El precio o disponibilidad requiere una nueva cotización. Vuelve al catálogo y envía otra solicitud.' else 'La solicitud venció. Envía una nueva desde el catálogo.' end);
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
    perform private.telegram_responder(p_chat,'Producto: '||p.nombre||E'\nPrecio: MXN '||p.precio||E' por tonelada\nDisponible: '||p.stock::double precision||E' toneladas\n¿Cuántas toneladas quieres? Escribe solo la cantidad, en toneladas enteras o medias: 0.5, 1, 1.5, 2... La solicitud no reserva stock. /cancelar para cambiar de producto.'); return;
  end if;
  select producto_id into elegido from private.telegram_sesiones where chat_id=p_chat and actualizada_en>now()-interval '30 minutes';
  if elegido is null then
    perform private.telegram_responder(p_chat,'Para solicitar un producto, abre https://msf-aweb.vercel.app y pulsa Solicitar por Telegram. Después indica la cantidad en toneladas. /cancelar cancela una selección.'); return;
  end if;
  if p_texto !~ '^[0-9]{1,7}([.,](0|5))?$' then
    perform private.telegram_responder(p_chat,'Solo se permiten toneladas enteras o medias toneladas: 0.5, 1, 1.5, 2... Por ejemplo, 1.5 es una tonelada y media.'); return;
  end if;
  cantidad:=replace(p_texto,',','.')::numeric;
  if mod(cantidad,0.5)<>0 then
    perform private.telegram_responder(p_chat,'Solo se permiten toneladas enteras o medias toneladas.'); return;
  end if;
  select * into p from public.productos where id=elegido for update;
  if cantidad<=0 or cantidad>p.stock or p.cotizacion_pendiente or p.precio is null or round(cantidad*p.precio,2)<=0 then
    perform private.telegram_responder(p_chat,'Cantidad no disponible o producto pendiente de cotización. Disponible: '||p.stock::double precision||' toneladas. Envía otra cantidad o /cancelar.'); return;
  end if;
  if exists(select 1 from public.pedidos_telegram where cliente_chat_id=p_chat and estado='pendiente' and creada_en>now()-interval '24 hours') then
    perform private.telegram_responder(p_chat,'Ya tienes una solicitud pendiente. Espera la respuesta del negocio antes de enviar otra.'); return;
  end if;
  insert into public.pedidos_telegram(solicitud_update,cliente_chat_id,producto_id,nombre_producto,cantidad,precio_unitario,monto)
  values(p_update,p_chat,p.id,p.nombre,cantidad,p.precio,round(cantidad*p.precio,2)) returning id into pedido_id;
  delete from private.telegram_sesiones where chat_id=p_chat;
  perform private.telegram_responder(p_chat,'Solicitud '||pedido_id||E'\n'||p.nombre||' · '||cantidad::double precision||E' toneladas\nTotal: MXN '||round(cantidad*p.precio,2)||E'\nEnviada al negocio. Todavía no se descuenta ni reserva stock. Espera su aceptación o rechazo.');
  perform private.telegram_responder(c.chat_id,'Nueva solicitud '||pedido_id||E'\nProducto: '||p.nombre||E'\nCantidad: '||cantidad::double precision||E' toneladas\nPrecio por tonelada: MXN '||p.precio||E'\nTotal: MXN '||round(cantidad*p.precio,2)||E'\nAceptar registra la venta y descuenta stock. No verifica el pago. Denegar no cambia existencias.',jsonb_build_object('inline_keyboard',jsonb_build_array(jsonb_build_array(jsonb_build_object('text','Aceptar y descontar stock','callback_data','a:'||pedido_id),jsonb_build_object('text','Denegar','callback_data','d:'||pedido_id)))));
end; $$;
commit;
