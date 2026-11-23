import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { procesarEventoTelegram, enviarRespuestasTelegram } from '../supabase/functions/telegram-alertas/pedidos.js'

test('pedidos Telegram: aprobación autorizada, stock atómico, duplicados, rechazo y falta de stock',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      insert into auth.users values ('10000000-0000-4000-8000-000000000001');`)
    for(const path of ['supabase/migrations/202611190001_catalogo_inventario.sql','supabase/seed.sql','supabase/sql/alertas_stock.sql','supabase/sql/ventas.sql','supabase/sql/telegram.sql','supabase/sql/mayoreo_toneladas.sql']) await db.exec(await readFile(new URL('../'+path,import.meta.url),'utf8'))
    await db.exec(`insert into public.administradores values ('10000000-0000-4000-8000-000000000001');update private.telegram_config set chat_id='12345' where singleton=true;
      update public.productos set stock=0.01,stock_minimo=0.003 where unidad='tonelada' and not cotizacion_pendiente;`)
    await db.exec(await readFile(new URL('../supabase/sql/pedidos_telegram.sql',import.meta.url),'utf8'))
    const producto=(await db.query("select id from public.productos where nombre='Almeja'")).rows[0].id
    let update=100
    const evento=(chat,text='',callback='')=>db.query('select public.telegram_evento($1,$2,$2,$3,$4)',[++update,chat,text,callback])
    const pedir=async(chat)=>{
      await evento(chat,'/start producto_'+producto)
      await evento(chat,'0,002')
      return (await db.query('select * from public.pedidos_telegram where cliente_chat_id=$1 order by creada_en desc',[chat])).rows[0]
    }
    const inicial=Number((await db.query('select stock from public.productos where id=$1',[producto])).rows[0].stock)
    await evento('20000','/start producto_'+ '-'.repeat(36))
    const pedido=await pedir('20001')
    assert.equal(pedido.estado,'pendiente')
    await evento('20001','','a:'+pedido.id)
    assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,0)
    const aceptarUpdate=++update
    await db.query("select public.telegram_evento($1,'12345','12345','','a:'||$2)",[aceptarUpdate,pedido.id])
    await db.query("select public.telegram_evento($1,'12345','12345','','a:'||$2)",[aceptarUpdate,pedido.id])
    await evento('12345','','a:'+pedido.id)
    assert.equal(Number((await db.query('select stock from public.productos where id=$1',[producto])).rows[0].stock),inicial-0.002)
    assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,1)
    assert.equal((await db.query('select * from public.ventas')).rows[0].unidad,'tonelada')
    const denegado=await pedir('20002');await evento('12345','','d:'+denegado.id)
    assert.equal((await db.query('select estado from public.pedidos_telegram where id=$1',[denegado.id])).rows[0].estado,'denegada')
    const agotado=await pedir('20003');await db.query('update public.productos set stock=0 where id=$1',[producto]);await evento('12345','','a:'+agotado.id)
    assert.equal((await db.query('select estado from public.pedidos_telegram where id=$1',[agotado.id])).rows[0].estado,'sin_stock')
    assert.equal((await db.query('select count(*) from public.ventas')).rows[0].count,1)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from public.pedidos_telegram'),/permission denied/)
    await assert.rejects(evento('12345','','a:'+pedido.id),/permission denied/)
    await db.exec('reset role;set role authenticated')
    assert.equal((await db.query('select * from public.pedidos_telegram')).rows.length,0)
    await assert.rejects(db.query('select public.telegram_tomar_salida()'),/permission denied/)
  } finally { await db.close() }
})

test('webhook ignora grupos y actores falsos; una entrega ambigua no se marca enviada',async()=>{
  const llamadas=[]
  const db={rpc:async(method,args)=>{llamadas.push({method,args});if(method==='telegram_tomar_salida')return{data:{id:1,payload:{chat_id:'123',text:'Prueba'}}};return{}}}
  await procesarEventoTelegram(db,{update_id:1,message:{chat:{type:'group',id:123},from:{id:123},text:'1'}})
  await procesarEventoTelegram(db,{update_id:2,message:{chat:{type:'private',id:123},from:{id:456},text:'1'}})
  assert.equal(llamadas.length,0)
  await assert.rejects(enviarRespuestasTelegram(db,async()=>{throw new Error('timeout')}),/outbox_delivery_failed/)
  assert.equal(llamadas.find(x=>x.method==='telegram_finalizar_salida').args.p_estado,'incierta')
})
