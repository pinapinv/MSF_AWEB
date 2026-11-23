import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { filtrarProductos, validarMovimiento } from '../src/lib/productos.js'

test('conversión a toneladas conserva valor, historial y bloquea ostión sin peso', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      insert into auth.users values ('10000000-0000-4000-8000-000000000001');`)
    for (const path of ['supabase/migrations/202611190001_catalogo_inventario.sql','supabase/seed.sql','supabase/sql/alertas_stock.sql','supabase/sql/ventas.sql','supabase/sql/telegram.sql']) {
      await db.exec(await readFile(new URL('../' + path, import.meta.url), 'utf8'))
    }
    await db.exec(`insert into public.administradores values ('10000000-0000-4000-8000-000000000001');
      set role authenticated; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false)`)
    const kg = (await db.query("select id from public.productos where unidad='kg' order by nombre limit 1")).rows[0].id
    const pieza = (await db.query("select id from public.productos where unidad='pieza' limit 1")).rows[0].id
    await db.query("select public.registrar_movimiento($1,'entrada',12.345,'',$2)", [kg,crypto.randomUUID()])
    await db.query("select public.registrar_movimiento($1,'entrada',36,'',$2)", [pieza,crypto.randomUUID()])
    await db.query("select public.registrar_venta($1,1.234,'',$2)", [kg,crypto.randomUUID()])
    const antes = (await db.query('select * from public.productos where id=$1',[kg])).rows[0]
    const ventaAnterior = (await db.query('select * from public.ventas')).rows[0]
    await db.exec('reset role')
    await db.exec(await readFile(new URL('../supabase/sql/mayoreo_toneladas.sql', import.meta.url), 'utf8'))
    const despues = (await db.query('select * from public.productos where id=$1',[kg])).rows[0]
    assert.equal(despues.unidad,'tonelada')
    assert.equal(Number(despues.stock),Number((Number(antes.stock)/1000).toFixed(6)))
    assert.equal(Number(despues.stock_minimo),Number(antes.stock_minimo)/1000)
    assert.equal(Number(despues.precio),Number(antes.precio)*1000)
    const ventaConservada = (await db.query('select * from public.ventas')).rows[0]
    assert.deepEqual({...ventaConservada,cantidad:Number(ventaConservada.cantidad)},{...ventaAnterior,cantidad:Number(ventaAnterior.cantidad)})
    assert.equal((await db.query("select unidad from public.movimientos where tipo='venta'")).rows[0].unidad,'kg')
    const pendiente = (await db.query('select * from public.productos where id=$1',[pieza])).rows[0]
    assert.equal(pendiente.cotizacion_pendiente,true)
    assert.equal(pendiente.precio,null)
    const referencia = (await db.query('select * from public.conversiones_unidad where producto_id=$1',[pieza])).rows[0]
    assert.equal(Number(referencia.stock_anterior),36)
    assert.equal(referencia.unidad_anterior,'pieza')
    await db.query('update public.productos set stock_minimo=1 where id=$1',[pieza])
    assert.equal((await db.query('select * from public.alertas_stock where producto_id=$1 and resuelta_en is null',[pieza])).rows.length,0)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from public.conversiones_unidad'),/permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(db.query("select public.registrar_venta($1,0.001,'',$2)",[pieza,crypto.randomUUID()]),/Confirma el peso/)
    await assert.rejects(db.query("select public.registrar_movimiento($1,'entrada',1,'',$2)",[pieza,crypto.randomUUID()]),/Confirma el peso/)
    await db.query("select public.registrar_venta($1,0.000001,'',$2)",[kg,crypto.randomUUID()])
    const nueva = (await db.query("select * from public.ventas where unidad='tonelada'")).rows[0]
    assert.equal(Number(nueva.cantidad),0.000001)
    assert.equal(Number(nueva.monto),Math.round(Number(despues.precio)*0.000001*100)/100)
    assert.equal((await db.query('select unidad from public.movimientos where solicitud_id=$1',[nueva.solicitud_id])).rows[0].unidad,'tonelada')
    await assert.rejects(db.query("select public.registrar_venta($1,0.0000001,'',$2)",[kg,crypto.randomUUID()]),/Cantidad inválida/)
    await db.query("select set_config('request.jwt.claim.sub','',false)")
    assert.equal((await db.query('update public.productos set cotizacion_pendiente=false where id=$1 returning id',[pieza])).rows.length,0)
    await assert.rejects(db.query("insert into public.productos(nombre,categoria,unidad,precio,cotizacion_pendiente) values ('No autorizado','Moluscos','tonelada',null,true)"),/row-level security/)
    assert.equal((await db.query('select * from public.conversiones_unidad')).rows.length,0)
  } finally { await db.close() }
})

test('toneladas: solo enteros o medios y pendientes fuera de filtros de precio y stock', () => {
  const producto = { nombre:'Ostión',unidad:'tonelada',precio:null,stock:0,cotizacion_pendiente:true }
  assert.equal(filtrarProductos([producto],{}).length,1)
  assert.equal(filtrarProductos([producto],{precioMax:'100000'}).length,0)
  assert.equal(filtrarProductos([producto],{disponibles:true}).length,0)
  assert.match(validarMovimiento(producto,'entrada',1),/Confirma el peso/)
  assert.equal(validarMovimiento({unidad:'tonelada',stock:1},'merma',0.5),'')
  assert.match(validarMovimiento({unidad:'tonelada',stock:1},'entrada',0.0000001),/enteras o medias/)
})
