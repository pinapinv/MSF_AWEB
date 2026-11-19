export const moneda = (valor) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor)
export const normalizar = (valor) => valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function filtrarProductos(productos, { busqueda = '', categoria = '', precioMax = '', disponibles = false, promociones = false }) {
  return productos.filter((p) =>
    normalizar(p.nombre).includes(normalizar(busqueda)) &&
    (!categoria || p.categoria === categoria) &&
    (precioMax === '' || p.precio <= Number(precioMax)) &&
    (!disponibles || p.stock > 0) && (!promociones || p.promocion),
  )
}

export function validarMovimiento(producto, tipo, cantidad) {
  const numero = Number(cantidad)
  if (!['entrada', 'merma'].includes(tipo)) return 'Tipo de movimiento inválido.'
  if (!Number.isFinite(numero) || numero <= 0) return 'La cantidad debe ser mayor que cero.'
  if (Math.abs(numero * 1000 - Math.round(numero * 1000)) > 0.000001) return 'Usa como máximo tres decimales.'
  if (producto.unidad === 'pieza' && !Number.isInteger(numero)) return 'Los productos por pieza requieren cantidades enteras.'
  if (tipo !== 'entrada' && numero > Number(producto.stock)) return 'No hay existencias suficientes.'
  return ''
}

export function enlaceContacto(producto, numero) {
  if (!/^\d{10,15}$/.test(numero || '')) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Hola, me interesa ${producto.nombre}. ¿Me pueden dar información?`)}`
}
