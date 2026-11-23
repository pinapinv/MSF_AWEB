import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('venta atómica: stock, monto histórico, movimiento, alerta e idempotencia', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      insert into auth.users values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');`)
    for (const path of ['supabase/migrations/202611190001_catalogo_inventario.sql','supabase/seed.sql','supabase/sql/alertas_stock.sql','supabase/sql/ventas.sql','supabase/sql/telegram.sql']) await db.exec(await readFile(new URL('../' + path, import.meta.url), 'utf8'))
    await db.exec(`insert into public.administradores values ('10000000-0000-4000-8000-000000000001'); set role authenticated; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false)`)
    const configuracion = (await db.query('select public.estado_telegram() as estado')).rows[0].estado
    assert.equal(configuracion.vinculado,false)
    assert.equal(configuracion.worker_secret,undefined)
    await assert.rejects(db.query('select public.config_worker_telegram()'),/permission denied/)
    const producto = '00000000-0000-4000-8000-000000000001'
    await db.query("select public.registrar_movimiento($1,'entrada',10,'',$2)", [producto,crypto.randomUUID()])
    const vender = (cantidad, solicitud = crypto.randomUUID(), id = producto) => db.query("select public.registrar_venta($1,$2,'',$3) as id", [id,cantidad,solicitud])
    const solicitud = crypto.randomUUID()
    const venta = (await vender(8,solicitud)).rows[0].id
    await db.query('update public.productos set precio=200 where id=$1', [producto])
    assert.equal((await vender(8,solicitud)).rows[0].id,venta)
    const registro = (await db.query('select * from public.ventas')).rows[0]
    assert.equal(Number(registro.monto),1440)
    assert.equal(Number(registro.precio_unitario),180)
    assert.equal(Number((await db.query('select stock from public.productos where id=$1',[producto])).rows[0].stock),2)
    assert.equal((await db.query("select * from public.movimientos where tipo='venta'")).rows.length,1)
    assert.equal((await db.query('select * from public.alertas_stock where producto_id=$1 and resuelta_en is null',[producto])).rows.length,1)
    await assert.rejects(vender(3),/existencias suficientes/)
    await assert.rejects(vender(0),/Cantidad inválida/)
    await assert.rejects(vender(1,solicitud),/otros datos/)
    assert.equal((await db.query('select * from public.ventas')).rows.length,1)
    await db.query("select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false)")
    assert.equal((await db.query('select * from public.ventas')).rows.length,0)
    await assert.rejects(vender(1),/Acceso no autorizado/)
    await assert.rejects(db.query('select public.estado_telegram()'),/Acceso no autorizado/)
    await db.exec('reset role; set role anon')
    await assert.rejects(db.query('select * from public.ventas'),/permission denied/)
  } finally { await db.close() }
})
