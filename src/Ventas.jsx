import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { moneda } from './lib/productos'
import { registrarVenta, traerVentas } from './api/productos'

export default function Ventas({ productos, recargar }) {
  const [ventas, setVentas] = useState([])
  const [errorHistorial, setErrorHistorial] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [solicitudId, setSolicitudId] = useState(() => crypto.randomUUID())
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const producto = productos.find((p) => p.id === productoId)
  const total = producto ? Math.round(Number(cantidad) * Number(producto.precio) * 100) / 100 : 0
  useEffect(() => {
    let activo = true
    traerVentas().then((data) => { if (activo) setVentas(data) }).catch(() => { if (activo) setErrorHistorial('No se pudo consultar el historial de ventas.') })
    return () => { activo = false }
  }, [])
  async function vender(event) {
    event.preventDefault()
    if (!producto || producto.cotizacion_pendiente || !confirmado) return
    setOcupado(true); setError(''); setMensaje('')
    try {
      await registrarVenta({ productoId, cantidad, nota, solicitudId })
      setCantidad(''); setNota(''); setConfirmado(false); setSolicitudId(crypto.randomUUID())
      setMensaje('Venta registrada. El inventario y el historial se actualizaron.')
      await recargar()
      try { setVentas(await traerVentas()); setErrorHistorial('') }
      catch { setErrorHistorial('La venta se guardó. No se pudo recargar el historial; actualiza la página.') }
    } catch (fallo) { setError(fallo.message || 'No se pudo registrar la venta.') }
    finally { setOcupado(false) }
  }
  return <section className="sales-page">
    <form className="editor" onSubmit={vender}>
      <h2>Registrar venta</h2><p className="muted">Registra aquí las ventas acordadas por WhatsApp o en el negocio, después de confirmar el pago. Cada registro corresponde a un producto.</p>
      {error && <p className="notice error" role="alert">{error}</p>}{mensaje && <p className="notice success" role="status">{mensaje}</p>}
      <fieldset disabled={ocupado}><div className="form-grid">
        <label>Producto<select required value={productoId} onChange={(e) => setProductoId(e.target.value)}><option value="">Selecciona un producto</option>{productos.map((p) => <option key={p.id} value={p.id} disabled={p.cotizacion_pendiente || Number(p.stock) <= 0}>{p.nombre}{p.cotizacion_pendiente ? ' · Peso y precio pendientes' : Number(p.stock) <= 0 ? ' · Agotado' : ''}</option>)}</select></label>
        <label>Cantidad{producto ? ` (${producto.unidad})` : ''}<input required type="number" min={producto?.unidad === 'tonelada' ? '0.000001' : '0.001'} step={producto?.unidad === 'tonelada' ? '0.000001' : '0.001'} max={producto?.stock || undefined} value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></label>
        <label className="full-width">Referencia o nota (opcional)<textarea maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Referencia de la venta o entrega" /></label>
      </div>
      {producto && <div className="sale-total"><span>Existencias: {producto.stock} {producto.unidad} · Precio: {moneda(producto.precio)} / {producto.unidad}</span><strong>Total: {moneda(Number.isFinite(total) ? total : 0)}</strong></div>}
      <label className="check"><input type="checkbox" required checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Confirmo que la venta fue acordada y el pago recibido.</label>
      <Button type="submit" disabled={ocupado || !producto || producto.cotizacion_pendiente || !confirmado}>{ocupado ? 'Registrando…' : 'Confirmar venta y descontar stock'}</Button>
      </fieldset>
    </form>
    <h2>Ventas registradas</h2><p className="muted">Últimas 100 ventas · Total mostrado: {moneda(ventas.reduce((s, v) => s + Number(v.monto), 0))}</p>
    {errorHistorial && <p role="alert" className="notice error">{errorHistorial}</p>}
    <div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Monto</th><th>Referencia</th></tr></thead><tbody>{ventas.map((v) => <tr key={v.id}><td>{new Date(v.fecha).toLocaleString('es-MX', { timeZone: 'America/Tijuana' })}</td><td>{v.nombre_producto}</td><td>{v.cantidad} {v.unidad}</td><td>{moneda(v.precio_unitario)}</td><td>{moneda(v.monto)}</td><td>{v.nota || '—'}</td></tr>)}</tbody></table>{!ventas.length && !errorHistorial && <p className="empty">Aún no se han registrado ventas.</p>}</div>
  </section>
}
