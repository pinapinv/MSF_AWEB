begin;
create schema if not exists private;
create table public.alertas_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id),
  nombre_producto text not null,
  cantidad numeric(12,3) not null,
  minimo numeric(12,3) not null,
  unidad text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','procesando','aceptada','rechazada','incierta','cancelada')),
  mensaje_id text,
  error_codigo text,
  creada_en timestamptz not null default now(),
  procesada_en timestamptz,
  resuelta_en timestamptz
);
create unique index alerta_stock_activa on public.alertas_stock(producto_id) where resuelta_en is null;
create index alertas_stock_pendientes on public.alertas_stock(creada_en) where estado='pendiente';
alter table public.alertas_stock enable row level security;
revoke all on public.alertas_stock from anon, authenticated;
grant select on public.alertas_stock to authenticated;
grant select, update on public.alertas_stock to service_role;
-- SELECT FOR UPDATE necesita permiso UPDATE en al menos una columna del producto.
grant select, update (id) on public.productos to service_role;
create policy "Consultar alertas como administrador" on public.alertas_stock
for select to authenticated using ((select public.es_administrador()));

-- Un evento por episodio de stock bajo; reponer hasta el mínimo lo resuelve.
create function private.msf_generar_alerta_stock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
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
revoke all on function private.msf_generar_alerta_stock() from public, anon, authenticated;
create trigger msf_stock_bajo after insert or update of stock,stock_minimo on public.productos
for each row execute function private.msf_generar_alerta_stock();

-- El envío solo puede reclamarlo el servidor. Se bloquea primero el producto
-- para mantener el mismo orden de bloqueos que los movimientos del inventario.
create function public.tomar_alerta_stock(p_alerta uuid) returns setof public.alertas_stock
language plpgsql security invoker set search_path='' as $$
declare producto public.productos%rowtype; alerta public.alertas_stock%rowtype;
begin
  select p.* into producto from public.productos p join public.alertas_stock a on a.producto_id=p.id
  where a.id=p_alerta for update of p;
  if not found then return; end if;
  select * into alerta from public.alertas_stock where id=p_alerta for update;
  if alerta.estado <> 'pendiente' or alerta.resuelta_en is not null then return; end if;
  if producto.stock >= producto.stock_minimo then
    update public.alertas_stock set estado='cancelada',resuelta_en=now() where id=p_alerta;
    return;
  end if;
  return query update public.alertas_stock set estado='procesando',
    nombre_producto=producto.nombre,cantidad=producto.stock,minimo=producto.stock_minimo,unidad=producto.unidad
    where id=p_alerta returning *;
end; $$;
revoke all on function public.tomar_alerta_stock(uuid) from public,anon,authenticated;
grant execute on function public.tomar_alerta_stock(uuid) to service_role;

-- Registrar los productos que ya están bajos. No se envía ningún mensaje aquí.
insert into public.alertas_stock(producto_id,nombre_producto,cantidad,minimo,unidad)
select id,nombre,stock,stock_minimo,unidad from public.productos where stock < stock_minimo;
commit;
