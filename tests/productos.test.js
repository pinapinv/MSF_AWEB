import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filtrarProductos, validarMovimiento, enlaceContacto } from '../src/lib/productos.js'
import { productosDemo } from '../src/data/demo.js'

test('búsqueda ignora acentos y combina categoría, precio, disponibilidad y promociones', () => {
  assert.equal(filtrarProductos(productosDemo, { busqueda: ' CAMARON ' })[0].nombre, 'Camarón mediano')
  assert.deepEqual(filtrarProductos(productosDemo, { categoria: 'Moluscos', precioMax: '100', disponibles: true, promociones: true }).map((p) => p.nombre), ['Almeja'])
  assert.equal(filtrarProductos(productosDemo, { precioMax: '0' }).length, 0)
  assert.equal(filtrarProductos(productosDemo, { busqueda: 'inexistente' }).length, 0)
})
test('merma rechaza excedentes, cantidades inválidas y fracciones de piezas', () => {
  const pieza = { unidad: 'pieza', stock: 5 }
  for (const cantidad of [0, -1, 6, 1.5, NaN, Infinity, '']) assert.ok(validarMovimiento(pieza, 'merma', cantidad))
  assert.equal(validarMovimiento(pieza, 'merma', 5), '')
  assert.equal(validarMovimiento({ unidad: 'kg', stock: 2.5 }, 'merma', '0.125'), '')
  assert.ok(validarMovimiento({ unidad: 'kg', stock: 2.5 }, 'entrada', '0.0001'))
  assert.ok(validarMovimiento(pieza, 'inventado', 1))
})
test('contacto no inventa teléfono y codifica el producto', () => {
  assert.equal(enlaceContacto(productosDemo[0], ''), null)
  assert.equal(enlaceContacto(productosDemo[0], 'no valido'), null)
  const url = new URL(enlaceContacto({ nombre: 'Pescado & mariscos' }, '521234567890'))
  assert.equal(url.hostname, 'wa.me')
  assert.match(url.searchParams.get('text'), /Pescado & mariscos/)
})
