# Mariscos de San Felipe

Aplicación de catálogo, inventario y registro de ventas para la comercializadora de mayoreo Mariscos de San Felipe, en El Sauzal, B.C. La operación actual es por tonelada. El nombre, ubicación, eslogan y contacto fueron proporcionados por la responsable. **Las existencias iniciales y los precios de ejemplo no representan datos comerciales verificados.** Las fotografías son de referencia y tienen sus créditos incluidos.

## Entrega

- [Repositorio de GitHub](https://github.com/pinapinv/MSF_AWEB)
- [Proyecto desplegado](https://msf-aweb.vercel.app)
- [Bitácora de uso de IA](docs/BITACORA_IA.md)
- [Diario de decisiones](docs/DIARIO_DECISIONES.md)

## Tecnologías y organización

Se conserva la forma de trabajo de `demo-react`: React con JavaScript/JSX, Vite, pnpm, React Router con Layout/Outlet, Tailwind CSS, componentes Base UI compatibles con la base shadcn y Lucide. Las llamadas a datos están separadas en `src/api`. Se añade el cliente oficial de Supabase para manejar sesiones y consultas; evita implementar manualmente la renovación de tokens. El sitio está desplegado en Vercel y conectado a Supabase.

```text
src/
  main.jsx             Rutas
  Layout.jsx           Navegación y estado compartido del catálogo
  App.jsx              Catálogo, búsqueda, filtros y detalle
  Login.jsx            Inicio de sesión con Supabase Auth
  Admin.jsx            Productos, inventario e historial
  api/productos.js     Acceso a datos y función de movimientos
  components/ui/       Componentes reutilizables
  data/demo.js         Datos ficticios para vista sin Supabase
  lib/                 Cliente Supabase y reglas de presentación
supabase/
  migrations/          Esquema, permisos RLS y transacciones
  seed.sql             Productos de ejemplo opcionales
tests/                 Reglas de catálogo e integración PostgreSQL
docs/                  Configuración, plan y alertas
```

## Ejecutar

Requiere Node.js 22.12 o superior y pnpm 12.14.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Sin variables de Supabase muestra un catálogo de demostración **de solo lectura**. No simula un login exitoso ni guarda cambios en el navegador. Cuando se configuran las variables, los errores de Supabase se muestran; no se sustituyen por datos ficticios.

Copiar `.env.example` a `.env.local` y completar los valores públicos según [la guía de configuración](docs/CONFIGURACION.md). Nunca colocar claves `service_role` o secretas en variables `VITE_*`.

## Incluido en este avance

- Catálogo responsivo con categorías, búsqueda sin distinción de acentos, precio máximo, promociones y disponibilidad.
- Ficha de producto con precio por tonelada e imagen; cotización pendiente cuando faltan peso y precio.
- Contacto telefónico y enlace a WhatsApp con el número del negocio proporcionado por su responsable.
- Login y autorización mediante lista de administradores en Supabase.
- Creación y edición de productos, precios, descripción, promoción, stock mínimo y foto mediante URL HTTPS.
- Entradas y salidas por merma, historial de los últimos 100 movimientos y resumen de inventario.
- Cambio de stock y registro de historial en una sola transacción, bloqueo por producto y protección contra reintentos duplicados.
- Existencias negativas rechazadas; cantidades nuevas en toneladas enteras o medias (0.5, 1, 1.5...). El mínimo para alertas es una tonelada y el historial anterior conserva su precisión.

## Pendiente

- Reportes completos por periodo y producto más vendido (el registro de ventas y el total de las últimas 100 ventas ya están incluidos).
- Sustituir existencias iniciales y precios de ejemplo por datos confirmados del negocio.
- Carga de archivos de fotos a Storage (por ahora se editan por URL).
- Actualización de stock entre visitantes sin recargar: por ahora los datos se consultan al abrir la app y se actualizan después de operaciones del panel. La sincronización en tiempo real queda pendiente.

## Verificación

```sh
pnpm lint
pnpm test
pnpm build
```

Las pruebas usan PostgreSQL embebido (PGlite) para ejecutar la migración real y comprobar RLS, autorización, edición de precio, bloqueo de escrituras directas a stock, rechazo de mermas excesivas, piezas enteras e idempotencia. Auth se sustituye por un esquema mínimo de prueba: **no reemplaza una prueba real de Supabase Auth o Vercel**.

Verificados en navegador: catálogo, búsqueda, detalle, filtro de disponibilidad, redirección del panel sin configuración y presentación móvil. El formulario administrativo todavía requiere pruebas de extremo a extremo con una cuenta de Supabase.

## Avances y commits

Plan actualizado en [docs/PLAN_5_DIAS.md](docs/PLAN_5_DIAS.md). Cada avance se sube con un mensaje descriptivo, usando la identidad Git de la estudiante, sin atribuciones de coautoría a herramientas.

## Ventas y alertas

Los clientes pueden [solicitar un producto por Telegram](docs/PEDIDOS_TELEGRAM.md), responder la cantidad en toneladas y esperar la decisión del administrador en su chat con el bot. Aceptar registra la venta y descuenta stock una sola vez; denegar conserva existencias. El bot no verifica pagos ni reserva stock antes de aceptar. Historial en Administración > Alertas.

Registro de ventas con descuento atómico de stock, precio histórico, protección contra reintentos e historial: [docs/VENTAS.md](docs/VENTAS.md). Telegram es ahora el canal elegido para alertas internas; WhatsApp permanece como contacto comercial. Las fotos reales y sus créditos están incluidos en `public/productos`.

El bot de Telegram quedó vinculado y se comprobó la recepción de una alerta real usando el stock de prueba de Almeja (2 kg, mínimo 3 kg). La revisión automática está activa cada dos minutos. Detalles y límites: [docs/ALERTAS.md](docs/ALERTAS.md).

## Carrito de mayoreo

El catálogo permite agregar varios productos y elegir sus toneladas en `/carrito`. Al procesarlo, se prepara un pedido con precios del servidor que el cliente envía al bot. El administrador acepta o deniega el carrito completo desde Telegram. Solo aceptar registra las ventas y descuenta stock; no hay reservas ni verificación bancaria. [Guía del carrito](docs/PEDIDOS_TELEGRAM.md).
