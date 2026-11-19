begin;

create table public.administradores (
  usuario_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.administradores enable row level security;
revoke all on public.administradores from anon, authenticated;
grant select on public.administradores to authenticated;
create policy "Consultar mi autorización" on public.administradores
  for select to authenticated using (usuario_id = (select auth.uid()));

create function public.es_administrador() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.administradores where usuario_id = (select auth.uid()));
$$;
revoke all on function public.es_administrador() from public;
grant execute on function public.es_administrador() to authenticated;

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  descripcion text not null default '' check (length(descripcion) <= 1000),
  categoria text not null check (length(trim(categoria)) between 1 and 60),
  unidad text not null check (unidad in ('kg', 'pieza')),
  precio numeric(12,2) not null check (precio > 0 and precio <= 9999999),
  stock numeric(12,3) not null default 0 check (stock >= 0 and stock <= 9999999),
  stock_minimo numeric(12,3) not null default 0 check (stock_minimo >= 0 and stock_minimo <= 9999999),
  foto_url text not null default '' check (foto_url = '' or (foto_url ~ '^https://' and length(foto_url) <= 2048)),
  promocion boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint piezas_enteras check (unidad <> 'pieza' or (stock = trunc(stock) and stock_minimo = trunc(stock_minimo)))
);
alter table public.productos enable row level security;
revoke all on public.productos from anon, authenticated;
grant select on public.productos to anon, authenticated;
grant insert (nombre, descripcion, categoria, unidad, precio, stock_minimo, foto_url, promocion) on public.productos to authenticated;
grant update (nombre, descripcion, categoria, precio, stock_minimo, foto_url, promocion) on public.productos to authenticated;
create policy "Catálogo público" on public.productos for select to anon, authenticated using (true);
create policy "Crear productos como administrador" on public.productos for insert to authenticated with check ((select public.es_administrador()));
create policy "Editar productos como administrador" on public.productos for update to authenticated using ((select public.es_administrador())) with check ((select public.es_administrador()));

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null unique,
  producto_id uuid not null references public.productos(id),
  tipo text not null check (tipo in ('entrada', 'merma')),
  cantidad numeric(12,3) not null check (cantidad > 0 and cantidad <= 9999999),
  stock_resultante numeric(12,3) not null check (stock_resultante >= 0),
  nota text not null default '' check (length(nota) <= 500),
  usuario_id uuid not null references auth.users(id),
  creado_en timestamptz not null default now()
);
create index movimientos_producto_fecha on public.movimientos(producto_id, creado_en desc);
alter table public.movimientos enable row level security;
revoke all on public.movimientos from anon, authenticated;
grant select on public.movimientos to authenticated;
create policy "Historial administrativo" on public.movimientos for select to authenticated using ((select public.es_administrador()));

-- La autorización, el bloqueo de fila, el cambio de stock y el historial
-- ocurren en la misma transacción. No hay escrituras directas desde el cliente.
create function public.registrar_movimiento(
  p_producto uuid, p_tipo text, p_cantidad numeric, p_nota text, p_solicitud uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  producto public.productos%rowtype;
  anterior public.movimientos%rowtype;
  saldo numeric;
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'merma') then raise exception 'Tipo de movimiento inválido'; end if;
  if p_cantidad is null or p_cantidad::text in ('NaN', 'Infinity', '-Infinity') or p_cantidad <= 0 or p_cantidad > 9999999 or p_cantidad <> round(p_cantidad, 3) then
    raise exception 'Cantidad inválida: utiliza un máximo de tres decimales';
  end if;
  if p_solicitud is null or p_nota is null or length(p_nota) > 500 then raise exception 'Solicitud inválida'; end if;
  select * into producto from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  select * into anterior from public.movimientos where solicitud_id = p_solicitud;
  if found then
    if anterior.producto_id = p_producto and anterior.tipo = p_tipo and anterior.cantidad = p_cantidad and anterior.nota = p_nota and anterior.usuario_id = auth.uid() then return; end if;
    raise exception 'La solicitud ya fue utilizada con otros datos';
  end if;
  if producto.unidad = 'pieza' and p_cantidad <> trunc(p_cantidad) then raise exception 'Las piezas deben ser enteras'; end if;
  saldo := producto.stock + case when p_tipo = 'entrada' then p_cantidad else -p_cantidad end;
  if saldo < 0 then raise exception 'No hay existencias suficientes'; end if;
  if saldo > 9999999 then raise exception 'Se excede el máximo de existencias'; end if;
  update public.productos set stock = saldo where id = p_producto;
  insert into public.movimientos(solicitud_id, producto_id, tipo, cantidad, stock_resultante, nota, usuario_id)
  values (p_solicitud, p_producto, p_tipo, p_cantidad, saldo, p_nota, auth.uid());
end;
$$;
revoke all on function public.registrar_movimiento(uuid, text, numeric, text, uuid) from public;
grant execute on function public.registrar_movimiento(uuid, text, numeric, text, uuid) to authenticated;

commit;
