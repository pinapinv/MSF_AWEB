# Alertas de stock por WhatsApp

## Estado actual

- Nombre: Mariscos de San Felipe, El Sauzal, B.C.
- Destinatario solicitado: +52 646 275 7981.
- Detección y cola de alertas instaladas en Supabase.
- Función `alertas-stock` desplegada, con autenticación propia de webhook.
- **Envíos todavía desactivados:** faltan la cuenta emisora de Meta, la plantilla aprobada, los secretos y el webhook de base de datos. No se ha enviado un WhatsApp real.
- Los seis productos existentes están bajo su mínimo y tienen una alerta pendiente. Revisar existencias y mínimos antes de activar envíos.

## Comportamiento

Se genera una alerta cuando un producto está por debajo de su mínimo (`stock < stock_minimo`), también al crear un producto en esa condición o cambiar el mínimo. Un solo aviso por episodio: modificar el stock mientras permanece bajo no crea duplicados. Reponer hasta alcanzar el mínimo resuelve el episodio y cancela avisos aún pendientes. Si vuelve a bajar se crea uno nuevo.

La cola persiste en `public.alertas_stock`. Solo los administradores pueden consultarla; solo el servidor puede reclamar y actualizar envíos. La función consulta las existencias actuales antes de reclamar el aviso. Las modificaciones de inventario no dependen de la respuesta de WhatsApp.

Estados: `pendiente`, `procesando`, `aceptada`, `rechazada`, `incierta`, `cancelada`. `aceptada` significa que Meta aceptó el mensaje, no que el teléfono confirmó entrega. Ante un fallo ambiguo de red o timeout se conserva `incierta` y no se reintenta automáticamente, para evitar avisos duplicados. Revisar la cuenta de Meta antes de reenviar. Un proceso interrumpido puede quedar en `procesando` y también requiere revisión.

## 1. Preparar Meta desde cero

1. Entrar en https://developers.facebook.com/apps con tu cuenta y completar personalmente registro, términos y verificaciones que solicite Meta.
2. Crear una aplicación con el caso de uso **Connect with customers through WhatsApp** y seleccionar/crear el portfolio del negocio.
3. Abrir **WhatsApp > API Setup**. Para el proyecto se puede empezar con el número de prueba de Meta como emisor.
4. Agregar +52 646 275 7981 como destinatario y completar la verificación que Meta solicite. Es el receptor de alertas; no registrar ni migrar la línea de trabajo como emisor durante esta prueba.
5. Obtener el Phone Number ID del emisor y un token con permiso `whatsapp_business_messaging`. El token temporal caduca: para uso permanente se necesita configurar credenciales de sistema adecuadas en Meta.
6. Crear y someter a aprobación una plantilla con tres parámetros de texto en el cuerpo, por ejemplo:

> Mariscos de San Felipe: inventario bajo. Producto: {{1}}. Existencia: {{2}}. Mínimo configurado: {{3}}. Revisa si necesitas reponerlo.

`stock_bajo` es un nombre propuesto, no una plantilla ya aprobada. Usar el nombre e idioma exactos aprobados por Meta. La plantilla inicial `hello_world` sirve para probar la cuenta, pero no incluye los tres parámetros y no es la plantilla de esta integración.

Meta determina los requisitos y tarifas vigentes de la cuenta y de la plantilla. No se ha contratado ningún servicio ni aprobado cargos.

## 2. Guardar secretos en Supabase

Ir a **Edge Functions > Secrets** y completar estos valores personalmente; no enviarlos al chat, al repositorio o a variables `VITE_*`:

| Nombre | Valor |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Token de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número emisor (no el teléfono del destinatario) |
| `WHATSAPP_TO` | `526462757981` |
| `WHATSAPP_TEMPLATE_NAME` | Nombre real de la plantilla aprobada |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Código exacto aprobado, por ejemplo `es_MX` si corresponde |
| `WHATSAPP_API_VERSION` | Versión compatible con tu app, p. ej. `v27.0`, verificada en la documentación al preparar esta integración |
| `WHATSAPP_WEBHOOK_SECRET` | Secreto aleatorio privado de al menos 32 caracteres |

El cliente de Supabase del servidor usa sus variables internas; nunca copiar la clave de servicio al frontend. La función no admite destinatarios ni textos arbitrarios enviados por visitantes.

## 3. Activar el webhook automático

Una vez configurados y verificados los secretos:

1. En **Database > Webhooks**, crear un webhook para `public.alertas_stock`, evento **INSERT**.
2. Destino HTTPS: `https://oowovebnejpulbgyyeiv.supabase.co/functions/v1/alertas-stock`.
3. Método POST. Header `Content-Type: application/json` y header privado `x-webhook-secret` con el mismo valor que `WHATSAPP_WEBHOOK_SECRET`.
4. Conservar el cuerpo estándar del webhook: la función toma `record.id` y verifica/reclama el registro real en la base. `verify_jwt=false` es intencional porque se autentica mediante ese secreto; conocer la URL no permite enviar avisos.
5. Tener en cuenta que el header del webhook puede aparecer en su definición SQL o en respaldos. No añadirlo a Git. Para una configuración con secretos fuera de la definición, usar el patrón de Supabase Vault y pg_net de la documentación oficial.

El webhook se ejecuta sin depender de que la página permanezca abierta. Los registros pendientes anteriores a su creación no disparan INSERT retroactivamente: revisarlos y procesarlos explícitamente después de validar la integración.

## 4. Prueba real y pendientes previos

Primero confirmar recepción con un solo producto. Reponerlo hasta el mínimo y registrar una salida que lo deje por debajo: debe llegar un aviso con nombre, cantidad y mínimo. Otro movimiento aún por debajo no debe duplicarlo.

Para procesar una alerta pendiente existente, llamar desde un entorno de servidor a la función con el header secreto y el cuerpo `{"alerta_id":"UUID_REAL_DE_LA_ALERTA"}`. No es un botón ni una llamada pública de React. Ante un error del webhook antes de reclamar, el registro permanece pendiente; se puede volver a invocar. No restablecer estados aceptados, inciertos o en proceso sin revisar antes si Meta ya recibió el mensaje.

## Archivos y verificación

- `supabase/sql/alertas_stock.sql`: esquema y trigger ya aplicados con la migración remota `alertas_stock_whatsapp`. No ejecutarlo otra vez sobre la misma base.
- `supabase/functions/alertas-stock/`: función desplegada.
- `tests/alertas.test.js`: pruebas de episodios, permisos, cancelación, reclamo único y envío simulado.
- Ejecutar `pnpm test`, `pnpm lint` y `pnpm build`.

La configuración de Meta, el webhook y una prueba real de recepción siguen siendo necesarios para declarar las alertas activas.

## Fuentes oficiales

- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/
- https://supabase.com/docs/guides/database/webhooks
- https://supabase.com/docs/guides/functions/secrets
