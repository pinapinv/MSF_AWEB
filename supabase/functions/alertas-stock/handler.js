const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

async function secretoValido(recibido, esperado) {
  const digest = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  const [a, b] = await Promise.all([digest(recibido), digest(esperado)])
  return a.reduce((d, n, i) => d | (n ^ b[i]), 0) === 0
}

export function crearHandler({ env, db, enviar = fetch }) {
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    const secreto = env('WHATSAPP_WEBHOOK_SECRET')
    if (!secreto || secreto.length < 32) return json({ error: 'whatsapp_not_configured' }, 503)
    if (!await secretoValido(req.headers.get('x-webhook-secret') || '', secreto)) return json({ error: 'unauthorized' }, 401)
    const token = env('WHATSAPP_ACCESS_TOKEN')
    const emisor = env('WHATSAPP_PHONE_NUMBER_ID')
    const destino = env('WHATSAPP_TO')
    const plantilla = env('WHATSAPP_TEMPLATE_NAME')
    const idioma = env('WHATSAPP_TEMPLATE_LANGUAGE')
    const version = env('WHATSAPP_API_VERSION')
    if (!token || !/^\d+$/.test(emisor || '') || !/^\d{10,15}$/.test(destino || '') || !plantilla || !idioma || !/^v\d+\.\d+$/.test(version || '')) {
      return json({ error: 'whatsapp_not_configured' }, 503)
    }
    let id
    try { const body = await req.json(); id = body.record?.id || body.alerta_id } catch { return json({ error: 'invalid_body' }, 400) }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return json({ error: 'invalid_alert_id' }, 400)
    const { data, error } = await db.rpc('tomar_alerta_stock', { p_alerta: id })
    if (error) return json({ error: 'claim_failed' }, 500)
    const alerta = data?.[0]
    if (!alerta) return json({ estado: 'omitida' })
    let estado = 'incierta', mensajeId = null, codigo = 'network_or_timeout'
    try {
      const res = await enviar(`https://graph.facebook.com/${version}/${emisor}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ messaging_product: 'whatsapp', to: destino, type: 'template', template: {
          name: plantilla, language: { code: idioma }, components: [{ type: 'body', parameters: [
            { type: 'text', text: alerta.nombre_producto },
            { type: 'text', text: `${alerta.cantidad} ${alerta.unidad}` },
            { type: 'text', text: `${alerta.minimo} ${alerta.unidad}` },
          ] }],
        } }),
      })
      const resultado = await res.json()
      if (res.ok && resultado.messages?.[0]?.id) {
        estado = 'aceptada'; mensajeId = resultado.messages[0].id; codigo = null
      } else if (!res.ok && res.status < 500) {
        estado = 'rechazada'; codigo = String(resultado.error?.code || res.status)
      } else { codigo = String(res.status) }
    } catch { /* Resultado incierto: no reintentar automáticamente y duplicar avisos. */ }
    const { error: fallo } = await db.from('alertas_stock').update({ estado, mensaje_id: mensajeId, error_codigo: codigo, procesada_en: new Date().toISOString() }).eq('id', id)
    if (fallo) return json({ error: 'status_save_failed' }, 500)
    // Aceptada por Meta no significa entregada al teléfono.
    return json({ estado }, estado === 'aceptada' ? 200 : 502)
  }
}
