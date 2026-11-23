// Precios y existencias de ejemplo autorizados; no son datos comerciales verificados.
export const productosDemo = [
  { id: 'demo-1', nombre: 'Filete de pescado', categoria: 'Pescados', precio: 180, unidad: 'kg', stock: 12, stock_minimo: 3, descripcion: '', foto_url: '/productos/filete.jpg', promocion: true },
  { id: 'demo-2', nombre: 'Camarón mediano', categoria: 'Mariscos', precio: 260, unidad: 'kg', stock: 8, stock_minimo: 2, descripcion: '', foto_url: '/productos/camaron.jpg', promocion: false },
  { id: 'demo-3', nombre: 'Pulpo', categoria: 'Mariscos', precio: 320, unidad: 'kg', stock: 0, stock_minimo: 2, descripcion: '', foto_url: '/productos/pulpo.jpg', promocion: false },
  { id: 'demo-4', nombre: 'Ostión', categoria: 'Moluscos', precio: 25, unidad: 'pieza', stock: 24, stock_minimo: 12, descripcion: '', foto_url: '/productos/ostion.jpg', promocion: false },
  { id: 'demo-5', nombre: 'Almeja', categoria: 'Moluscos', precio: 95, unidad: 'kg', stock: 2, stock_minimo: 3, descripcion: '', foto_url: '/productos/almeja.jpg', promocion: true },
  { id: 'demo-6', nombre: 'Pescado entero', categoria: 'Pescados', precio: 140, unidad: 'kg', stock: 10, stock_minimo: 3, descripcion: '', foto_url: '/productos/pescado.jpg', promocion: false },
]

// Cantidades de ejemplo autorizadas: enteros y medios; mínimo de alerta de una tonelada.
const stockEjemplo = { 'demo-1': 5, 'demo-2': 3, 'demo-3': 1.5, 'demo-5': 1, 'demo-6': 4 }
for (const producto of productosDemo) {
  if (producto.unidad === 'kg') producto.precio *= 1000
  else { producto.precio = null; producto.cotizacion_pendiente = true }
  producto.unidad = 'tonelada'
  producto.stock = stockEjemplo[producto.id] ?? 0
  producto.stock_minimo = 1
}
