# Bitácora de uso de inteligencia artificial

Proyecto: **Mariscos de San Felipe**, El Sauzal, B.C.

Esta bitácora la reconstruí a partir de la conversación de trabajo y del historial de Git. Las fechas corresponden a los commits; no representan cinco jornadas terminadas. Distingo las decisiones que tomé de las tareas que delegué a la IA y de las comprobaciones realizadas durante la asistencia.

## Cómo utilicé la IA

Utilicé ChatGPT/Codex para planear el trabajo, generar y modificar código, diagnosticar errores, preparar consultas SQL, configurar servicios y documentar el proyecto. También autoricé que realizara operaciones en GitHub, Supabase, Vercel y, al final, Telegram mediante el navegador. Mi participación consistió en definir lo que necesitaba, elegir servicios, proporcionar datos del negocio, reportar problemas y autorizar las configuraciones. No escribí manualmente todo el código generado durante este proceso.

## 19 de noviembre de 2026: planteamiento y primera base

**Lo que pedí.** Compartí la propuesta en PDF y el proyecto `demo-react`. Solicité un plan de cinco días, priorizar las funciones básicas y conservar las tecnologías y la forma de organización del ejemplo. Elegí Supabase y Vercel. Pedí subir los avances a mi repositorio sin agregar a la herramienta como coautora de los commits.

**Apoyo de la IA.** La utilicé para preparar la base con React, JavaScript/JSX, Vite, pnpm, rutas, catálogo y acceso a datos separado en `src/api`. La asistencia incluyó el esquema de inventario, autenticación, permisos y documentación de configuración. También se ajustó la resolución del gestor de paquetes.

**Resultado y límite.** Tuve una base de código para continuar y un plan documentado. La creación del código no significaba por sí sola que las cuentas y el despliegue ya estuvieran conectados.

**Evidencia:** commits `ea755c4` y `59ea5b0`; [plan de trabajo](PLAN_5_DIAS.md).

## Configuración de servicios y acceso administrativo

**Lo que pedí.** Al principio no tenía los proyectos creados. Después compartí los enlaces de Supabase y Vercel, proporcioné mi correo para el acceso y autoricé la configuración asistida. Reporté que el panel administrativo no aparecía y, posteriormente, que el botón de Inventario no respondía.

**Apoyo de la IA.** Delegué la revisión de la conexión, las variables del despliegue y la autorización administrativa. Para Inventario se cambió la presentación del formulario a un diálogo accesible desde el panel.

**Resultado y límite.** El sitio quedó publicado en [Vercel](https://msf-aweb.vercel.app). No traté una sesión iniciada como permiso suficiente para editar: el acceso administrativo depende de la autorización en Supabase. No anoté una fecha independiente para cada configuración porque no todas tienen un commit propio.

**Evidencia:** commit `926828c`; [guía de configuración](CONFIGURACION.md).

## 22 de noviembre de 2026: identidad y contacto

**Lo que pedí.** Confirmé el nombre Mariscos de San Felipe, la ubicación en El Sauzal, B.C., el teléfono comercial y el eslogan «Del mar lo más natural». Solicité colores azul oscuro y retirar de la página los textos de proyecto académico.

**Apoyo de la IA.** La utilicé para cambiar la identidad visual, limpiar los textos públicos y agregar contacto telefónico y por WhatsApp.

**Resultado.** La presentación y los enlaces de contacto quedaron adaptados a los datos que proporcioné.

**Evidencia:** commits `926828c`, `4aa566e` y `c0f54a0`.

## 22 de noviembre de 2026: fotografías y existencias

**Lo que pedí.** Solicité imágenes reales y agregar stock. No contaba con un inventario real confirmado, por lo que autoricé trabajar con datos de prueba.

**Apoyo de la IA.** Delegué la incorporación de fotografías de referencia con sus créditos y la carga inicial mediante movimientos identificados como «Carga inicial de prueba autorizada».

**Resultado y límite.** Se cargaron filete 12 kg, camarón 8 kg, pulpo 5 kg, ostión 36 piezas, almeja 2 kg y pescado entero 10 kg. Estas cantidades no son un conteo verificado del negocio. Las fotografías tampoco se presentan como imágenes tomadas en el local.

**Evidencia:** commit `265cafc`; [créditos de fotografías](../public/creditos-fotos.html); [existencias iniciales](VENTAS.md#existencias-iniciales).

## 22 de noviembre de 2026: registro de ventas

**Lo que pedí.** Pregunté cómo concretar una venta desde la página.

**Apoyo de la IA.** La utilicé para implementar un registro administrativo que conserva el precio de la venta, calcula el monto y descuenta existencias junto con el movimiento de inventario en una sola transacción. Se agregaron validaciones para cantidades, disponibilidad y solicitudes repetidas.

**Resultado y límite.** El cliente puede contactar al negocio por WhatsApp; el acuerdo de entrega y pago ocurre por ese medio. Después de recibir el pago, el administrador registra la venta. No implementé una pasarela de pago, un carrito ni verificación automática de pagos.

**Evidencia:** commit `e9b8856`; [flujo de ventas](VENTAS.md).

## 22 de noviembre de 2026: alertas y cambio a Telegram

**Lo que pedí.** Inicialmente solicité alertas de stock bajo por WhatsApp al número del negocio. Después de tener dificultades con la configuración de Meta, elegí Telegram y autoricé crear y conectar un bot.

**Apoyo de la IA.** Primero se preparó la cola de alertas y la integración de WhatsApp. Después delegué la integración de Telegram, su vinculación privada y la revisión cada dos minutos con Supabase Cron. Inicié sesión en Telegram y confirmé la creación del bot y el almacenamiento de su token en los secretos de Supabase.

**Corrección durante la prueba.** La vinculación se completó, pero el envío detectó un permiso faltante al bloquear el producto para procesar la alerta. La IA corrigió el permiso del rol de servidor y ajustó la prueba para que no agregara ese permiso artificialmente durante su preparación.

**Resultado comprobado.** Durante la asistencia se verificó la recepción en mi chat del bot de una alerta de Almeja con 2 kg disponibles y mínimo de 3 kg, usando el inventario de prueba. WhatsApp quedó como contacto comercial; no afirmo que su API de alertas esté activada.

**Evidencia:** commits `6ae5e45`, `837bc0f` y `afb82fd`; [operación de alertas](ALERTAS.md); [bot](https://t.me/MariscosSanFelipeAlertasBot).

## Validación y pendientes que reconozco

La asistencia incluyó verificaciones de compilación, lint, pruebas de interfaz y pruebas de reglas y base de datos. Tras la última corrección de permisos, `pnpm test` pasó sus 14 pruebas. Estas comprobaciones automatizadas no sustituyen todas las pruebas manuales con usuarios reales.

Todavía debo sustituir precios y cantidades de prueba por datos confirmados y completar los reportes por periodo y producto más vendido. La carga de fotografías desde archivos y la actualización del catálogo en tiempo real también quedan pendientes. No considero terminado todo el plan original por haber publicado el sitio.

Solicité esta bitácora y el diario de decisiones a la propia IA, en primera persona, basándose en el historial disponible. No incluí tokens, contraseñas ni claves secretas en estos documentos.

## Ajuste posterior: comercialización al mayoreo

Aclaré que la empresa es una comercializadora de mayoreo y pedí un diseño más marino y un nuevo texto de presentación. Confirmé que todos los productos deben manejarse por tonelada y que el ostión debe quedar pendiente de peso y precio. Delegué a la IA el rediseño, la conversión matemática de los productos por kg y la adaptación de inventario y ventas. Pedí conservar los registros anteriores y no inventar equivalencias entre piezas y peso. La implementación incluye pruebas de conservación del historial, cálculo de ventas y bloqueo de productos pendientes.

## Solicitudes de venta con aprobación desde Telegram

Pedí que el cliente envíe su producto de interés al bot, que este pregunte cantidad y que yo pueda aceptar o denegar desde mi chat de Telegram. Delegué la incorporación de enlaces por producto, conversaciones privadas, solicitudes pendientes y botones administrativos. Elegí que el stock baje al aceptar. La asistencia incluyó pruebas de autorización, decisiones repetidas, rechazo y stock insuficiente, además de una aceptación en la base real que se revirtió al terminar para no dejar una venta de prueba. El bot no comprueba pagos bancarios.

Después reporté que el botón Start no hacía nada. La asistencia identificó que estaba en la página intermedia de Telegram en Opera y que no llegaban eventos al bot. Se agregó acceso directo a Telegram Web conservando el producto, un enlace separado para la aplicación instalada y una opción de copiar la solicitud. Se comprobó que el enlace web abre el chat y que el bot pregunta la cantidad.
