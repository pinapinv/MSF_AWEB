import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { moneda } from './lib/productos'
import { telegramBot } from './lib/contacto'

const estados = { pendiente:'Pendiente',aceptada:'Aceptada',denegada:'Denegada',sin_stock:'Sin stock al confirmar',precio_cambiado:'Requiere nueva cotización',vencida:'Vencida' }
export default function PedidosTelegram() {
  const [pedidos,setPedidos] = useState([])
  const [error,setError] = useState('')
  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const {data,error:fallo} = await supabase.from('pedidos_telegram').select('id,nombre_producto,cantidad,monto,estado,creada_en').order('creada_en',{ascending:false}).limit(100)
        if (fallo) throw fallo
        if (activo) { setPedidos(data);setError('') }
      } catch { if (activo) setError('No se pudieron consultar las solicitudes de Telegram.') }
    }
    cargar()
    const timer = setInterval(cargar,30000)
    return () => { activo=false;clearInterval(timer) }
  },[])
  return <section className="telegram-orders"><h2>Solicitudes por Telegram</h2><p className="muted order-note">Últimas 100 solicitudes. Acepta o deniega desde el chat del bot. Aceptar registra la venta y descuenta stock; no verifica pagos. Esta lista se actualiza cada 30 segundos.</p><a className="button button-outline" href={telegramBot} target="_blank" rel="noreferrer">Abrir bot de Telegram</a>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Solicitud</th><th>Producto</th><th>Toneladas</th><th>Monto</th><th>Estado</th></tr></thead><tbody>{pedidos.map(p=><tr key={p.id}><td>{new Date(p.creada_en).toLocaleString('es-MX',{timeZone:'America/Tijuana'})}</td><td>{p.id.slice(0,8)}</td><td>{p.nombre_producto}</td><td>{p.cantidad}</td><td>{moneda(p.monto)}</td><td>{estados[p.estado] || p.estado}</td></tr>)}</tbody></table>{!pedidos.length && !error && <p className="empty">Todavía no hay solicitudes por Telegram.</p>}</div>
  </section>
}
