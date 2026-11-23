-- Aplicar una vez después de pedidos_telegram.sql.
-- Stock de EJEMPLO autorizado; no equivale a un conteo real del negocio.
begin;
lock table public.productos,public.pedidos_telegram in access exclusive mode;
do $$
declare fila record; responsable uuid; diferencia numeric;
begin
  select responsable_id into responsable from private.telegram_config where singleton=true;
  if responsable is null or not exists(select 1 from public.administradores where usuario_id=responsable) then
    raise exception 'Falta un administrador responsable autorizado';
  end if;
  perform set_config('request.jwt.claim.sub',responsable::text,true);
  for fila in select p.id,p.stock,v.stock_objetivo from public.productos p join
    (values ('Filete de pescado',5::numeric),('Camarón mediano',3),('Pulpo',1.5),('Almeja',1),('Pescado entero',4)) v(nombre,stock_objetivo) on p.nombre=v.nombre
  loop
    diferencia:=fila.stock_objetivo-fila.stock;
    if diferencia<>0 then
      perform public.registrar_movimiento(fila.id,case when diferencia>0 then 'entrada' else 'merma' end,abs(diferencia),'Ajuste de stock de ejemplo autorizado: toneladas enteras y medias',gen_random_uuid());
    end if;
  end loop;
end $$;
update public.productos set stock_minimo=1 where stock_minimo<>1;
alter table public.productos alter column stock_minimo set default 1;
alter table public.productos add constraint stock_medias_toneladas check (mod(stock,0.5)=0);
alter table public.productos add constraint minimo_una_tonelada check (stock_minimo=1);
-- Las ventas y movimientos históricos conservan sus cantidades originales.
-- Se vencen solo solicitudes aún pendientes que ya no cumplen la nueva unidad de venta.
do $$ declare pedido record; admin_chat text;
begin
  select chat_id into admin_chat from private.telegram_config where singleton=true;
  for pedido in select id,cliente_chat_id from public.pedidos_telegram where estado='pendiente' and mod(cantidad,0.5)<>0 for update
  loop
    update public.pedidos_telegram set estado='vencida',decidida_en=now() where id=pedido.id;
    perform private.telegram_responder(pedido.cliente_chat_id,'La solicitud '||pedido.id||' venció por el cambio de cantidades de venta. Envía una nueva en toneladas enteras o medias: 0.5, 1, 1.5... No se descontó stock.');
    if admin_chat is not null then perform private.telegram_responder(admin_chat,'La solicitud '||pedido.id||' venció por el cambio a toneladas enteras o medias. Sin descuento de stock.'); end if;
  end loop;
end $$;
create or replace function public.registrar_movimiento(
  p_producto uuid, p_tipo text, p_cantidad numeric, p_nota text, p_solicitud uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  producto public.productos%rowtype;
  anterior public.movimientos%rowtype;
  saldo numeric;
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'merma') then raise exception 'Tipo de movimiento inválido'; end if;
  if p_cantidad is null or p_cantidad::text in ('NaN', 'Infinity', '-Infinity') or p_cantidad <= 0 or p_cantidad > 9999999 or mod(p_cantidad, 0.5) <> 0 then
    raise exception 'Cantidad inválida: utiliza toneladas enteras o medias toneladas (0.5, 1, 1.5...)';
  end if;
  if p_solicitud is null or p_nota is null or length(p_nota) > 500 then raise exception 'Solicitud inválida'; end if;
  select * into producto from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  select * into anterior from public.movimientos where solicitud_id = p_solicitud;
  if found then
    if anterior.producto_id = p_producto and anterior.tipo = p_tipo and anterior.cantidad = p_cantidad and anterior.nota = p_nota and anterior.usuario_id = auth.uid() then return; end if;
    raise exception 'La solicitud ya fue utilizada con otros datos';
  end if;
  if producto.cotizacion_pendiente then raise exception 'Confirma el peso y precio antes de registrar movimientos'; end if;
  if producto.unidad = 'pieza' and p_cantidad <> trunc(p_cantidad) then raise exception 'Las piezas deben ser enteras'; end if;
  saldo := producto.stock + case when p_tipo = 'entrada' then p_cantidad else -p_cantidad end;
  if saldo < 0 then raise exception 'No hay existencias suficientes'; end if;
  if saldo > 9999999 then raise exception 'Se excede el máximo de existencias'; end if;
  update public.productos set stock = saldo where id = p_producto;
  insert into public.movimientos(solicitud_id, producto_id, tipo, cantidad, stock_resultante, nota, usuario_id, unidad)
  values (p_solicitud, p_producto, p_tipo, p_cantidad, saldo, p_nota, auth.uid(), producto.unidad);
end;
$$;

create or replace function public.registrar_venta(p_producto uuid,p_cantidad numeric,p_nota text,p_solicitud uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare producto public.productos%rowtype; anterior public.ventas%rowtype; venta_id uuid; saldo numeric; total numeric;
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<=0 or p_cantidad>9999999 or mod(p_cantidad,0.5)<>0 then raise exception 'Cantidad inválida'; end if;
  if p_solicitud is null or p_nota is null or length(p_nota)>500 then raise exception 'Solicitud inválida'; end if;
  select * into producto from public.productos where id=p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  select * into anterior from public.ventas where solicitud_id=p_solicitud;
  if found then
    if anterior.producto_id=p_producto and anterior.cantidad=p_cantidad and anterior.nota=p_nota and anterior.usuario_id=auth.uid() then return anterior.id; end if;
    raise exception 'La solicitud ya fue utilizada con otros datos';
  end if;
  if producto.cotizacion_pendiente or producto.precio is null then raise exception 'Confirma el peso y precio antes de vender'; end if;
  if producto.unidad='pieza' and p_cantidad<>trunc(p_cantidad) then raise exception 'Las piezas deben ser enteras'; end if;
  saldo:=producto.stock-p_cantidad;
  if saldo<0 then raise exception 'No hay existencias suficientes'; end if;
  total:=round(producto.precio*p_cantidad,2);
  if total<=0 then raise exception 'El monto de la venta debe ser mayor a cero'; end if;
  insert into public.ventas(solicitud_id,producto_id,nombre_producto,unidad,cantidad,precio_unitario,monto,nota,usuario_id)
  values(p_solicitud,p_producto,producto.nombre,producto.unidad,p_cantidad,producto.precio,total,p_nota,auth.uid()) returning id into venta_id;
  update public.productos set stock=saldo where id=p_producto;
  insert into public.movimientos(solicitud_id,producto_id,tipo,cantidad,stock_resultante,nota,usuario_id,unidad)
  values(p_solicitud,p_producto,'venta',p_cantidad,saldo,p_nota,auth.uid(),producto.unidad);
  return venta_id;
end; $$;

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
