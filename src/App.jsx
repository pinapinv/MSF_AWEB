import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router'
import { Dialog } from '@base-ui/react/dialog'
import { Search, SlidersHorizontal, X, MessageCircle, Anchor, MapPin, Ship } from 'lucide-react'
import { Button } from './components/ui/button'
import ProductoImagen from './components/ui/ProductoImagen'
import { enlaceContacto, filtrarProductos, moneda } from './lib/productos'
import { telefono, telegramBot, enlacePedidoTelegram } from './lib/contacto'

const filtrosIniciales = { busqueda: '', categoria: '', precioMax: '', disponibles: false, promociones: false }
export default function App() {
  const { productos, cargando, error, recargar } = useOutletContext()
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const [seleccionado, setSeleccionado] = useState(null)
  const categorias = [...new Set(productos.map((p) => p.categoria))].sort()
  const resultados = useMemo(() => filtrarProductos(productos, filtros), [productos, filtros])
  const cambiar = (clave, valor) => setFiltros((prev) => ({ ...prev, [clave]: valor }))
  const contacto = seleccionado && enlaceContacto(seleccionado, telefono)
  const pedido = seleccionado && enlacePedidoTelegram(seleccionado)
  return <main className="container">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><Anchor size={17} /> COMERCIALIZADORA · VENTA AL MAYOREO</p><h1>Del mar<br /><em>lo más natural</em></h1><p>Consulta disponibilidad y elige la opción que más te guste. Solicita por Telegram para concretar la venta.</p><a href="#catalogo" className="button button-light">Explorar catálogo</a><span className="hero-location"><MapPin size={15} /> El Sauzal, Baja California</span></div>
      <div className="hero-art" aria-hidden="true"><div className="marine-photo"><img src="/productos/camaron.jpg" alt="" fetchPriority="high" /></div><div className="marine-photo-small"><img src="/productos/pescado.jpg" alt="" /></div><div className="marine-seal"><Anchor size={27} /><span>MARISCOS DE<br /><b>SAN FELIPE</b><small>EL SAUZAL · B.C.</small></span></div></div>
      <svg className="hero-swell" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 55 Q150 0 300 45 T600 45 T900 45 T1200 45 V100 H0Z" fill="currentColor" /><path d="M0 65 Q150 10 300 55 T600 55 T900 55 T1200 55" fill="none" stroke="#e3ba78" strokeWidth="1" /></svg>
    </section>
    <div className="marine-strip"><span><Ship size={21} /> Comercialización de productos del mar</span><span><Anchor size={21} /> Venta por tonelada</span><a href={telegramBot} target="_blank" rel="noreferrer"><MessageCircle size={21} /> Solicitudes por Telegram</a></div>
    <section id="catalogo" className="catalog">
      <div className="section-title"><div><p className="eyebrow">DEL MAR A TU NEGOCIO</p><h2>Nuestros productos</h2></div><span className="catalog-currency">Mayoreo · MXN por tonelada</span></div>
      <div className="catalog-layout">
        <aside className="filters"><h3><SlidersHorizontal size={18} /> Filtrar productos</h3><label>Buscar<div className="search-field"><Search size={18} /><input value={filtros.busqueda} placeholder="Nombre del producto" onChange={(e) => cambiar('busqueda', e.target.value)} type="search" /></div></label>
          <label>Categoría<select value={filtros.categoria} onChange={(e) => cambiar('categoria', e.target.value)}><option value="">Todas las categorías</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Precio máximo (MXN / tonelada)<input type="number" min="0" step="0.01" placeholder="Sin límite" value={filtros.precioMax} onChange={(e) => cambiar('precioMax', e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={filtros.disponibles} onChange={(e) => cambiar('disponibles', e.target.checked)} /> Solo disponibles</label>
          <label className="check"><input type="checkbox" checked={filtros.promociones} onChange={(e) => cambiar('promociones', e.target.checked)} /> Promociones</label>
          <Button variant="outline" onClick={() => setFiltros(filtrosIniciales)}>Limpiar filtros</Button>
          <p className="filter-note">Solicita el producto por Telegram. El negocio confirma la venta; el stock se descuenta al aceptarla.</p>
        </aside>
        <div className="results"><p className="result-count" aria-live="polite">{cargando ? 'Cargando catálogo…' : `${resultados.length} ${resultados.length === 1 ? 'producto' : 'productos'}`}</p>
          {error ? <div role="alert" className="notice error">{error}<Button onClick={() => recargar()}>Reintentar</Button></div> : cargando ? <div className="empty">Consultando productos…</div> : resultados.length ? <div className="product-grid">{resultados.map((p) => <article className="product-card" key={p.id}>
            <button className="image-button" onClick={() => setSeleccionado(p)} aria-label={`Ver detalles de ${p.nombre}`}><ProductoImagen producto={p} /></button>
            <div className="card-body"><div className="card-meta"><span>{p.categoria}</span>{p.promocion && <span className="promo">Promoción</span>}</div><h3>{p.nombre}</h3><span className={`stock ${p.cotizacion_pendiente ? 'quote-pending' : p.stock > 0 ? '' : 'sold-out'}`}>{p.cotizacion_pendiente ? 'Peso por confirmar' : p.stock > 0 ? 'Disponible' : 'Agotado'}</span><div className="card-bottom"><p><strong>{p.cotizacion_pendiente ? 'Por cotizar' : moneda(p.precio)}</strong><span> por tonelada</span></p><Button variant="outline" onClick={() => setSeleccionado(p)}>Ver detalle</Button></div></div>
          </article>)}</div> : <div className="empty"><Search size={32} /><h3>No encontramos productos</h3><p>Prueba otra búsqueda o limpia los filtros.</p><Button onClick={() => setFiltros(filtrosIniciales)}>Ver todos</Button></div>}
        </div>
      </div>
    </section>
    <Dialog.Root open={Boolean(seleccionado)} onOpenChange={(open) => { if (!open) setSeleccionado(null) }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog-popup">
      {seleccionado && <><Dialog.Close className="close-button" aria-label="Cerrar detalle"><X /></Dialog.Close><ProductoImagen producto={seleccionado} /><div className="detail-body"><p className="eyebrow">{seleccionado.categoria} · MAYOREO</p><Dialog.Title>{seleccionado.nombre}</Dialog.Title><Dialog.Description>{seleccionado.descripcion || 'Consulta al negocio para conocer más detalles.'}</Dialog.Description><p className="detail-price">{seleccionado.cotizacion_pendiente ? 'Por cotizar' : moneda(seleccionado.precio)} <small>por tonelada</small></p><p>{seleccionado.cotizacion_pendiente ? 'Peso disponible y precio pendientes de confirmar. Solicita una cotización.' : seleccionado.stock > 0 ? 'Disponible en catálogo' : 'Actualmente agotado'}</p>{!seleccionado.cotizacion_pendiente && seleccionado.stock > 0 && <a className="button button-primary" href={pedido} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Solicitar por Telegram</a>}{contacto ? <a className="button button-outline detail-contact" href={contacto} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Consultar por WhatsApp</a> : <p className="notice">El contacto se habilitará cuando el negocio proporcione su número.</p>}</div></>}
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  </main>
}
