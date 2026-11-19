import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('PostgreSQL: RLS, permisos, stock atómico e idempotencia', async () => {
  const db = new PGlite()
  try {
    // Sustitutos mínimos de Supabase Auth; el esquema de la aplicación es el real.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/202611190001_catalogo_inventario.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
    await db.exec(`insert into public.administradores values ('10000000-0000-4000-8000-000000000001')`)
    const producto = '00000000-0000-4000-8000-000000000001'
    const mover = (tipo, cantidad, solicitud = crypto.randomUUID(), id = producto) => db.query(
      'select public.registrar_movimiento($1, $2, $3, $4, $5)', [id, tipo, cantidad, '', solicitud],
    )
    const stock = async () => Number((await db.query('select stock from public.productos where id = $1', [producto])).rows[0].stock)
    await db.exec('set role anon')
    assert.equal((await db.query('select * from public.productos')).rows.length, 6)
    await assert.rejects(db.query('select * from public.movimientos'), /permission denied/)
    await assert.rejects(mover('entrada', 1), /permission denied/)
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false)`)
    assert.equal((await db.query('select * from public.administradores')).rows.length, 0)
    await assert.rejects(mover('entrada', 1), /Acceso no autorizado/)
    await assert.rejects(db.query("insert into public.productos(nombre,categoria,unidad,precio) values ('Prueba','Pescados','kg',10)"), /row-level security/)
    await assert.rejects(db.query("insert into public.administradores values ('10000000-0000-4000-8000-000000000002')"), /permission denied/)
    await db.exec(`select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false)`)
    await db.query("insert into public.productos(nombre,categoria,unidad,precio) values ('Prueba','Pescados','kg',10)")
    await db.query('update public.productos set precio = 190 where id = $1', [producto])
    await assert.rejects(db.query('update public.productos set stock = 100 where id = $1', [producto]), /permission denied/)
    const solicitud = crypto.randomUUID()
    await mover('entrada', 5.5, solicitud)
    await mover('entrada', 5.5, solicitud)
    assert.equal(await stock(), 5.5)
    assert.equal((await db.query('select * from public.movimientos')).rows.length, 1)
    await assert.rejects(mover('entrada', 6, solicitud), /otros datos/)
    await assert.rejects(mover('merma', 6), /existencias suficientes/)
    assert.equal(await stock(), 5.5)
    await assert.rejects(mover('entrada', 0.0001), /Cantidad inválida/)
    await assert.rejects(mover('entrada', 'NaN'), /Cantidad inválida/)
    await assert.rejects(mover('entrada', 1.5, crypto.randomUUID(), '00000000-0000-4000-8000-000000000004'), /piezas deben ser enteras/)
    await mover('merma', 5.5)
    assert.equal(await stock(), 0)
    const historial = (await db.query('select stock_resultante from public.movimientos order by creado_en')).rows
    assert.deepEqual(historial.map((m) => Number(m.stock_resultante)), [5.5, 0])
    await db.exec(`select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false)`)
    assert.equal((await db.query('select * from public.movimientos')).rows.length, 0)
  } finally { await db.close() }
})
