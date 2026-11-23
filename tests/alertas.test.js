import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { crearHandler } from '../supabase/functions/alertas-stock/handler.js'

test('stock bajo: un aviso por episodio, se cancela al reponer y el servidor reclama una sola vez', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`)
    await db.exec(await readFile(new URL('../supabase/migrations/202611190001_catalogo_inventario.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/sql/alertas_stock.sql', import.meta.url), 'utf8'))
    assert.equal((await db.query('select * from public.alertas_stock')).rows.length, 6)
    const producto = '00000000-0000-4000-8000-000000000001'
    await db.query('update public.productos set stock=10 where id=$1', [producto])
    assert.equal((await db.query('select estado from public.alertas_stock where producto_id=$1', [producto])).rows[0].estado, 'cancelada')
    await db.query('update public.productos set stock=2 where id=$1', [producto])
    await db.query('update public.productos set stock=1 where id=$1', [producto])
    const alertas = (await db.query('select * from public.alertas_stock where producto_id=$1 and resuelta_en is null', [producto])).rows
    assert.equal(alertas.length, 1)
    const id = alertas[0].id
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from public.alertas_stock'), /permission denied/)
    await db.exec('reset role; set role authenticated')
    assert.equal((await db.query('select * from public.alertas_stock')).rows.length, 0)
    await assert.rejects(db.query('select * from public.tomar_alerta_stock($1)', [id]), /permission denied/)
    await db.exec('reset role; set role service_role')
    const tomada = (await db.query('select * from public.tomar_alerta_stock($1)', [id])).rows
    assert.equal(tomada.length, 1)
    assert.equal(Number(tomada[0].cantidad), 1)
    assert.equal((await db.query('select * from public.tomar_alerta_stock($1)', [id])).rows.length, 0)
    await db.exec('reset role')
    await db.query('update public.productos set stock=3 where id=$1', [producto])
    await db.query('update public.productos set stock=2 where id=$1', [producto])
    assert.equal((await db.query('select * from public.alertas_stock where producto_id=$1', [producto])).rows.length, 3)
  } finally { await db.close() }
})

const secreto = 'a'.repeat(40)
const alerta = { id: '92b9a10b-2e4f-49d1-af89-c7bb049445a7', nombre_producto: 'Camarón', cantidad: 1, minimo: 3, unidad: 'kg' }
const valores = { WHATSAPP_WEBHOOK_SECRET: secreto, WHATSAPP_ACCESS_TOKEN: 'token-de-prueba', WHATSAPP_PHONE_NUMBER_ID: '12345', WHATSAPP_TO: '526462757981', WHATSAPP_TEMPLATE_NAME: 'stock_bajo', WHATSAPP_TEMPLATE_LANGUAGE: 'es_MX', WHATSAPP_API_VERSION: 'v27.0' }
const request = (key = secreto) => new Request('https://example.test', { method: 'POST', headers: { 'x-webhook-secret': key }, body: JSON.stringify({ record: { id: alerta.id } }) })
function fixture({ config = valores, filas = [alerta], enviar } = {}) {
  const llamadas = [], estados = []
  const db = {
    rpc: async (...args) => { llamadas.push(args); return { data: filas } },
    from: () => ({ update: (estado) => ({ eq: async () => { estados.push(estado); return {} } }) }),
  }
  return { handler: crearHandler({ env: (key) => config[key], db, enviar }), llamadas, estados }
}
test('no reclama ni envía sin autenticación propia o configuración de Meta', async () => {
  const f = fixture()
  assert.equal((await f.handler(request('incorrecto'))).status, 401)
  assert.equal(f.llamadas.length, 0)
  const g = fixture({ config: { WHATSAPP_WEBHOOK_SECRET: secreto } })
  assert.equal((await g.handler(request())).status, 503)
  assert.equal(g.llamadas.length, 0)
})
test('un webhook repetido o resuelto no produce mensajes', async () => {
  const f = fixture({ filas: [], enviar: () => assert.fail('No debe enviar') })
  assert.equal((await f.handler(request())).status, 200)
  assert.equal(f.estados.length, 0)
})
test('la alerta usa destinatario fijo de servidor y los tres parámetros de la plantilla', async () => {
  const f = fixture({ enviar: async (url, options) => {
    assert.equal(url, 'https://graph.facebook.com/v27.0/12345/messages')
    const payload = JSON.parse(options.body)
    assert.equal(payload.to, '526462757981')
    assert.deepEqual(payload.template.components[0].parameters.map((p) => p.text), ['Camarón','1 kg','3 kg'])
    return Response.json({ messages: [{ id: 'wamid.test' }] })
  } })
  assert.equal((await f.handler(request())).status, 200)
  assert.equal(f.estados[0].estado, 'aceptada')
  assert.equal(f.estados[0].mensaje_id, 'wamid.test')
})
test('los fallos de red se registran como inciertos y los rechazos de Meta como rechazados', async () => {
  const f = fixture({ enviar: async () => { throw new Error('timeout') } })
  assert.equal((await f.handler(request())).status, 502)
  assert.equal(f.estados[0].estado, 'incierta')
  const g = fixture({ enviar: async () => Response.json({ error: { code: 132001 } }, { status: 400 }) })
  assert.equal((await g.handler(request())).status, 502)
  assert.equal(g.estados[0].estado, 'rechazada')
  assert.equal(g.estados[0].error_codigo, '132001')
})
