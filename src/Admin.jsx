import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, useOutletContext } from 'react-router'
import { Dialog } from '@base-ui/react/dialog'
import { Package, TriangleAlert, Plus, LogOut, History } from 'lucide-react'
import { supabase } from './lib/supabase'
import { moneda, validarMovimiento } from './lib/productos'
import { guardarProducto, registrarMovimiento, traerMovimientos } from './api/productos'
import { Button } from './components/ui/button'
import Ventas from './Ventas'
import Alertas from './Alertas'

const nuevoProducto = { nombre: '', descripcion: '', categoria: 'Pescados', unidad: 'tonelada', cotizacion_pendiente: false, precio: '', stock_minimo: '1', foto_url: '', promocion: false }
export default function Admin({ inventario = false, ventas = false, alertas = false }) {
  const { productos, recargar, error: errorCatalogo, cargando } = useOutletContext()
  const [acceso, setAcceso] = useState('verificando')
  const [editor, setEditor] = useState(null)
  const [movimiento, setMovimiento] = useState(null)
  const [historial, setHistorial] = useState([])
  const [historialError, setHistorialError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let activo = true
    let revision = 0
    async function revisar(session) {
      const actual = ++revision
      if (!session) { if (activo) setAcceso('login'); return }
      try {
        const { data, error: fallo } = await supabase.from('administradores').select('usuario_id').eq('usuario_id', session.user.id).maybeSingle()
        if (activo && actual === revision) setAcceso(fallo ? 'error' : data ? 'permitido' : 'denegado')
      } catch {
        if (activo && actual === revision) setAcceso('error')
      }
    }
    supabase.auth.getSession().then(({ data, error: fallo }) => {
      if (fallo) { if (activo) setAcceso('error') } else revisar(data.session)
    }).catch(() => { if (activo) setAcceso('error') })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Ejecutar fuera del callback de Auth para evitar bloquear el cliente.
      setTimeout(() => { if (activo) revisar(session) }, 0)
    })
    return () => { activo = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (acceso !== 'permitido') return
    let activo = true
    traerMovimientos().then((data) => { if (activo) setHistorial(data) }).catch(() => { if (activo) setHistorialError('No se pudo cargar el historial.') })
    return () => { activo = false }
  }, [acceso, ventas])
  async function salir() {
    const { error: fallo } = await supabase.auth.signOut()
    if (fallo) setError('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    else setAcceso('login')
  }
  async function guardar(event) {
    event.preventDefault()
    setOcupado(true); setError(''); setMensaje('')
    try {
      await guardarProducto(editor)
      setEditor(null)
      setMensaje('Producto guardado. Las existencias se modifican desde Inventario.')
      await recargar()
    } catch (fallo) { setError(fallo.message || 'No se pudo guardar el producto.') }
    finally { setOcupado(false) }
  }
  async function mover(event) {
    event.preventDefault()
    const producto = productos.find((p) => p.id === movimiento.productoId)
    const validacion = validarMovimiento(producto, movimiento.tipo, movimiento.cantidad)
    if (validacion) { setError(validacion); return }
    setOcupado(true); setError(''); setMensaje('')
    try {
      await registrarMovimiento(movimiento)
      setMovimiento(null); setMensaje('Movimiento registrado y existencias actualizadas.')
      await recargar()
      try { setHistorial(await traerMovimientos()); setHistorialError('') }
      catch { setHistorialError('El movimiento se guardó, pero no se pudo actualizar el historial. Recarga la página.') }
    } catch (fallo) { setError(fallo.message || 'No se pudo registrar el movimiento.') }
    finally { setOcupado(false) }
  }
  if (!supabase || acceso === 'login') return <Navigate to="/login" replace />
  if (acceso === 'verificando') return <main className="container empty" role="status">Verificando acceso…</main>
  if (acceso !== 'permitido') return <main className="container empty"><h1>{acceso === 'error' ? 'No pudimos verificar el acceso' : 'Acceso no autorizado'}</h1><p>{acceso === 'error' ? 'Revisa la conexión y la configuración de Supabase.' : 'Tu cuenta no está habilitada como administrador.'}</p><Button onClick={salir}>Cerrar sesión</Button><Link to="/">Volver al catálogo</Link></main>
  const bajos = productos.filter((p) => !p.cotizacion_pendiente && Number(p.stock) < Number(p.stock_minimo))
  const campo = (clave, valor) => setEditor((prev) => ({ ...prev, [clave]: valor }))
  return <main className="container admin-page"><div className="section-title"><div><p className="eyebrow">PANEL ADMINISTRATIVO</p><h1>{alertas ? 'Alertas de inventario' : ventas ? 'Ventas' : inventario ? 'Inventario' : 'Productos e inventario'}</h1></div><Button variant="outline" onClick={salir}><LogOut size={17} /> Salir</Button></div>
    <nav className="admin-nav" aria-label="Administración"><NavLink to="/admin" end>Productos</NavLink><NavLink to="/admin/inventario">Inventario</NavLink><NavLink to="/admin/ventas">Ventas</NavLink><NavLink to="/admin/alertas">Alertas</NavLink></nav>
    <div className="stats"><article><Package /><span>Productos</span><strong>{productos.length}</strong></article><article><TriangleAlert /><span>Por debajo del mínimo</span><strong>{bajos.length}</strong></article><article><Package /><span>Agotados</span><strong>{productos.filter((p) => !p.cotizacion_pendiente && Number(p.stock) === 0).length}</strong></article></div>
    {mensaje && <p role="status" className="notice success">{mensaje}</p>}{error && <p role="alert" className="notice error">{error}</p>}
    {errorCatalogo && <p role="alert" className="notice error">{errorCatalogo}<Button onClick={() => recargar()}>Reintentar</Button></p>}
    {bajos.length > 0 && <div className="notice stock-warning" role="status"><strong>Inventario bajo:</strong> {bajos.map((p) => `${p.nombre}: ${p.stock} ${p.unidad} (mínimo ${p.stock_minimo})`).join('; ')}. <Link to="/admin/alertas">Ver alertas</Link></div>}
    {alertas ? <Alertas /> : ventas ? <Ventas productos={productos} recargar={recargar} /> : <>
    <div className="admin-toolbar"><h2>Catálogo de productos</h2><Button disabled={ocupado} onClick={() => { setEditor({ ...nuevoProducto }); setMovimiento(null); setError('') }}><Plus size={18} /> Nuevo producto</Button></div>
    {editor && <form className="editor" onSubmit={guardar}><h2>{editor.id ? 'Editar producto' : 'Nuevo producto'}</h2><div className="form-grid">
      <label>Nombre<input required maxLength={120} value={editor.nombre} onChange={(e) => campo('nombre', e.target.value)} /></label>
      <label>Categoría<input required maxLength={60} value={editor.categoria} onChange={(e) => campo('categoria', e.target.value)} list="categorias" /><datalist id="categorias"><option>Pescados</option><option>Mariscos</option><option>Moluscos</option></datalist></label>
      <label>Precio (MXN / tonelada)<input required={!editor.cotizacion_pendiente} disabled={editor.cotizacion_pendiente} type="number" min="0.01" step="0.01" max="9999999" value={editor.precio ?? ''} onChange={(e) => campo('precio', e.target.value)} /></label>
      <label>Unidad<select disabled={Boolean(editor.id)} value={editor.unidad} onChange={(e) => campo('unidad', e.target.value)}><option value="tonelada">Tonelada</option></select></label>
      <label>Stock mínimo (toneladas)<input readOnly required type="number" min="1" max="1" step={editor.unidad === 'tonelada' ? '0.5' : '0.001'} value={editor.stock_minimo} onChange={(e) => campo('stock_minimo', e.target.value)} /></label>
      <label>URL de foto (HTTPS, opcional)<input type="url" pattern="https://.*" maxLength={2048} placeholder="https://…" value={editor.foto_url} onChange={(e) => campo('foto_url', e.target.value)} /></label>
      <label className="full-width">Descripción<textarea maxLength={1000} value={editor.descripcion} onChange={(e) => campo('descripcion', e.target.value)} /></label>
      <label className="check full-width"><input type="checkbox" checked={editor.cotizacion_pendiente || false} onChange={(e) => campo('cotizacion_pendiente', e.target.checked)} /> Peso y precio pendientes de confirmar (bloquea movimientos y ventas)</label><label className="check"><input type="checkbox" checked={editor.promocion} onChange={(e) => campo('promocion', e.target.checked)} /> Mostrar en promociones</label>
    </div><p className="muted">Precios por tonelada. Cantidades enteras o medias: 0.5, 1, 1.5... El mínimo para alertas es 1 tonelada. Si el peso está pendiente, confirma el precio, desmarca la casilla y guarda; después registra el peso real como entrada. Los productos nuevos inician con cero existencias. Registra una entrada para agregar mercancía. La unidad no se cambia después de crear el producto.</p><div className="actions"><Button type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar producto'}</Button><Button variant="outline" disabled={ocupado} onClick={() => setEditor(null)}>Cancelar</Button></div></form>}
    <Dialog.Root open={Boolean(movimiento)} onOpenChange={(open) => { if (!open && !ocupado) { setMovimiento(null); setError('') } }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog-popup inventory-dialog">
      {movimiento && <form className="inventory-form" onSubmit={mover}><Dialog.Title>Movimiento de inventario</Dialog.Title><Dialog.Description>{productos.find((p) => p.id === movimiento.productoId)?.nombre} · Existencias: {productos.find((p) => p.id === movimiento.productoId)?.stock} {productos.find((p) => p.id === movimiento.productoId)?.unidad}</Dialog.Description>{error && <p role="alert" className="notice error">{error}</p>}<div className="form-grid"><label>Tipo<select value={movimiento.tipo} onChange={(e) => setMovimiento({ ...movimiento, tipo: e.target.value })}><option value="entrada">Entrada de mercancía</option><option value="merma">Salida por merma</option></select></label><label>Cantidad ({productos.find((p) => p.id === movimiento.productoId)?.unidad})<input required type="number" min={productos.find((p) => p.id === movimiento.productoId)?.unidad === 'tonelada' ? '0.5' : '0.001'} max="9999999" step={productos.find((p) => p.id === movimiento.productoId)?.unidad === 'tonelada' ? '0.5' : '0.001'} value={movimiento.cantidad} onChange={(e) => setMovimiento({ ...movimiento, cantidad: e.target.value })} /></label><label className="full-width">Nota<textarea maxLength={500} value={movimiento.nota} onChange={(e) => setMovimiento({ ...movimiento, nota: e.target.value })} /></label></div><div className="actions"><Button type="submit" disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar movimiento'}</Button><Button variant="outline" disabled={ocupado} onClick={() => { setMovimiento(null); setError('') }}>Cancelar</Button></div></form>}
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
    <div className="table-wrapper"><table><thead><tr><th>Producto</th><th>Precio</th><th>Existencias</th><th>Mínimo</th><th>Acciones</th></tr></thead><tbody>{productos.map((p) => <tr key={p.id}><td><strong>{p.nombre}</strong><small>{p.categoria}</small></td><td>{p.cotizacion_pendiente ? 'Por cotizar' : `${moneda(p.precio)} / ${p.unidad}`}</td><td><span className={p.stock < p.stock_minimo ? 'low-stock' : ''}>{p.cotizacion_pendiente ? 'Peso pendiente' : `${p.stock} ${p.unidad}`}</span></td><td>{p.cotizacion_pendiente ? 'Por definir' : `${p.stock_minimo} ${p.unidad}`}</td><td className="table-actions"><Button variant="outline" disabled={ocupado} onClick={() => { setEditor({ ...p }); setMovimiento(null); setError('') }}>Editar</Button><Button variant="outline" disabled={ocupado || p.cotizacion_pendiente} onClick={() => { setMovimiento({ productoId: p.id, tipo: 'entrada', cantidad: '', nota: '', solicitudId: crypto.randomUUID() }); setEditor(null); setError('') }}>Inventario</Button></td></tr>)}</tbody></table>{!productos.length && <p className="empty">{cargando ? 'Cargando productos…' : 'Aún no hay productos. Crea el primero para comenzar.'}</p>}</div>
    <section className="history"><h2><History size={22} /> Historial de movimientos</h2><p className="muted">Últimos 100 movimientos. Cada registro conserva las existencias resultantes.</p>{historialError && <p className="notice error" role="alert">{historialError}</p>}<div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Stock resultante</th><th>Nota</th></tr></thead><tbody>{historial.map((m) => <tr key={m.id}><td>{new Date(m.creado_en).toLocaleString('es-MX', { timeZone: 'America/Tijuana' })}</td><td>{m.productos?.nombre}</td><td>{m.tipo}</td><td>{m.cantidad} {m.unidad || m.productos?.unidad}</td><td>{m.stock_resultante} {m.unidad || m.productos?.unidad}</td><td>{m.nota || '—'}</td></tr>)}</tbody></table>{!historial.length && !historialError && <p className="empty">Sin movimientos registrados.</p>}</div></section>
    </>}
  </main>
}
