-- Ejecutar una vez: cantidades de prueba autorizadas, no inventario real verificado.
-- Se usan entradas auditables; repetir no vuelve a sumar existencias.
begin;
-- Sustituir el marcador por el UUID de un administrador autorizado.
-- El cast rechaza el marcador sin completar antes de modificar el catálogo.
select set_config('request.jwt.claim.sub', 'REEMPLAZAR_POR_UUID_ADMINISTRADOR'::uuid::text, true);
do $$
declare fila record;
begin
  for fila in select p.id,p.nombre,v.cantidad,v.foto from public.productos p join
    (values ('Filete de pescado',12,'filete'),('Camarón mediano',8,'camaron'),('Pulpo',5,'pulpo'),
      ('Ostión',36,'ostion'),('Almeja',2,'almeja'),('Pescado entero',10,'pescado')) v(nombre,cantidad,foto)
    on p.nombre=v.nombre
  loop
    update public.productos set foto_url='https://msf-aweb.vercel.app/productos/'||fila.foto||'.jpg'
    where id=fila.id and foto_url='';
    if not exists(select 1 from public.movimientos where producto_id=fila.id and nota='Carga inicial de prueba autorizada') then
      perform public.registrar_movimiento(fila.id,'entrada',fila.cantidad,'Carga inicial de prueba autorizada',gen_random_uuid());
    end if;
  end loop;
end $$;
commit;
