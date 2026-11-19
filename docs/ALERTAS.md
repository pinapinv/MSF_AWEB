# Alertas de inventario: siguiente integración

Estado: no implementadas ni enviadas en el primer avance. El panel identifica inventario por debajo del mínimo, pero no envía mensajes externos.

La propuesta pide WhatsApp Business en entorno de pruebas. El contacto manual del catálogo mediante un enlace de WhatsApp es una función distinta de las alertas automáticas.

## Alternativa de Telegram

Puede evaluarse para el proyecto académico porque la Bot API permite enviar mensajes mediante un bot. Si se elige, registrar el cambio de alcance y confirmarlo con el profesor; no presentar Telegram como cumplimiento literal del requisito de WhatsApp.

Pasos de preparación por la estudiante:

1. Abrir Telegram y buscar el bot oficial `@BotFather` (https://t.me/BotFather).
2. Enviar `/newbot` y seguir el asistente para elegir nombre y usuario del bot.
3. Guardar el token de forma privada. No pegarlo en este chat, en un commit ni en variables `VITE_*`.
4. Abrir el bot creado y pulsar Iniciar o enviar `/start` desde la cuenta que recibirá alertas.
5. En la siguiente integración, obtener el `chat_id` con `getUpdates` desde un entorno seguro y configurar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` como secretos de servidor.

Diseño previsto: una Supabase Edge Function procesará eventos de stock bajo y enviará el nombre y cantidad restante al encargado mediante `sendMessage`. Se debe verificar el origen del evento y mantener un registro de alertas para evitar mensajes repetidos y permitir reintentos. El token jamás se envía al navegador. Una falla de mensajería no debe deshacer una venta o un movimiento ya confirmado.

Pruebas previstas: cruzar el mínimo, permanecer debajo sin duplicar, reponer y volver a cruzar, token inválido, fallo temporal y reintento. La política exacta de repetición se acordará antes de integrar el servicio.

## Si se conserva WhatsApp

Preparar la cuenta y entorno de pruebas de WhatsApp Business, verificar los requisitos vigentes de Meta y destinatarios habilitados, y usar la función de servidor con credenciales privadas. No automatizar WhatsApp Web ni reemplazar silenciosamente el envío automático por un enlace manual.

Referencias oficiales de Telegram: https://core.telegram.org/bots/tutorial y https://core.telegram.org/bots/api#sendmessage.
