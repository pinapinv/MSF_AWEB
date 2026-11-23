import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearTelegramHandler } from '../supabase/functions/telegram-alertas/handler.js'

const secret = 'a'.repeat(64), codigo = '94edb91b-1339-4d37-9fb9-ea7a258ebf16'
const request = (key=secret) => new Request('https://example.test',{method:'POST',headers:{'x-worker-secret':key}})
function fixture({ token='token-de-prueba', autorizado=true, vinculado=true, updates=[], resultado={ok:true,result:{message_id:42}} }={}) {
  const config={codigo,chat_id:vinculado?'12345':null,update_offset:0,webhook_activo:true}, estados=[], revisiones=[], solicitudes=[]
  const db={
    rpc:async (method,args)=>{
      if(method==='validar_worker_telegram') return {data:autorizado}
      if(method==='config_worker_telegram') return {data:{...config}}
      if(method==='telegram_tomar_salida') return {data:null}
      if(method==='revision_telegram'){revisiones.push(args);return {}}
      if(method==='vincular_telegram'){assert.equal(args.p_codigo,codigo);config.chat_id=args.p_chat_id;return {}}
      if(method==='tomar_alerta_stock')return {data:[{id:'alerta',nombre_producto:'Almeja',cantidad:2,minimo:3,unidad:'kg'}]}
      assert.fail(method)
    },
    from:()=>({
      select:()=>({eq:()=>({is:()=>({order:()=>({limit:async()=>({data:[{id:'alerta'}]})})})})}),
      update:(data)=>({eq:async()=>{estados.push(data);return {}}}),
    }),
  }
  const handler=crearTelegramHandler({db,env:()=>token,enviar:async(url,options)=>{
    solicitudes.push({url,body:JSON.parse(options.body)})
    return url.endsWith('/getUpdates')?Response.json({ok:true,result:updates}):Response.json(resultado,{status:resultado.ok?200:400})
  }})
  return {handler,estados,revisiones,solicitudes,config}
}
test('Telegram: rechaza llamadas sin secreto y no envía cuando falta token',async()=>{
  const f=fixture();assert.equal((await f.handler(request(''))).status,401);assert.equal(f.solicitudes.length,0)
  const g=fixture({token:null});await g.handler(request());assert.equal(g.revisiones[0].p_error,'falta_token');assert.equal(g.solicitudes.length,0)
})
test('Telegram: no vincula al último desconocido que escribe al bot',async()=>{
  const f=fixture({vinculado:false,updates:[{update_id:1,message:{text:'/start',chat:{id:678,type:'private'}}}]})
  await f.handler(request());assert.equal(f.config.chat_id,null);assert.equal(f.estados.length,0)
})
test('Telegram: vincula solo con código privado y manda producto y cantidades al chat fijo',async()=>{
  const f=fixture({vinculado:false,updates:[{update_id:2,message:{text:'/start '+codigo,chat:{id:12345,type:'private'}}}]})
  assert.equal((await f.handler(request())).status,200)
  assert.equal(f.config.chat_id,'12345')
  const envio=f.solicitudes.find((s)=>s.url.endsWith('/sendMessage'))
  assert.equal(envio.body.chat_id,'12345');assert.match(envio.body.text,/Almeja/);assert.match(envio.body.text,/2 kg/)
  assert.equal(f.estados[0].canal,'telegram');assert.equal(f.estados[0].estado,'aceptada')
})
test('Telegram: un error explícito queda registrado sin fingir entrega',async()=>{
  const f=fixture({resultado:{ok:false,error_code:403}})
  assert.equal((await f.handler(request())).status,502);assert.equal(f.estados[0].estado,'rechazada')
})
