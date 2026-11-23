-- Aplicar una vez después de ventas.sql, alertas_stock.sql y telegram.sql.
-- Convierte medidas reales; no cambia las cantidades históricas ni inventa peso por pieza.
begin;
lock table public.productos,public.movimientos,public.ventas,public.alertas_stock in access exclusive mode;

create table public.conversiones_unidad (
  producto_id uuid primary key references public.productos(id),
  unidad_anterior text not null,
  precio_anterior numeric(12,2) not null,
  stock_anterior numeric(12,3) not null,
  minimo_anterior numeric(12,3) not null,
  convertida_en timestamptz not null default now()
);
alter table public.conversiones_unidad enable row level security;
revoke all on public.conversiones_unidad from public,anon,authenticated;
grant select on public.conversiones_unidad to authenticated;
create policy "Conversiones solo administradores" on public.conversiones_unidad
for select to authenticated using ((select public.es_administrador()));
insert into public.conversiones_unidad(producto_id,unidad_anterior,precio_anterior,stock_anterior,minimo_anterior)
select id,unidad,precio,stock,stock_minimo from public.productos;

alter table public.movimientos add column unidad text;
update public.movimientos m set unidad=p.unidad from public.productos p where p.id=m.producto_id;
alter table public.movimientos alter column unidad set not null;
drop trigger msf_stock_bajo on public.productos;
alter table public.productos alter column stock type numeric(15,6), alter column stock_minimo type numeric(15,6);
alter table public.movimientos alter column cantidad type numeric(15,6), alter column stock_resultante type numeric(15,6);
alter table public.ventas alter column cantidad type numeric(15,6);
alter table public.alertas_stock alter column cantidad type numeric(15,6), alter column minimo type numeric(15,6);
alter table public.productos add column cotizacion_pendiente boolean not null default false;
alter table public.productos alter column precio drop not null;
alter table public.productos add constraint precio_o_cotizacion check (precio is not null or cotizacion_pendiente);
alter table public.productos drop constraint productos_unidad_check;
alter table public.productos drop constraint piezas_enteras;

update public.productos set unidad='tonelada',precio=precio*1000,stock=stock/1000,stock_minimo=stock_minimo/1000 where unidad='kg';
-- Las piezas no tienen conversión a peso sin un pesaje. Se conserva el registro anterior
-- en conversiones_unidad y movimientos; los ceros actuales no son stock confirmado.
update public.productos set unidad='tonelada',precio=null,stock=0,stock_minimo=0,cotizacion_pendiente=true where unidad='pieza';
alter table public.productos add constraint productos_unidad_check check (unidad='tonelada');
create or replace function private.msf_generar_alerta_stock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.cotizacion_pendiente then
    update public.alertas_stock set resuelta_en=now(),
      estado=case when estado='pendiente' then 'cancelada' else estado end
    where producto_id=new.id and resuelta_en is null;
    return new;
  end if;
  if new.stock < new.stock_minimo then
    insert into public.alertas_stock(producto_id,nombre_producto,cantidad,minimo,unidad)
    values(new.id,new.nombre,new.stock,new.stock_minimo,new.unidad)
    on conflict (producto_id) where resuelta_en is null do nothing;
  else
    update public.alertas_stock set resuelta_en=now(),
      estado=case when estado='pendiente' then 'cancelada' else estado end
    where producto_id=new.id and resuelta_en is null;
  end if;
  return new;
end; $$;

create or replace function public.tomar_alerta_stock(p_alerta uuid) returns setof public.alertas_stock
language plpgsql security invoker set search_path='' as $$
declare producto public.productos%rowtype; alerta public.alertas_stock%rowtype;
begin
  select p.* into producto from public.productos p join public.alertas_stock a on a.producto_id=p.id
  where a.id=p_alerta for update of p;
  if not found then return; end if;
  select * into alerta from public.alertas_stock where id=p_alerta for update;
  if alerta.estado <> 'pendiente' or alerta.resuelta_en is not null then return; end if;
  if producto.cotizacion_pendiente or producto.stock >= producto.stock_minimo then
    update public.alertas_stock set estado='cancelada',resuelta_en=now() where id=p_alerta;
    return;
  end if;
  return query update public.alertas_stock set estado='procesando',
    nombre_producto=producto.nombre,cantidad=producto.stock,minimo=producto.stock_minimo,unidad=producto.unidad
    where id=p_alerta returning *;
end; $$;

create trigger msf_stock_bajo after insert or update of stock,stock_minimo,cotizacion_pendiente on public.productos
for each row execute function private.msf_generar_alerta_stock();
update public.alertas_stock a set estado='cancelada',resuelta_en=now()
from public.productos p where p.id=a.producto_id and p.cotizacion_pendiente and a.resuelta_en is null and a.estado='pendiente';

-- Permiso de columna bajo las políticas RLS YA existentes: INSERT/UPDATE
-- requieren public.es_administrador() tanto en USING como en WITH CHECK.
-- No se cambian esas políticas ni se habilita edición a usuarios comunes.
grant insert(cotizacion_pendiente),update(cotizacion_pendiente) on public.productos to authenticated;
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
  if p_cantidad is null or p_cantidad::text in ('NaN', 'Infinity', '-Infinity') or p_cantidad <= 0 or p_cantidad > 9999999 or p_cantidad <> round(p_cantidad, 6) then
    raise exception 'Cantidad inválida: utiliza un máximo de seis decimales';
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
  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<=0 or p_cantidad>9999999 or p_cantidad<>round(p_cantidad,6) then raise exception 'Cantidad inválida'; end if;
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
-- Las funciones existentes conservan sus restricciones de ejecución.
commit;
