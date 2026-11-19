import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Fish, ShieldCheck } from 'lucide-react'
import { traerProductos } from './api/productos'
import { configurado } from './lib/supabase'

export default function Layout() {
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
    <div className="demo-strip">Proyecto académico · Datos de prueba · Nombre e identidad provisionales</div>
    <header className="site-header">
      <NavLink to="/" className="brand"><span className="brand-icon"><Fish /></span><span>Catálogo del mar<small>EL SAUZAL · PROYECTO MSF</small></span></NavLink>
      <nav aria-label="Principal"><NavLink to="/" end>Catálogo</NavLink><NavLink to="/admin"><ShieldCheck size={17} /> Administración</NavLink></nav>
    </header>
    <Outlet context={{ productos, cargando, error, recargar: cargar, configurado }} />
    <footer><span>MSF · Aplicaciones Web</span><span>{configurado ? 'Entorno académico con Supabase' : 'Demostración · Sin conexión a base de datos'}</span></footer>
  </>
}
