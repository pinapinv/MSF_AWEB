import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { supabase } from './lib/supabase'
import { moneda } from './lib/productos'
import { Button } from './components/ui/button'
import { Anchor, CircleCheck, Fish, Send, Clock3 } from 'lucide-react'

export default function Carrito() {
  const { productos,carrito,setCarrito,cargando,error:errorCatalogo }=useOutletContext()
  const [preparado,setPreparado]=useState(null)
  const [error,setError]=useState('')
  const [ocupado,setOcupado]=useState(false)
  const confirmacion=useRef(null)
  const editor=useRef(null)
  useEffect(()=>{ if(preparado){ confirmacion.current?.focus();confirmacion.current?.scrollIntoView?.({block:'start'}) } },[preparado])
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
  return <main className="container admin-page cart-page"><p className="eyebrow">PEDIDO AL MAYOREO</p><h1>Tu carrito</h1>
    {errorCatalogo && <p className="notice error" role="alert">{errorCatalogo}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!carrito.length ? <div className="empty"><h2>Tu carrito está vacío</h2><Link className="button button-primary" to="/">Elegir productos</Link></div> : !preparado && <form className="editor" ref={editor} tabIndex={-1} onSubmit={procesar}><fieldset disabled={ocupado || cargando}><div className="cart-lines">{lineas.map(l=><article className="cart-line" key={l.producto_id}><div><h2>{l.producto?.nombre || 'Producto no disponible'}</h2><p>{moneda(l.producto?.precio || 0)} / tonelada · Disponible: {l.producto?.stock ?? '—'} t</p></div><label>Toneladas<input aria-label={`Toneladas de ${l.producto?.nombre || 'producto'}`} required type="number" min="0.5" step="0.5" max={l.producto?.stock || 0} value={l.cantidad} onChange={e=>cambiar(l.producto_id,Number(e.target.value))} /></label><strong>{moneda((l.producto?.precio || 0)*l.cantidad)}</strong><Button variant="outline" onClick={()=>quitar(l.producto_id)}>Quitar</Button></article>)}</div><div className="sale-total"><span>Total estimado</span><strong>{moneda(total)}</strong></div>{invalido && !cargando && <p className="notice error">Revisa las cantidades o quita los productos que ya no están disponibles.</p>}<div className="actions"><Link className="button button-outline" to="/">Seguir comprando</Link><Button type="submit" disabled={invalido || cargando || Boolean(errorCatalogo)}>{ocupado?'Preparando…':preparado?'Actualizar pedido':'Procesar carrito'}</Button></div></fieldset></form>}
    {preparado && <section className="purchase-confirmation" ref={confirmacion} tabIndex={-1} aria-labelledby="purchase-title">
      <header className="purchase-header"><div className="purchase-brand"><Anchor size={25} aria-hidden="true"/><span>Mariscos de San Felipe<small>EL SAUZAL, B.C. · MAYOREO</small></span></div><span className="purchase-badge"><CircleCheck size={15} aria-hidden="true"/> Listo para enviar</span></header>
      <div className="purchase-content"><div className="purchase-heading"><h2 id="purchase-title">Revisa tu pedido</h2><p>Estos son los productos que enviaremos al negocio.</p></div>
        <ul className="purchase-items">{(preparado.lineas || []).map(l=><li className="purchase-item" key={l.producto_id}><span className="purchase-product-icon"><Fish size={22} aria-hidden="true"/></span><div><h3>{l.nombre}</h3><p>{moneda(l.precio)} / tonelada</p></div><div className="purchase-amount"><strong>{moneda(l.monto)}</strong><span>{Number(l.cantidad)} {Number(l.cantidad)===1?'tonelada':'toneladas'}</span></div></li>)}</ul>
        {!preparado.lineas && <pre className="cart-summary">{preparado.resumen}</pre>}
        <div className="purchase-total"><div><span>Total del pedido</span><strong>{moneda(preparado.total)}</strong><small>MXN</small></div>{preparado.lineas && <span className="purchase-count">{preparado.lineas.length} productos · {preparado.lineas.reduce((s,l)=>s+Number(l.cantidad),0)} t</span>}</div>
        <div className="purchase-actions"><a className="button button-primary" href={web} target="_blank" rel="noreferrer"><Send size={18} aria-hidden="true"/> Enviar pedido por Telegram</a><Button variant="outline" onClick={()=>{setPreparado(null);requestAnimationFrame(()=>{editor.current?.focus();editor.current?.scrollIntoView?.({block:'start'})})}}>Modificar pedido</Button></div>
        <div className="purchase-footer"><Clock3 size={15} aria-hidden="true"/><span>La venta se confirma cuando el negocio acepta.</span></div>
        <details className="purchase-alternative"><summary>¿Prefieres la aplicación de Telegram?</summary><a href={`https://t.me/MariscosSanFelipeAlertasBot?start=${payload}`} target="_blank" rel="noreferrer">Abrir pedido en la app instalada</a></details>
        <p className="purchase-validity">Pedido válido por 24 horas. Pago y entrega se acuerdan con el negocio.</p>
      </div>
    </section>}

  </main>
}
