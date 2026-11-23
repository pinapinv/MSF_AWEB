// Contacto del negocio proporcionado por su responsable.
export const telefono = (import.meta.env.VITE_WHATSAPP_NUMBER || '526462757981').replace(/[+\s()-]/g, '')
export const telefonoVisible = telefono === '526462757981' ? '+52 646 275 7981' : `+${telefono}`

export const telegramBot = 'https://t.me/MariscosSanFelipeAlertasBot'
export const enlacePedidoTelegram = (producto) => `${telegramBot}?start=producto_${producto.id}`
export const comandoPedidoTelegram = (producto) => `/start producto_${producto.id}`
// Usa el mismo enlace OPEN IN WEB que ofrece Telegram, conservando el producto.
export const enlacePedidoTelegramWeb = (producto) => `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(`tg://resolve?domain=MariscosSanFelipeAlertasBot${producto ? `&start=producto_${producto.id}` : ''}`)}`
