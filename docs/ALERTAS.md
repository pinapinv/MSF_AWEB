# Alertas de inventario con Telegram

Canal elegido por la responsable: Telegram, debido al bloqueo de registro de Meta. WhatsApp conserva el botón de contacto comercial. La preparación anterior de la API de WhatsApp se documenta en `WHATSAPP.md`, pero no está activada.

## Instalado

- Detección y cola de stock bajo en Supabase.
- Worker `telegram-alertas`, con autenticación propia mediante un secreto privado generado en la base de datos. No acepta llamadas de visitantes.
- Revisión automática cada dos minutos mediante Supabase Cron y pg_net, incluso con el sitio cerrado.
- Vinculación del destinatario mediante un código visible únicamente para administradores en **Administración > Alertas**.
- Historial administrativo de avisos y aviso destacado cuando hay productos bajo su mínimo.

## Estado verificado

El bot [@MariscosSanFelipeAlertasBot](https://t.me/MariscosSanFelipeAlertasBot) fue creado y vinculado al chat autorizado. El token se guardó como secreto de Supabase. Se verificó la recepción de la alerta de Almeja: 2 kg disponibles y mínimo de 3 kg, correspondientes al inventario de prueba. Cron está activo cada dos minutos y la última comprobación terminó sin error. La corrección de permisos para procesar alertas quedó en `afb82fd`.

## Pasos de configuración para otra instalación

1. Iniciar sesión en Telegram y abrir https://t.me/BotFather.
2. Enviar `/newbot`, elegir el nombre y un usuario disponible que termine en `bot`.
3. Guardar el token directamente en **Supabase > Edge Functions > Secrets**, con el nombre `TELEGRAM_BOT_TOKEN`. No ponerlo en el chat, Git o variables `VITE_*`.
4. En la página, entrar a **Administración > Alertas** y copiar el comando completo `/start CODIGO`.
5. Abrir el bot recién creado y enviar ese comando. El siguiente ciclo del worker vincula ese chat privado. No se usa como destinatario al último desconocido que haya escrito al bot.
6. Confirmar el estado **Telegram vinculado** y la recepción de un aviso de prueba. En la instalación actual, el aviso inicial de Almeja ya fue enviado; no debe restablecerse como pendiente para repetirlo.

El token controla el bot: debe guardarse solo como secreto en Supabase. El código de vinculación no es el token; solo compártelo con la persona que debe recibir avisos. El bot debe ser exclusivo para esta aplicación, ya que el worker usa `getUpdates`.

## Reglas de envío

Se registra un aviso cuando `stock < stock_minimo`. Reponer hasta el mínimo resuelve el episodio y cancela avisos pendientes. Una nueva bajada crea otro episodio. Los avisos repetidos no se envían dos veces; el servidor reclama cada registro de forma atómica.

Se procesan hasta diez alertas por revisión. Una respuesta aceptada guarda el identificador del mensaje de Telegram. Los fallos explícitos quedan rechazados y los fallos ambiguos quedan por verificar: no se reintentan automáticamente porque podrían duplicar avisos. Revisar el historial antes de restablecerlos. Un proceso interrumpido puede quedar en `procesando` y requiere revisión.

## Operación y pruebas

- Configuración: `supabase/sql/telegram.sql`.
- Programación: `supabase/sql/telegram_cron.sql` (aplicada al proyecto).
- Worker: `supabase/functions/telegram-alertas/`.
- Estados visibles: vinculado, falta token, última revisión y errores.
- Pruebas: `pnpm test`, `pnpm test:ui`, `pnpm lint`, `pnpm build`.

Para detener revisiones desde SQL Editor:

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname='msf-telegram-stock';
```

No ejecutar nuevamente las migraciones sobre la misma base. Los tokens nunca se almacenan en `public` ni se retornan al frontend. Las funciones de servidor están limitadas a `service_role`; la lectura de estado de vinculación verifica la autorización administrativa.

Fuentes oficiales: https://core.telegram.org/bots/tutorial, https://core.telegram.org/bots/api y https://supabase.com/docs/guides/cron/quickstart.
