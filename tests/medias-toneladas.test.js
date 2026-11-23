import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { validarMovimiento } from '../src/lib/productos.js'

test('enteros y medios: stock de ejemplo, mínimo 1, Telegram y venta sin doble descuento', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      insert into auth.users values ('10000000-0000-4000-8000-000000000001');`)
    for (const path of ['supabase/migrations/202611190001_catalogo_inventario.sql','supabase/seed.sql','supabase/sql/alertas_stock.sql','supabase/sql/ventas.sql','supabase/sql/telegram.sql','supabase/sql/mayoreo_toneladas.sql']) {
      await db.exec(await readFile(new URL('../'+path,import.meta.url),'utf8'))
    }
    await db.exec(`insert into public.administradores values ('10000000-0000-4000-8000-000000000001');update private.telegram_config set chat_id='12345' where singleton=true;`)
    await db.exec(await readFile(new URL('../supabase/sql/pedidos_telegram.sql',import.meta.url),'utf8'))
    await db.exec(await readFile(new URL('../supabase/sql/toneladas_enteras_medias.sql',import.meta.url),'utf8'))
    const productos = (await db.query('select * from public.productos')).rows
    assert.ok(productos.every(p=>Number(p.stock_minimo)===1 && Number(p.stock)*2%1===0))
    assert.equal(Number(productos.find(p=>p.nombre==='Filete de pescado').stock),5)
    assert.equal(Number(productos.find(p=>p.nombre==='Pulpo').stock),1.5)
    assert.equal(productos.find(p=>p.nombre==='Ostión').cotizacion_pendiente,true)
    const id=productos.find(p=>p.nombre==='Filete de pescado').id
    await db.query("select public.telegram_evento(100,'20001','20001',$1,'')",['/start producto_'+id])
    for (const [i,cantidad] of ['0.001','1.25','0.7','1/2'].entries()) {
      await db.query("select public.telegram_evento($1,'20001','20001',$2,'')",[101+i,cantidad])
    }
    assert.equal((await db.query('select count(*) from public.pedidos_telegram')).rows[0].count,0)
    await db.query("select public.telegram_evento(110,'20001','20001','1,5','')")
    const pedido=(await db.query('select * from public.pedidos_telegram')).rows[0]
    assert.equal(Number(pedido.cantidad),1.5)
    await db.query("select public.telegram_evento(111,'12345','12345','',$1)",['a:'+pedido.id])
    await db.query("select public.telegram_evento(112,'12345','12345','',$1)",['a:'+pedido.id])
    assert.equal(Number((await db.query('select stock from public.productos where id=$1',[id])).rows[0].stock),3.5)
    assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,1)
    await assert.rejects(db.query('update public.productos set stock=1.25 where id=$1',[id]),/stock_medias_toneladas/)
    await assert.rejects(db.query('update public.productos set stock_minimo=0.5 where id=$1',[id]),/minimo_una_tonelada/)
    await db.query("select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false)")
    for (const cantidad of [0.001,0.7,1.25]) {
      await assert.rejects(db.query("select public.registrar_movimiento($1,'entrada',$2,'',$3)",[id,cantidad,crypto.randomUUID()]),/Cantidad inválida/)
      await assert.rejects(db.query("select public.registrar_venta($1,$2,'',$3)",[id,cantidad,crypto.randomUUID()]),/Cantidad inválida/)
    }
    await db.query("select public.registrar_venta($1,3,'',$2)",[id,crypto.randomUUID()])
    const alerta=(await db.query('select * from public.alertas_stock where producto_id=$1 and resuelta_en is null',[id])).rows[0]
    assert.equal(Number(alerta.cantidad),0.5)
    assert.equal(Number(alerta.minimo),1)
  } finally { await db.close() }
})

test('validación del formulario: enteros y medios positivos',()=>{
  for (const cantidad of [0.5,1,1.5,2,5]) assert.equal(validarMovimiento({unidad:'tonelada',stock:5},'merma',cantidad),'')
  for (const cantidad of [0,-1,0.001,0.7,1.25,Infinity]) assert.ok(validarMovimiento({unidad:'tonelada',stock:5},'entrada',cantidad))
})
