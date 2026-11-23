import { useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { supabase } from './lib/supabase'
import { moneda } from './lib/productos'
import { Button } from './components/ui/button'

export default function Carrito() {
  const { productos,carrito,setCarrito,cargando,error:errorCatalogo }=useOutletContext()
  const [preparado,setPreparado]=useState(null)
  const [error,setError]=useState('')
  const [ocupado,setOcupado]=useState(false)
  const solicitud=useRef({firma:'',id:''})
  const lineas=carrito.map(l=>({...l,producto:productos.find(p=>p.id===l.producto_id)}))
  const invalido=lineas.some(l=>!l.producto || l.producto.cotizacion_pendiente || l.cantidad>l.producto.stock || l.cantidad<=0 || !Number.isInteger(l.cantidad*2))
  const total=lineas.reduce((s,l)=>s+(l.producto?.precio || 0)*l.cantidad,0)
  function cambiar(id,cantidad) { setPreparado(null);setError('');setCarrito(prev=>prev.map(l=>l.producto_id===id?{...l,cantidad}:l)) }
  function quitar(id) { setPreparado(null);setError('');setCarrito(prev=>prev.filter(l=>l.producto_id!==id)) }
  async function procesar(e) {
    e.preventDefault()
    if (invalido || ocupado) return
    if (!supabase) { setError('No se puede enviar un pedido desde el catálogo sin conexión.');return }
    setOcupado(true);setError('')
    const firma=JSON.stringify(carrito)
    if(solicitud.current.firma!==firma) solicitud.current={firma,id:crypto.randomUUID()}
    try {
      const {data,error:fallo}=await supabase.rpc('crear_carrito',{p_solicitud:solicitud.current.id,p_lineas:carrito})
      if(fallo) throw fallo
      setPreparado(data)
    } catch(fallo) { setError(fallo.message || 'No se pudo preparar el carrito. Actualiza el catálogo y vuelve a intentarlo.') }
    finally { setOcupado(false) }
  }
  const payload=preparado && `carrito_${preparado.id}`
  const web=payload && `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(`tg://resolve?domain=MariscosSanFelipeAlertasBot&start=${payload}`)}`
  return <main className="container admin-page cart-page"><p className="eyebrow">PEDIDO AL MAYOREO</p><h1>Tu carrito</h1><p>Elige toneladas enteras o medias: 0.5, 1, 1.5, 2… El pedido completo se enviará al negocio por Telegram para aceptarlo o denegarlo. Todavía no se reserva ni descuenta stock.</p>
    {errorCatalogo && <p className="notice error" role="alert">{errorCatalogo}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!carrito.length ? <div className="empty"><h2>Tu carrito está vacío</h2><Link className="button button-primary" to="/">Elegir productos</Link></div> : <form className="editor" onSubmit={procesar}><fieldset disabled={ocupado || cargando}><div className="cart-lines">{lineas.map(l=><article className="cart-line" key={l.producto_id}><div><h2>{l.producto?.nombre || 'Producto no disponible'}</h2><p>{moneda(l.producto?.precio || 0)} / tonelada · Disponible: {l.producto?.stock ?? '—'} t</p></div><label>Toneladas<input aria-label={`Toneladas de ${l.producto?.nombre || 'producto'}`} required type="number" min="0.5" step="0.5" max={l.producto?.stock || 0} value={l.cantidad} onChange={e=>cambiar(l.producto_id,Number(e.target.value))} /></label><strong>{moneda((l.producto?.precio || 0)*l.cantidad)}</strong><Button variant="outline" onClick={()=>quitar(l.producto_id)}>Quitar</Button></article>)}</div><div className="sale-total"><span>Total estimado</span><strong>{moneda(total)}</strong></div>{invalido && !cargando && <p className="notice error">Revisa las cantidades o quita los productos que ya no están disponibles.</p>}<div className="actions"><Link className="button button-outline" to="/">Seguir comprando</Link><Button type="submit" disabled={invalido || cargando || Boolean(errorCatalogo)}>{ocupado?'Preparando…':preparado?'Actualizar pedido':'Procesar carrito'}</Button></div></fieldset></form>}
    {preparado && <section className="editor" aria-live="polite"><h2>Envía tu pedido a Telegram</h2><p>Este es el pedido que revisará el negocio. Si cambió algún precio, aquí se muestra el total actualizado.</p><pre className="cart-summary">{preparado.resumen}</pre><p><strong>Total: {moneda(preparado.total)}</strong></p><p>Abre Telegram y pulsa Iniciar si aparece. El bot enviará el carrito completo; ya no te preguntará cantidades. Aceptar registrará todas las ventas juntas. El pago y la entrega se acuerdan con el negocio.</p><div className="telegram-options"><a className="button button-primary" href={web} target="_blank" rel="noreferrer">Enviar carrito en Telegram Web</a><a className="button button-outline" href={`https://t.me/MariscosSanFelipeAlertasBot?start=${payload}`} target="_blank" rel="noreferrer">Enviar con la app de Telegram</a></div><p className="muted">Válido por 24 horas. Evita volver a capturar manualmente las ventas si el negocio ya aceptó este carrito.</p></section>}
  </main>
}
