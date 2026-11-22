import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router'
import { Dialog } from '@base-ui/react/dialog'
import { Search, SlidersHorizontal, X, MessageCircle, Waves } from 'lucide-react'
import { Button } from './components/ui/button'
import ProductoImagen from './components/ui/ProductoImagen'
import { enlaceContacto, filtrarProductos, moneda } from './lib/productos'

const filtrosIniciales = { busqueda: '', categoria: '', precioMax: '', disponibles: false, promociones: false }
export default function App() {
  const { productos, cargando, error, recargar } = useOutletContext()
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const [seleccionado, setSeleccionado] = useState(null)
  const categorias = [...new Set(productos.map((p) => p.categoria))].sort()
  const resultados = useMemo(() => filtrarProductos(productos, filtros), [productos, filtros])
  const cambiar = (clave, valor) => setFiltros((prev) => ({ ...prev, [clave]: valor }))
  const contacto = seleccionado && enlaceContacto(seleccionado, import.meta.env.VITE_WHATSAPP_NUMBER)
  return <main className="container">
    <section className="hero">
      <div><p className="eyebrow">PESCADOS Y MARISCOS</p><h1>Del mar<br /><em>lo más natural</em></h1><p>Explora nuestros productos y consulta su disponibilidad.<br className="desktop-break" /> Elige lo que buscas y contáctanos por WhatsApp.</p><a href="#catalogo" className="button button-light">Explorar catálogo</a></div>
      <div className="hero-art" aria-hidden="true"><Waves className="wave wave-one" /><Waves className="wave wave-two" /><span>EL SAUZAL<br /><b>Productos<br />del mar</b><small>CATÁLOGO DE DEMOSTRACIÓN</small></span></div>
    </section>
    <section id="catalogo" className="catalog">
      <div className="section-title"><div><p className="eyebrow">NUESTRO CATÁLOGO</p><h2>Encuentra tu favorito</h2></div><span className="muted">Precios de ejemplo en MXN</span></div>
      <div className="catalog-layout">
        <aside className="filters"><h3><SlidersHorizontal size={18} /> Filtrar productos</h3><label>Buscar<div className="search-field"><Search size={18} /><input value={filtros.busqueda} placeholder="Nombre del producto" onChange={(e) => cambiar('busqueda', e.target.value)} type="search" /></div></label>
          <label>Categoría<select value={filtros.categoria} onChange={(e) => cambiar('categoria', e.target.value)}><option value="">Todas las categorías</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Precio máximo (MXN)<input type="number" min="0" step="0.01" placeholder="Sin límite" value={filtros.precioMax} onChange={(e) => cambiar('precioMax', e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={filtros.disponibles} onChange={(e) => cambiar('disponibles', e.target.checked)} /> Solo disponibles</label>
          <label className="check"><input type="checkbox" checked={filtros.promociones} onChange={(e) => cambiar('promociones', e.target.checked)} /> Promociones</label>
          <Button variant="outline" onClick={() => setFiltros(filtrosIniciales)}>Limpiar filtros</Button>
          <p className="filter-note">Las ventas se acuerdan directamente con el negocio por WhatsApp.</p>
        </aside>
        <div className="results"><p className="result-count" aria-live="polite">{cargando ? 'Cargando catálogo…' : `${resultados.length} ${resultados.length === 1 ? 'producto' : 'productos'}`}</p>
          {error ? <div role="alert" className="notice error">{error}<Button onClick={() => recargar()}>Reintentar</Button></div> : cargando ? <div className="empty">Consultando productos…</div> : resultados.length ? <div className="product-grid">{resultados.map((p) => <article className="product-card" key={p.id}>
            <button className="image-button" onClick={() => setSeleccionado(p)} aria-label={`Ver detalles de ${p.nombre}`}><ProductoImagen producto={p} /></button>
            <div className="card-body"><div className="card-meta"><span>{p.categoria}</span>{p.promocion && <span className="promo">Promoción</span>}</div><h3>{p.nombre}</h3><span className={`stock ${p.stock > 0 ? '' : 'sold-out'}`}>{p.stock > 0 ? 'En stock' : 'Agotado'}</span><div className="card-bottom"><p><strong>{moneda(p.precio)}</strong><span> / {p.unidad}</span></p><Button variant="outline" onClick={() => setSeleccionado(p)}>Ver detalle</Button></div></div>
          </article>)}</div> : <div className="empty"><Search size={32} /><h3>No encontramos productos</h3><p>Prueba otra búsqueda o limpia los filtros.</p><Button onClick={() => setFiltros(filtrosIniciales)}>Ver todos</Button></div>}
        </div>
      </div>
    </section>
    <Dialog.Root open={Boolean(seleccionado)} onOpenChange={(open) => { if (!open) setSeleccionado(null) }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog-popup">
      {seleccionado && <><Dialog.Close className="close-button" aria-label="Cerrar detalle"><X /></Dialog.Close><ProductoImagen producto={seleccionado} /><div className="detail-body"><p className="eyebrow">{seleccionado.categoria}</p><Dialog.Title>{seleccionado.nombre}</Dialog.Title><Dialog.Description>{seleccionado.descripcion || 'Consulta al negocio para conocer más detalles.'}</Dialog.Description><p className="detail-price">{moneda(seleccionado.precio)} <small>/ {seleccionado.unidad}</small></p><p>{seleccionado.stock > 0 ? 'Disponible en catálogo' : 'Actualmente agotado'}</p>{contacto ? <a className="button button-primary" href={contacto} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Consultar por WhatsApp</a> : <p className="notice">El contacto se habilitará cuando el negocio proporcione su número.</p>}</div></>}
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  </main>
}
