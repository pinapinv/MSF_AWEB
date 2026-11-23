# Cómo concretar y registrar una venta

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
