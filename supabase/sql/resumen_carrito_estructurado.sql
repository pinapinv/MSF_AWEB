-- Resumen estructurado del mismo carrito; conserva autorización y solicitudes existentes.
begin;
create or replace function public.crear_carrito(p_solicitud uuid,p_lineas jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previo public.carritos_telegram%rowtype; linea jsonb;p public.productos%rowtype;q numeric; v_resumen text; v_total numeric;
begin
 if p_solicitud is null or jsonb_typeof(p_lineas)<>'array' or jsonb_array_length(p_lineas) not between 1 and 20 then raise exception 'Carrito inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_solicitud::text,0));
 select * into previo from public.carritos_telegram where id=p_solicitud;
 if found then
   if previo.solicitud<>p_lineas then raise exception 'La solicitud ya se usó con otro carrito'; end if;
   return jsonb_build_object('id',previo.id,'total',previo.total,'resumen',previo.resumen,'lineas',(select jsonb_agg(jsonb_build_object('producto_id',producto_id,'nombre',nombre,'cantidad',cantidad,'precio',precio,'monto',monto) order by nombre) from public.carrito_lineas where carrito_id=p_solicitud));
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
 return jsonb_build_object('id',p_solicitud,'total',v_total,'resumen',v_resumen,'lineas',(select jsonb_agg(jsonb_build_object('producto_id',producto_id,'nombre',nombre,'cantidad',cantidad,'precio',precio,'monto',monto) order by nombre) from public.carrito_lineas where carrito_id=p_solicitud));
end; $$;
commit;
