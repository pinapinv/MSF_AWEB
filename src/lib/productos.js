export const moneda = (valor) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor)
export const normalizar = (valor) => valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function filtrarProductos(productos, { busqueda = '', categoria = '', precioMax = '', disponibles = false, promociones = false }) {
  return productos.filter((p) =>
    normalizar(p.nombre).includes(normalizar(busqueda)) &&
    (!categoria || p.categoria === categoria) &&
    (precioMax === '' || (!p.cotizacion_pendiente && p.precio <= Number(precioMax))) &&
    (!disponibles || (!p.cotizacion_pendiente && p.stock > 0)) && (!promociones || p.promocion),
  )
}

export function validarMovimiento(producto, tipo, cantidad) {
  if (producto.cotizacion_pendiente) return 'Confirma el peso y precio antes de registrar movimientos.'
  const numero = Number(cantidad)
  const escala = producto.unidad === 'tonelada' ? 1000000 : 1000
  if (!['entrada', 'merma'].includes(tipo)) return 'Tipo de movimiento inválido.'
  if (!Number.isFinite(numero) || numero <= 0) return 'La cantidad debe ser mayor que cero.'
  if (Math.abs(numero * escala - Math.round(numero * escala)) > 0.000001) return producto.unidad === 'tonelada' ? 'Usa como máximo seis decimales.' : 'Usa como máximo tres decimales.'
  if (producto.unidad === 'pieza' && !Number.isInteger(numero)) return 'Los productos por pieza requieren cantidades enteras.'
  if (tipo !== 'entrada' && numero > Number(producto.stock)) return 'No hay existencias suficientes.'
  return ''
}

export function enlaceContacto(producto, numero) {
  if (!/^\d{10,15}$/.test(numero || '')) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Hola, me interesa ${producto.nombre} al mayoreo por tonelada. ¿Me pueden confirmar disponibilidad y cotización?`)}`
}
