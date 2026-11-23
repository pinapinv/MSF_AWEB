// Precios y existencias de ejemplo autorizados; no son datos comerciales verificados.
export const productosDemo = [
  { id: 'demo-1', nombre: 'Filete de pescado', categoria: 'Pescados', precio: 180, unidad: 'kg', stock: 12, stock_minimo: 3, descripcion: '', foto_url: '/productos/filete.jpg', promocion: true },
  { id: 'demo-2', nombre: 'Camarón mediano', categoria: 'Mariscos', precio: 260, unidad: 'kg', stock: 8, stock_minimo: 2, descripcion: '', foto_url: '/productos/camaron.jpg', promocion: false },
  { id: 'demo-3', nombre: 'Pulpo', categoria: 'Mariscos', precio: 320, unidad: 'kg', stock: 0, stock_minimo: 2, descripcion: '', foto_url: '/productos/pulpo.jpg', promocion: false },
  { id: 'demo-4', nombre: 'Ostión', categoria: 'Moluscos', precio: 25, unidad: 'pieza', stock: 24, stock_minimo: 12, descripcion: '', foto_url: '/productos/ostion.jpg', promocion: false },
  { id: 'demo-5', nombre: 'Almeja', categoria: 'Moluscos', precio: 95, unidad: 'kg', stock: 2, stock_minimo: 3, descripcion: '', foto_url: '/productos/almeja.jpg', promocion: true },
  { id: 'demo-6', nombre: 'Pescado entero', categoria: 'Pescados', precio: 140, unidad: 'kg', stock: 10, stock_minimo: 3, descripcion: '', foto_url: '/productos/pescado.jpg', promocion: false },
]

// Conversión de datos de ejemplo; las piezas no equivalen a un peso conocido.
for (const producto of productosDemo) {
  if (producto.unidad === 'kg') {
    producto.precio *= 1000; producto.stock /= 1000; producto.stock_minimo /= 1000
  } else {
    producto.precio = null; producto.stock = 0; producto.stock_minimo = 0; producto.cotizacion_pendiente = true
  }
  producto.unidad = 'tonelada'
}
