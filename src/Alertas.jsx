import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Button } from './components/ui/button'
import PedidosTelegram from './PedidosTelegram'

const estados = { pendiente: 'Pendiente', procesando: 'Procesando', aceptada: 'Mensaje aceptado', rechazada: 'Rechazado', incierta: 'Por verificar', cancelada: 'Cancelada por reposición' }
export default function Alertas() {
  const [config, setConfig] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)
  const cargar = useCallback(async (signal) => {
    try {
      const [estado, historial] = await Promise.all([
        supabase.rpc('estado_telegram'),
        supabase.from('alertas_stock').select('*').order('creada_en', { ascending: false }).limit(100),
      ])
      if (estado.error || historial.error) throw new Error('No se pudo consultar la configuración de alertas.')
      if (!signal?.aborted) { setConfig(estado.data); setAlertas(historial.data); setError('') }
    } catch { if (!signal?.aborted) setError('No se pudo consultar la configuración de alertas. Inténtalo nuevamente.') }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => cargar(controller.signal))
    const timer = setInterval(() => cargar(controller.signal), 30000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [cargar])
  const comando = config ? `/start ${config.codigo}` : ''
  return <section className="alerts-page"><div className="editor"><h2>Alertas de inventario por Telegram</h2>
    <p>Recibe un aviso cuando un producto esté por debajo del mínimo. Se envía un aviso por episodio de stock bajo; al reponer hasta el mínimo se habilita el siguiente aviso.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {config && <>
      <p className={`notice ${config.vinculado ? 'success' : ''}`} role="status">{config.vinculado ? 'Telegram vinculado. Las solicitudes se atienden mediante el bot; los avisos de inventario se revisan cada dos minutos.' : 'Telegram pendiente de vinculación. Todavía no se envían mensajes.'}</p>
      {config.ultimo_error === 'falta_token' && <p>Falta guardar el token del bot en los secretos de Supabase como <code>TELEGRAM_BOT_TOKEN</code>. Nunca lo pegues en este panel.</p>}
      {config.ultimo_error && config.ultimo_error !== 'falta_token' && <p className="notice error">El último intento no se completó. Comprueba la configuración del bot. Código: {config.ultimo_error}</p>}
      {!config.vinculado && <><ol><li>Crea un bot desde <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> con el comando <code>/newbot</code>.</li><li>Guarda su token como <code>TELEGRAM_BOT_TOKEN</code> en Supabase → Edge Functions → Secrets.</li><li>Abre tu bot en Telegram y envíale este comando completo para vincular tu chat:</li></ol><div className="pairing-code"><code>{comando}</code><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(comando); setCopiado(true) } catch { setError('Copia el comando manualmente.') } }}>{copiado ? 'Copiado' : 'Copiar comando'}</Button></div><p className="muted">Este código vincula el chat que recibirá las alertas. Compártelo solo con la persona encargada. La confirmación puede tardar hasta dos minutos.</p></>}
      {config.ultima_revision && <p className="muted">Última revisión: {new Date(config.ultima_revision).toLocaleString('es-MX', { timeZone: 'America/Tijuana' })}</p>}
    </>}
    <Button variant="outline" onClick={() => cargar()}>Actualizar estado</Button>
  </div><h2>Historial de alertas</h2><div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Existencia al generar</th><th>Mínimo</th><th>Estado</th><th>Canal</th></tr></thead><tbody>{alertas.map((a) => <tr key={a.id}><td>{new Date(a.creada_en).toLocaleString('es-MX', { timeZone: 'America/Tijuana' })}</td><td>{a.nombre_producto}</td><td>{a.cantidad} {a.unidad}</td><td>{a.minimo} {a.unidad}</td><td>{estados[a.estado] || a.estado}</td><td>{a.canal || 'Pendiente'}</td></tr>)}</tbody></table>{!alertas.length && <p className="empty">Sin alertas registradas.</p>}</div><PedidosTelegram /></section>
}
