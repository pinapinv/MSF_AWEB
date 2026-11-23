import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('carrito: cantidades, precios de servidor, aceptación completa, duplicados y rechazo sin venta parcial',async()=>{
 const db=new PGlite()
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

 await db.exec(await readFile(new URL('../supabase/sql/carrito_telegram.sql',import.meta.url),'utf8'))
 const productos=(await db.query("select id,nombre,precio,stock from public.productos where nombre in ('Filete de pescado','Camarón mediano') order by nombre")).rows
 const lineas=productos.map(p=>({producto_id:p.id,cantidad:0.5}))
 const id=crypto.randomUUID()
 await db.exec('set role anon')
 const crear=()=>db.query('select public.crear_carrito($1,$2::jsonb) as carrito',[id,JSON.stringify(lineas)])
 const carrito=(await crear()).rows[0].carrito
 assert.equal(Number(carrito.total),productos.reduce((s,p)=>s+Number(p.precio)*0.5,0))
 assert.equal((await crear()).rows[0].carrito.id,id)
 await assert.rejects(db.query('select * from public.carritos_telegram'),/permission denied/)
 await assert.rejects(db.query('select public.crear_carrito($1,$2::jsonb)',[crypto.randomUUID(),JSON.stringify([{producto_id:productos[0].id,cantidad:0.001}])]),/enteras o medias/)
 await db.exec('reset role')
 let update=100
 const evento=(chat,text='',callback='')=>db.query('select public.telegram_evento($1,$2,$2,$3,$4)',[++update,chat,text,callback])
 await evento('20001','/start carrito_'+id)
 await evento('20001','/start carrito_'+id)
 assert.equal((await db.query('select estado from public.carritos_telegram where id=$1',[id])).rows[0].estado,'pendiente')
 await evento('20001','','ca:'+id)
 assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,0)
 await evento('12345','','ca:'+id)
 await evento('12345','','ca:'+id)
 assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,2)
 for(const p of productos) assert.equal(Number((await db.query('select stock from public.productos where id=$1',[p.id])).rows[0].stock),Number(p.stock)-0.5)
 const otro=crypto.randomUUID()
 await db.query('select public.crear_carrito($1,$2::jsonb)',[otro,JSON.stringify(lineas)])
 await evento('20002','/start carrito_'+otro)
 await db.query('update public.productos set stock=0 where id=$1',[productos[1].id])
 const antes=(await db.query('select stock from public.productos where id=$1',[productos[0].id])).rows[0].stock
 await evento('12345','','ca:'+otro)
 assert.equal((await db.query('select estado from public.carritos_telegram where id=$1',[otro])).rows[0].estado,'sin_stock')
 assert.equal((await db.query('select stock from public.productos where id=$1',[productos[0].id])).rows[0].stock,antes)
 assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,2)
 const denegar=crypto.randomUUID()
 await db.query('select public.crear_carrito($1,$2::jsonb)',[denegar,JSON.stringify([lineas[0]])])
 await evento('20003','/start carrito_'+denegar);await evento('12345','','cd:'+denegar)
 assert.equal((await db.query('select estado from public.carritos_telegram where id=$1',[denegar])).rows[0].estado,'denegada')
 assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,2)
 } finally { await db.close() }
})
