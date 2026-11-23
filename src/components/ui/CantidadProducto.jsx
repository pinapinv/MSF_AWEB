import { useState } from 'react'
import { Button } from './button'

export default function CantidadProducto({ producto, enCarrito, agregar }) {
  const [cantidad,setCantidad]=useState('0.5')
  const [mensaje,setMensaje]=useState('')
  const disponible=Number(producto.stock)-enCarrito
  const numero=Number(cantidad)
  const valido=Number.isFinite(numero) && numero>=0.5 && Number.isInteger(numero*2) && numero<=disponible
  if(producto.cotizacion_pendiente) return <p className="quantity-note">Peso y precio pendientes de confirmar.</p>
  return <form className="product-quantity" onSubmit={e=>{
    e.preventDefault()
    if(!valido) return
    agregar(producto,numero)
    setMensaje(`${numero} t agregadas al carrito.`)
  }}>
    <div className="quantity-actions"><label>Toneladas<input aria-label={`Toneladas de ${producto.nombre}`} type="number" required min="0.5" step="0.5" max={Math.max(disponible,0)} disabled={disponible<0.5} value={cantidad} onChange={e=>{setCantidad(e.target.value);setMensaje('')}} /></label><Button type="submit" disabled={!valido || disponible<0.5}>Agregar al carrito</Button></div>
    <p className="quantity-note">{enCarrito>0 ? `${enCarrito} t en tu carrito · ` : ''}{disponible>=0.5 ? `${disponible} t disponibles` : 'Sin más existencias disponibles'}</p>
    <span className="quantity-feedback" role="status">{mensaje}</span>
  </form>
}
