export async function procesarEventoTelegram(db, update) {
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) return
  const callback = update.callback_query
  const mensaje = callback?.message || update.message
  if (mensaje?.chat?.type !== 'private') return
  const actor = callback?.from || mensaje.from
  if (!Number.isSafeInteger(actor?.id) || actor.is_bot || String(actor.id) !== String(mensaje.chat.id)) return
  const { error } = await db.rpc('telegram_evento', {
    p_update: update.update_id, p_chat: String(mensaje.chat.id), p_actor: String(actor.id),
    p_texto: typeof mensaje.text === 'string' && !callback ? mensaje.text.trim().slice(0, 200) : '',
    p_callback: typeof callback?.data === 'string' ? callback.data.slice(0, 64) : '',
  })
  if (error) throw new Error('order_event_failed')
}

export async function enviarRespuestasTelegram(db, api) {
  for (let i = 0; i < 20; i++) {
    const salida = await db.rpc('telegram_tomar_salida')
    if (salida.error) throw new Error('outbox_claim_failed')
    if (!salida.data) return
    let estado = 'incierta', mensaje = null
    try {
      const res = await api('sendMessage', salida.data.payload)
      if (res.payload.ok && res.payload.result?.message_id) {
        estado = 'enviada'; mensaje = String(res.payload.result.message_id)
      } else if (res.status < 500) estado = 'rechazada'
    } catch { /* No se duplica un mensaje cuyo envío no se pudo confirmar. */ }
    const guardado = await db.rpc('telegram_finalizar_salida', { p_id: salida.data.id, p_estado: estado, p_mensaje: mensaje })
    if (guardado.error) throw new Error('outbox_save_failed')
    if (estado !== 'enviada') throw new Error('outbox_delivery_failed')
  }
}
