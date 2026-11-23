import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Fish, ShieldCheck, ShoppingCart } from 'lucide-react'
import { traerProductos } from './api/productos'
import { configurado } from './lib/supabase'
import { telefono, telefonoVisible } from './lib/contacto'

export default function Layout() {
  const [carrito, setCarrito] = useState(() => { try { const datos=JSON.parse(localStorage.getItem('msf-carrito') || '[]'); return Array.isArray(datos) ? datos.filter(l=>typeof l.producto_id==='string' && Number.isFinite(l.cantidad) && l.cantidad>0 && Number.isInteger(l.cantidad*2)).slice(0,20) : [] } catch { return [] } })
  useEffect(() => { try { localStorage.setItem('msf-carrito',JSON.stringify(carrito)) } catch { /* El carrito sigue disponible durante la sesión. */ } },[carrito])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const cargar = useCallback(async (signal) => {
    setCargando(true)
    setError('')
    try { const datos = await traerProductos(signal); if (!signal?.aborted) setProductos(datos) }
    catch { if (!signal?.aborted) setError('No se pudo cargar el catálogo. Revisa la conexión y vuelve a intentarlo.') }
    finally { if (!signal?.aborted) setCargando(false) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    traerProductos(controller.signal)
      .then((datos) => { if (!controller.signal.aborted) setProductos(datos) })
      .catch(() => { if (!controller.signal.aborted) setError('No se pudo cargar el catálogo. Revisa la conexión y vuelve a intentarlo.') })
      .finally(() => { if (!controller.signal.aborted) setCargando(false) })
    return () => controller.abort()
  }, [])
  return <>
    <div className="harbor-bar"><span>MARISCOS DE SAN FELIPE</span><span>COMERCIALIZADORA DE PRODUCTOS DEL MAR</span></div>
    <header className="site-header">
      <NavLink to="/" className="brand"><span className="brand-icon"><Fish /></span><span>Mariscos de San Felipe<small>EL SAUZAL, B.C. · MAYOREO</small></span></NavLink>
      <nav aria-label="Principal"><NavLink to="/" end>Catálogo</NavLink><NavLink to="/carrito"><ShoppingCart size={17} /> Carrito ({carrito.length})</NavLink><NavLink to="/admin"><ShieldCheck size={17} /> Administración</NavLink></nav>
    </header>
    <Outlet context={{ productos, cargando, error, recargar: cargar, configurado, carrito, setCarrito }} />
    <footer><span>Mariscos de San Felipe · El Sauzal, B.C.</span><div className="footer-contact"><a href={`tel:+${telefono}`}>{telefonoVisible}</a><a href="/creditos-fotos.html">Créditos de fotografías</a><a href={`https://wa.me/${telefono}`} target="_blank" rel="noreferrer">Contactar por WhatsApp</a></div></footer>
  </>
}
