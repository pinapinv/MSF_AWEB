begin;
alter table public.movimientos drop constraint movimientos_tipo_check;
alter table public.movimientos add constraint movimientos_tipo_check check (tipo in ('entrada','merma','venta'));
create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null unique,
  producto_id uuid not null references public.productos(id),
  nombre_producto text not null,
  unidad text not null,
  cantidad numeric(12,3) not null check (cantidad>0),
  precio_unitario numeric(12,2) not null check (precio_unitario>0),
  monto numeric(16,2) not null check (monto>0),
  nota text not null default '' check (length(nota)<=500),
  usuario_id uuid not null references auth.users(id),
  fecha timestamptz not null default now()
);
create index ventas_fecha on public.ventas(fecha desc);
create index ventas_producto on public.ventas(producto_id);
alter table public.ventas enable row level security;
revoke all on public.ventas from anon,authenticated;
grant select on public.ventas to authenticated;
create policy "Ventas administrativas" on public.ventas for select to authenticated using ((select public.es_administrador()));

create function public.registrar_venta(p_producto uuid,p_cantidad numeric,p_nota text,p_solicitud uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare producto public.productos%rowtype; anterior public.ventas%rowtype; venta_id uuid; saldo numeric; total numeric;
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<=0 or p_cantidad>9999999 or p_cantidad<>round(p_cantidad,3) then raise exception 'Cantidad inválida'; end if;
  if p_solicitud is null or p_nota is null or length(p_nota)>500 then raise exception 'Solicitud inválida'; end if;
  select * into producto from public.productos where id=p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  select * into anterior from public.ventas where solicitud_id=p_solicitud;
  if found then
    if anterior.producto_id=p_producto and anterior.cantidad=p_cantidad and anterior.nota=p_nota and anterior.usuario_id=auth.uid() then return anterior.id; end if;
    raise exception 'La solicitud ya fue utilizada con otros datos';
  end if;
  if producto.unidad='pieza' and p_cantidad<>trunc(p_cantidad) then raise exception 'Las piezas deben ser enteras'; end if;
  saldo:=producto.stock-p_cantidad;
  if saldo<0 then raise exception 'No hay existencias suficientes'; end if;
  total:=round(producto.precio*p_cantidad,2);
  if total<=0 then raise exception 'El monto de la venta debe ser mayor a cero'; end if;
  insert into public.ventas(solicitud_id,producto_id,nombre_producto,unidad,cantidad,precio_unitario,monto,nota,usuario_id)
  values(p_solicitud,p_producto,producto.nombre,producto.unidad,p_cantidad,producto.precio,total,p_nota,auth.uid()) returning id into venta_id;
  update public.productos set stock=saldo where id=p_producto;
  insert into public.movimientos(solicitud_id,producto_id,tipo,cantidad,stock_resultante,nota,usuario_id)
  values(p_solicitud,p_producto,'venta',p_cantidad,saldo,p_nota,auth.uid());
  return venta_id;
end; $$;
revoke all on function public.registrar_venta(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.registrar_venta(uuid,numeric,text,uuid) to authenticated;
commit;
