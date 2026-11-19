# Plan de cinco días

Inicio solicitado: trabajar desde el 19 de noviembre de 2026, priorizando funciones básicas. No se han fijado horas diarias. Los días siguientes son jornadas de trabajo; no se presupone si incluyen fines de semana.

Decisiones confirmadas: React siguiendo `demo-react`, Supabase, publicación en Vercel y datos ficticios autorizados. Telegram es una alternativa propuesta para alertas, todavía no un cambio confirmado del alcance del PDF.

| Jornada | Objetivo | Criterio de entrega |
| --- | --- | --- |
| 1 | Base React, catálogo, rutas, SQL de Supabase, login y configuración Vercel | App compilable, catálogo demostrable, migración y guía listas. Crear cuentas/conectar servicios para completar el acceso real. |
| 2 | Productos e inventario conectados | Crear/editar productos y fotos; entradas, mermas, mínimos e historial persistentes. Validar el primer avance contra Supabase y publicar en Vercel. |
| 3 | Ventas | Registrar fecha, producto, cantidad y monto. Actualizar inventario y movimiento en una única transacción, evitando dobles descuentos. |
| 4 | Reportes y alertas | Resúmenes diarios/semanales/mensuales, ingresos y producto más vendido; acordar cómo comparar kg y piezas. Integrar el canal de alerta elegido en pruebas. |
| 5 | Validación y entrega | Probar login, permisos, persistencia, concurrencia, agotados, alertas y móvil; corregir errores, documentar y demostrar la URL publicada. |

## Estado del primer avance

Código implementado para catálogo, acceso administrativo, edición de productos y movimientos de inventario. SQL probado localmente. Pendiente conexión de cuentas, pruebas contra Supabase y despliegue real. No declarar la jornada completa hasta validar estos servicios.

## Decisiones pendientes

- Creación de las cuentas/proyectos Supabase y Vercel por la estudiante, o conexión para poder realizar la configuración asistida.
- Nombre definitivo, imágenes, precios, promociones y número de contacto reales. Mantener la leyenda de demostración hasta sustituir los datos.
- WhatsApp Business en pruebas o ajuste del documento para usar Telegram con aceptación del profesor.
- Definir métrica del producto más vendido: las cantidades en kg y piezas no se deben sumar como si fueran equivalentes.

## Rutina de cierre

Ejecutar lint, pruebas y build; revisar cambios; commit descriptivo y push al repositorio indicado. No atribuir coautoría a Codex/OpenAI. No incluir contraseñas, tokens, archivos `.env.local` ni datos personales adicionales.
