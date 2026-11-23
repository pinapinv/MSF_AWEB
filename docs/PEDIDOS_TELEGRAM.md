# Carrito web y confirmación por Telegram

## Flujo actual

1. En el catálogo, agregar productos al carrito. Cada pulsación agrega 0.5 t.
2. Abrir **Carrito**, elegir toneladas enteras o medias por producto y quitar las líneas que no se necesiten.
3. Pulsar **Procesar carrito**. El servidor consulta precios y existencias y prepara un resumen; todavía no reserva mercancía ni registra ventas.
4. Pulsar **Enviar carrito en Telegram Web** o la opción de la aplicación instalada. Iniciar sesión en ese navegador si hace falta y pulsar Iniciar si Telegram lo solicita.
5. El bot envía el carrito completo al chat privado del administrador. Ya no pregunta cantidades: se eligieron en la página.
6. El administrador pulsa **Aceptar carrito** o **Denegar carrito**. El cliente recibe el resultado.

Aceptar vuelve a comprobar todos los precios y existencias. Registra una venta por producto y descuenta todas las líneas en una transacción; si falta stock o cambió el precio de cualquier línea, no vende ni descuenta ninguna. Repetir un botón no duplica ventas. Denegar no modifica existencias. Aceptar no verifica pagos: coordinar pago y entrega antes de decidir. No volver a registrar manualmente estas ventas.

El mínimo de alerta sigue en 1 t; nuevas cantidades solo en pasos de 0.5 t. El ostión sigue pendiente de peso y precio. El carrito local conserva únicamente identificadores y cantidades en el navegador, no contraseñas. El resumen del servidor prevalece sobre el total estimado de la página. Los carritos vencen a las 24 horas; el enlace permite enviar el pedido al bot, así que no debe compartirse con personas ajenas a la compra. La primera cuenta que lo envía queda vinculada como cliente.

El historial aparece en **Administración > Alertas > Solicitudes por Telegram**. Los borradores aún no enviados a Telegram no aparecen allí. Las ventas aceptadas se consultan en Ventas al actualizar la página. Los antiguos pedidos individuales se conservan como historial y compatibilidad; el catálogo nuevo utiliza el carrito.

## Instalación y seguridad

Aplicar una vez `supabase/sql/carrito_telegram.sql` después de `toneladas_enteras_medias.sql`. No ejecutar nuevamente sobre la misma base.

La función pública `crear_carrito` acepta hasta 20 líneas, valida cantidades y disponibilidad, ignora precios del navegador y usa una solicitud UUID para evitar duplicar borradores por reintentos. Hay un límite global de 1,000 borradores por hora para esta instalación. No permite consultar otros pedidos ni alterar stock. Las tablas tienen RLS; solo administradores consultan los pedidos. Las decisiones siguen llegando por el webhook autenticado existente y solo el administrador vinculado puede aprobarlas. Se reutilizan la deduplicación de eventos, la cola privada de respuestas y la revisión de pendientes mediante Cron. Los envíos inciertos o rechazados requieren revisión y no se reintentan automáticamente para evitar duplicados.

## Verificación

Las pruebas comprueban precios calculados por el servidor, cantidades inválidas, permisos, aceptación de varios productos, rechazo, falta de stock sin venta parcial, botones repetidos y selección de cantidades desde el formulario. Las pruebas anteriores de solicitudes individuales permanecen para proteger la compatibilidad. No se usan compras reales para probar descuentos de stock en producción.

Fuentes oficiales: [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook), [enlaces de inicio](https://core.telegram.org/bots/features#deep-linking).

## Confirmación visual

El diseño Resumen marino muestra las líneas y precios confirmados por el servidor, total y acción principal para Telegram Web. Modificar pedido regresa al formulario conservando cantidades. La opción para la aplicación instalada se encuentra en el desplegable alternativo. Aplicar `supabase/sql/resumen_carrito_estructurado.sql` después de `carrito_telegram.sql` para incluir las líneas estructuradas en la respuesta sin cambiar permisos ni la lógica de venta.
