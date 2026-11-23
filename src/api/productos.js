import { supabase } from '../lib/supabase'
import { productosDemo } from '../data/demo'

export async function traerProductos(signal) {
  if (!supabase) return productosDemo
  const { data, error } = await supabase.from('productos').select('*').order('nombre').abortSignal(signal)
  if (error) throw error
  return data
}

export async function guardarProducto(producto) {
  if (!supabase) throw new Error('Configura Supabase para guardar productos.')
  const { id, nombre, descripcion, categoria, unidad, precio, stock_minimo, foto_url, promocion, cotizacion_pendiente = false } = producto
  const datos = { nombre: nombre.trim(), descripcion: descripcion.trim(), categoria: categoria.trim(), unidad, precio: cotizacion_pendiente ? null : Number(precio), cotizacion_pendiente, stock_minimo: Number(stock_minimo), foto_url: foto_url.trim(), promocion }
  const { unidad: unidadNueva, ...cambios } = datos
  const consulta = id ? supabase.from('productos').update(cambios).eq('id', id) : supabase.from('productos').insert({ ...cambios, unidad: unidadNueva })
  const { error } = await consulta
  if (error) throw error
}

export async function registrarMovimiento({ productoId, tipo, cantidad, nota, solicitudId }) {
  const { error } = await supabase.rpc('registrar_movimiento', {
    p_producto: productoId, p_tipo: tipo, p_cantidad: Number(cantidad), p_nota: nota.trim(), p_solicitud: solicitudId,
  })
  if (error) throw error
}

export async function traerMovimientos() {
  const { data, error } = await supabase.from('movimientos').select('*, productos(nombre, unidad)').order('creado_en', { ascending: false }).limit(100)
  if (error) throw error
  return data
}

export async function registrarVenta({ productoId, cantidad, nota, solicitudId }) {
  const { error } = await supabase.rpc('registrar_venta', { p_producto: productoId, p_cantidad: Number(cantidad), p_nota: nota.trim(), p_solicitud: solicitudId })
  if (error) throw error
}

export async function traerVentas() {
  const { data, error } = await supabase.from('ventas').select('*').order('fecha', { ascending: false }).limit(100)
  if (error) throw error
  return data
}
