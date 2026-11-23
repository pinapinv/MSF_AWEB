# Diario de decisiones

En este diario explico las decisiones que tomé y las soluciones técnicas que acepté con ayuda de IA. Lo reconstruí a partir del trabajo registrado; cuando no tengo una fecha individual comprobable, uso la etapa en lugar de inventarla.

## 1. Conservar la base de trabajo de demo-react

Desde el inicio pedí seguir el proyecto de referencia de mi clase. Conservé React con JavaScript/JSX, Vite, pnpm, React Router, Tailwind, Base UI y Lucide. Acepté separar las consultas en `src/api` y reutilizar componentes para mantener una organización consistente con el ejemplo.

**Consecuencia:** pude desarrollar sobre una estructura conocida para la materia. No cambié el proyecto a otro framework para añadir las funciones.

## 2. Usar Supabase y publicar en Vercel

Elegí Supabase para la base de datos y el acceso de usuarios, y Vercel para publicar la aplicación. Quise que el proyecto estuviera disponible en internet y que los cambios administrativos persistieran.

**Consecuencia:** fue necesario configurar ambos servicios y las variables del despliegue. Mantuve las claves secretas fuera del cliente y del repositorio. La guía de instalación describe cómo reproducir la configuración; no debe confundirse con pasos pendientes de mi instancia actual.

## 3. Restringir la administración

Necesitaba editar precios, fotos y existencias desde el panel. Acepté usar autenticación y una lista de administradores en Supabase, con permisos aplicados en la base de datos.

**Consecuencia:** iniciar sesión no basta para obtener acceso de edición. Ocultar los botones en React tampoco sustituye la autorización del servidor.

## 4. Corregir el acceso visible a Inventario

Reporté que el botón de Inventario no respondía. Acepté abrir el formulario en un diálogo para que la acción y sus campos fueran visibles.

**Consecuencia:** corregí la interacción sin cambiar la finalidad de las entradas y mermas. El ajuste quedó registrado en `926828c`.

## 5. Personalizar la identidad del negocio

Proporcioné el nombre Mariscos de San Felipe, la ubicación El Sauzal, B.C., el eslogan «Del mar lo más natural» y el teléfono comercial. Elegí una paleta azul oscuro y pedí retirar las leyendas académicas de la página pública.

**Consecuencia:** la interfaz muestra la identidad solicitada. En la documentación mantengo la distinción entre datos reales proporcionados y datos de prueba.

## 6. Usar fotografías de referencia y stock de prueba identificado

Pedí sustituir las ilustraciones por imágenes reales. Acepté fotografías de referencia con créditos. Como no contaba con cantidades verificadas, autoricé una carga inicial de prueba y su registro en el historial.

**Consecuencia:** puedo demostrar catálogo e inventario, pero debo hacer un conteo real antes de utilizar esas existencias para operar el negocio. No presento las fotos como propias del local.

## 7. Registrar ventas después de confirmar el pago

Acepté que el contacto y acuerdo con el cliente se hagan por WhatsApp y que el administrador registre la venta después de recibir el pago. Por ahora cada registro corresponde a un producto; una compra de varios productos puede compartir la misma referencia.

**Consecuencia:** no dependo de una pasarela de pago para demostrar el flujo. La aplicación registra la confirmación del administrador, pero no verifica por sí misma un depósito o transferencia.

## 8. Descontar inventario en una operación atómica

Acepté la solución propuesta de guardar venta, monto histórico, movimiento y descuento de existencias en una transacción. También acepté bloquear el producto y reconocer solicitudes repetidas.

**Consecuencia:** una venta inválida no debe dejar un descuento parcial, y reenviar la misma solicitud no debe descontar dos veces. Los cambios posteriores al precio no alteran el precio histórico guardado.

## 9. Cambiar las alertas de WhatsApp a Telegram

Mi primera elección fue WhatsApp, pero tuve dificultades para completar el acceso a la API de Meta. Después elegí Telegram y autoricé crear el bot. Conservé WhatsApp como canal de atención comercial.

**Consecuencia:** las alertas internas funcionan por Telegram; la preparación de WhatsApp queda documentada como una integración no activada. Este cambio debe explicarse al comparar la entrega con la propuesta original; no supongo que el profesor ya lo haya aprobado.

## 10. Revisar stock cada dos minutos y evitar avisos duplicados

Acepté ejecutar la revisión desde Supabase, incluso con la página cerrada. La condición es `stock < stock_minimo`. Se crea un aviso por episodio; reponer hasta el mínimo lo resuelve y una nueva bajada permite otro aviso. Vinculé mi chat mediante un código privado.

**Consecuencia:** el aviso depende del siguiente ciclo y de la disponibilidad de los servicios, no es instantáneo. Los fallos ambiguos no se reintentan automáticamente para evitar duplicados; requieren revisión en el historial.

## 11. Corregir permisos y probar con el rol real del servidor

En la prueba final apareció un permiso faltante para bloquear el producto. Acepté conceder al rol de servidor lectura y actualización de la columna `id`, necesaria para ese bloqueo, conservando los permisos de visitantes y usuarios comunes.

**Consecuencia:** la corrección se aplicó también al SQL del repositorio. Se quitó de la prueba la concesión adicional que ocultaba el problema. Las 14 pruebas pasaron y se comprobó la recepción de la alerta de Almeja en Telegram. Evidencia: `afb82fd`.

## 12. Mantener trazabilidad y declarar límites

Pedí commits descriptivos por avance, sin atribuir coautoría a la IA. Eso no significa ocultar su uso: lo explico en la [bitácora de IA](BITACORA_IA.md), incluyendo generación de código, diagnóstico y configuración asistida.

**Consecuencia:** puedo relacionar las decisiones con el historial y distinguir lo implementado de lo pendiente. No presento los resúmenes de las últimas 100 ventas como reportes completos, ni doy por terminadas las cinco jornadas del plan.

## 13. Trabajar como comercializadora al mayoreo

Aclaré que el negocio comercializa al mayoreo y elegí manejar todos los productos por tonelada. Acepté convertir los productos por kg multiplicando el precio por 1,000 y dividiendo existencias y mínimos entre 1,000. Para el ostión elegí dejar peso y precio pendientes, sin inventar equivalencias desde piezas.

**Consecuencia:** el catálogo, los formularios y las nuevas ventas usan toneladas. Los movimientos y ventas anteriores conservan su unidad original; una tabla administrativa guarda los valores previos a la conversión. No habilito ventas ni alertas de stock del ostión mientras su peso y precio estén pendientes. También elegí una presentación marina con azul profundo, acentos arena y fotografías de referencia, conservando el eslogan y usando el texto de presentación que proporcioné.
