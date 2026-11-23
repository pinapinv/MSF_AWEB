const json = (data, status = 200) => Response.json(data, { status })

export function crearTelegramHandler({ db, env, enviar = fetch }) {
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    const secreto = req.headers.get('x-worker-secret') || ''
    if (!/^[a-f0-9]{64}$/.test(secreto)) return json({ error: 'unauthorized' }, 401)
    const { data: autorizado, error: falloAuth } = await db.rpc('validar_worker_telegram', { p_secreto: secreto })
    if (falloAuth || !autorizado) return json({ error: 'unauthorized' }, 401)
    const revision = async (error, offset = 0) => {
      const { error: fallo } = await db.rpc('revision_telegram', { p_error: error, p_offset: offset })
      if (fallo) {
        console.error('telegram_status_database', fallo.code, fallo.message)
        throw new Error('status_save_failed')
      }
    }
    const token = env('TELEGRAM_BOT_TOKEN')
    if (!token) {
      try { await revision('falta_token'); return json({ configurado: false }) }
      catch { return json({ error: 'status_save_failed' }, 500) }
    }
    const api = async (method, body) => {
      const res = await enviar(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      })
      return { status: res.status, payload: await res.json() }
    }
    try {
      let { data: config, error: fallo } = await db.rpc('config_worker_telegram')
      if (fallo) return json({ error: 'configuration_failed' }, 500)
      if (!config.chat_id) {
        const updates = await api('getUpdates', { offset: config.update_offset, limit: 100, timeout: 0, allowed_updates: ['message'] })
        if (!updates.payload.ok) { await revision('telegram_' + updates.status); return json({ vinculado: false }, 502) }
        let offset = Number(config.update_offset)
        for (const u of updates.payload.result || []) {
          offset = Math.max(offset, u.update_id + 1)
          const m = u.message
          const codigo = m?.text?.trim().match(/^\/start(?:@\w+)?\s+([0-9a-f-]{36})$/i)?.[1]
          if (m?.chat?.type === 'private' && codigo === config.codigo) {
            const { error } = await db.rpc('vincular_telegram', { p_codigo: codigo, p_chat_id: String(m.chat.id) })
            if (error) throw new Error('pair_failed')
            break
          }
        }
        await revision(null, offset)
        const actual = await db.rpc('config_worker_telegram')
        config = actual.data
        if (actual.error || !config?.chat_id) return json({ vinculado: false })
      }
      const pendientes = await db.from('alertas_stock').select('id').eq('estado','pendiente').is('resuelta_en',null).order('creada_en').limit(10)
      if (pendientes.error) throw new Error('pending_query_failed')
      let enviados = 0
      for (const pendiente of pendientes.data || []) {
        const tomada = await db.rpc('tomar_alerta_stock', { p_alerta: pendiente.id })
        if (tomada.error) throw new Error('claim_failed')
        const a = tomada.data?.[0]
        if (!a) continue
        let estado = 'incierta', mensajeId = null, errorCodigo = 'network_or_timeout'
        try {
          const res = await api('sendMessage', { chat_id: config.chat_id, text: `Mariscos de San Felipe\nInventario bajo\nProducto: ${a.nombre_producto}\nDisponible: ${a.cantidad} ${a.unidad}\nMínimo: ${a.minimo} ${a.unidad}\nRevisa si necesitas reponerlo.` })
          if (res.payload.ok && res.payload.result?.message_id) { estado='aceptada'; mensajeId=String(res.payload.result.message_id); errorCodigo=null; enviados++ }
          else if (res.status < 500) { estado='rechazada'; errorCodigo=String(res.payload.error_code || res.status) }
        } catch { /* Una respuesta incierta no se reintenta: evita duplicar avisos. */ }
        const guardado = await db.from('alertas_stock').update({ estado, canal: 'telegram', mensaje_id: mensajeId, error_codigo: errorCodigo, procesada_en: new Date().toISOString() }).eq('id',a.id)
        if (guardado.error) throw new Error('status_save_failed')
        if (estado !== 'aceptada') { await revision('envio_' + errorCodigo); return json({ enviados, error: 'delivery_failed' }, 502) }
      }
      await revision(null)
      return json({ vinculado: true, enviados })
    } catch {
      await revision('error_temporal')
      return json({ error: 'worker_failed' }, 502)
    }
  }
}
