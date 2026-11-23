# Cómo concretar y registrar una venta

## Operación por tonelada

La comercializadora opera al mayoreo por tonelada (1 t = 1,000 kg). La conversión conserva el valor: precio por kg × 1,000; existencias y mínimo en kg ÷ 1,000. Los precios siguen siendo de ejemplo hasta ser confirmados por el negocio. Las nuevas cantidades solo admiten toneladas enteras o medias: 0.5, 1, 1.5, 2... Los montos se redondean a centavos. El mínimo fijo de inventario para alertas es 1 tonelada.

El ostión queda **por cotizar**, con peso y precio pendientes. No se deduce un peso a partir de piezas ni se permite registrar movimientos o ventas mientras esté pendiente. Para habilitarlo: editar el producto, confirmar su precio por tonelada, desmarcar la casilla de pendientes, guardar y registrar el peso real como entrada. Los ceros internos mientras está pendiente no representan un conteo confirmado.

La conversión guarda los valores anteriores en `conversiones_unidad`, consultable solo por administradores. Los movimientos anteriores conservan su unidad en una columna propia y las ventas históricas conservan cantidad, unidad, precio y monto. Para una instalación nueva, aplicar `supabase/sql/mayoreo_toneladas.sql` después de los scripts de ventas y Telegram; no volver a ejecutarlo sobre la misma instalación.

## Flujo de venta

El flujo integrado ahora se inicia con **Solicitar por Telegram** desde el detalle de un producto. El bot pregunta cantidad y envía la solicitud al administrador. Aceptar registra automáticamente la venta y descuenta stock; denegar no modifica el inventario. No registrar esa misma venta otra vez con el formulario manual. Ver [pedidos por Telegram](PEDIDOS_TELEGRAM.md).

El siguiente flujo manual sigue disponible para ventas coordinadas por otros medios:

1. El cliente abre un producto y pulsa **Consultar por WhatsApp**.
2. El negocio acuerda cantidad, entrega y pago por ese canal. La página no cobra ni verifica pagos bancarios.
3. Después de recibir el pago, el administrador entra en **Ventas**, selecciona el producto y la cantidad y añade una referencia opcional.
4. Confirma que el pago fue recibido y pulsa **Confirmar venta y descontar stock**.

Cada registro corresponde a un producto. Si la compra incluye varios, registrar uno por producto usando la misma referencia. No hay carrito, reservas ni pasarela de pago.

El servidor calcula el monto con el precio vigente al registrar, conserva una copia del nombre, unidad y precio, registra la salida de inventario y actualiza existencias en una sola transacción. Rechaza cantidades inválidas, piezas fraccionadas y ventas sin stock. Reintentar la misma solicitud no descuenta dos veces. Si un reintento cambia los datos, se rechaza para evitar confundir ventas distintas.

La fecha se registra en el servidor y se muestra en la zona America/Tijuana. El historial presenta las últimas 100 ventas y el total de esas filas; no es un reporte de todas las ventas históricas.

Si la venta baja las existencias por debajo del mínimo, se genera la alerta y Telegram la procesa cuando el bot esté configurado y vinculado. Una falla de Telegram no cancela una venta ya guardada.

## Existencias iniciales

Se cargaron cantidades de prueba autorizadas mediante movimientos con la nota **Carga inicial de prueba autorizada**: filete 12 kg, camarón 8 kg, pulpo 5 kg, ostión 36 piezas, almeja 2 kg y pescado entero 10 kg. No son cantidades verificadas en el negocio. Sustituirlas con entradas o mermas de ajuste después del conteo real.

Las fotografías son reales, de referencia, con origen y licencia en `/creditos-fotos.html`. No se presentan como fotografías tomadas en el local.

## Stock de ejemplo vigente: enteros y medios

La responsable autorizó sustituir las cantidades anteriores por datos de ejemplo: filete 5 t, camarón 3 t, pulpo 1.5 t, almeja 1 t y pescado entero 4 t. Todos los mínimos son 1 t. El ostión conserva su condición de peso y precio pendientes. Estos datos no son un conteo real del negocio.

Cada ajuste se registró como movimiento con la nota «Ajuste de stock de ejemplo autorizado: toneladas enteras y medias». No se redondearon las ventas ni los movimientos anteriores. Para reproducir esta etapa, aplicar `supabase/sql/toneladas_enteras_medias.sql` una sola vez, después de `pedidos_telegram.sql`.
