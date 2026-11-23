# Solicitudes y ventas por Telegram

## Flujo para el cliente

1. Abrir un producto disponible del catálogo y pulsar **Solicitar en Telegram Web**, o **Abrir en la app de Telegram** si se tiene la aplicación instalada.
2. En Web, iniciar sesión en ese navegador si es necesario. Abrir el bot y pulsar **Iniciar** si Telegram lo solicita. El enlace lleva el identificador del producto; no incluye credenciales.
3. El bot muestra producto, precio por tonelada y existencias, y pregunta la cantidad.
4. Escribir solo la cantidad en toneladas, enteras o medias, con punto o coma: `0.5`, `1`, `1.5`, `2`... `1.5` es una tonelada y media. No se permiten otras fracciones, como `0.001` o `1.25`. La selección vence a los 30 minutos; `/cancelar` permite elegir otro producto.
5. Recibir el número y monto de la solicitud y esperar la decisión del negocio. Solo se admite una solicitud pendiente por cliente durante 24 horas.

El ostión permanece pendiente de peso y precio y no permite solicitudes de venta. WhatsApp conserva el contacto para consultas y cotizaciones especiales.

Si la página intermedia `t.me` muestra **START BOT** y no abre nada, ese botón usa el protocolo `tg://` para lanzar una aplicación instalada. Usar **Solicitar en Telegram Web** evita ese paso y conserva el producto. Como alternativa, **Copiar solicitud para pegar en el bot** copia el comando del producto: pegarlo y enviarlo en el chat, no en la búsqueda de Telegram.

## Decisión de la persona administradora

La solicitud llega al **chat privado del administrador con el bot**, con producto, cantidad, precio, total y dos botones. No se agrega al cliente a ese chat ni se comparte con él la configuración administrativa.

- **Aceptar y descontar stock:** comprueba nuevamente precio y existencias, registra una venta y su movimiento, descuenta stock y marca la solicitud aceptada en la misma transacción. El cliente recibe la respuesta.
- **Denegar:** cambia el estado de la solicitud y avisa al cliente; conserva el inventario.

Aceptar **no verifica el pago**. La persona administradora debe coordinar pago y entrega antes de decidir si corresponde registrar la venta. Una venta aceptada por el bot ya queda registrada: no volver a capturarla en el formulario manual de Ventas.

Las solicitudes no reservan mercancía. Si el stock ya no alcanza, la aceptación termina como `sin_stock`, sin venta ni descuento. Si cambió el precio o el producto requiere cotización, queda `precio_cambiado` y el cliente debe iniciar otra solicitud. Las solicitudes de más de 24 horas no se aceptan. Un botón repetido o una retransmisión de Telegram no descuenta dos veces.

El historial se consulta en **Administración > Alertas > Solicitudes por Telegram** y se actualiza cada 30 segundos. Las ventas aceptadas aparecen en Ventas al actualizar o volver a entrar.

## Implementación y permisos

`supabase/sql/pedidos_telegram.sql` se aplica una sola vez después de `mayoreo_toneladas.sql`. La instalación actual tiene un solo administrador y lo vincula como responsable del chat existente. Si hay varios administradores, el script se detiene para exigir una selección explícita.

El worker configura un webhook en la misma función `telegram-alertas`, con un secreto de autenticación generado en la base y comunicado directamente a Telegram desde el servidor. No se guarda ese valor en Git ni en el frontend. El webhook procesa mensajes privados y botones en cuanto Telegram los entrega; las alertas de inventario conservan su revisión cada dos minutos.

Solo el rol de servidor puede ejecutar las funciones de pedidos. La base vuelve a comprobar que una decisión provenga del chat del administrador vinculado y que su usuario siga autorizado. El historial de pedidos tiene RLS y solo puede consultarlo un administrador. Se conserva el ID de chat necesario para responder; no se solicita teléfono ni contraseña al cliente.

Los eventos se deduplican por `update_id`. Las respuestas se guardan en una cola privada dentro de la misma transacción. Se reclama cada salida antes de enviarla y se guarda su resultado. El worker procesa las pendientes también desde Cron. Un envío ambiguo queda `incierta` y un rechazo explícito `rechazada`; no se reintentan automáticamente para evitar duplicados. Un proceso interrumpido puede dejar una salida `enviando`. Estos estados requieren revisión en `private.telegram_salidas`; una falla de mensajería no revierte una venta ya confirmada. El bot debe ser exclusivo de esta aplicación; no configurar otro webhook ni usar `getUpdates` mientras el webhook esté activo.

## Verificación

Las pruebas cubren decisiones autorizadas, bloqueo de decisiones de clientes, ventas y movimientos atómicos, repetición de botones, rechazo sin descuento, falta de stock, permisos y respuestas ambiguas. Se comprobó además una aceptación en la base real dentro de una transacción revertida, sin dejar una venta de prueba ni reducir existencias.

Como comprobación histórica, antes de limitar la operación a toneladas enteras o medias, se probó el chat real con una solicitud de Filete de pescado por 0.001 toneladas y se pulsó Denegar. Llegaron ambas respuestas y se comprobó que el stock permaneció en 0.012 toneladas y que no se creó ninguna venta. Esa solicitud denegada queda como evidencia de prueba en el historial.

Fuentes oficiales: [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook), [enlaces de inicio](https://core.telegram.org/bots/features#deep-linking).

## Cantidades actuales

El stock vigente y los mínimos se ajustaron con `supabase/sql/toneladas_enteras_medias.sql`. Las nuevas solicitudes, ventas y movimientos admiten únicamente múltiplos positivos de 0.5 toneladas. El mínimo de inventario es 1 tonelada: la alerta se genera por debajo de ese valor. Los registros históricos mantienen sus cantidades originales.
