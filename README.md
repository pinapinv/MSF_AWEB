# Mariscos de San Felipe

Aplicación académica de catálogo e inventario para una pescadería en El Sauzal. Primer avance funcional. **El nombre visual, productos, precios y existencias de demostración son ficticios.** No representan datos confirmados de un negocio.

## Tecnologías y organización

Se conserva la forma de trabajo de `demo-react`: React con JavaScript/JSX, Vite, pnpm, React Router con Layout/Outlet, Tailwind CSS, componentes Base UI compatibles con la base shadcn y Lucide. Las llamadas a datos están separadas en `src/api`. Se añade el cliente oficial de Supabase para manejar sesiones y consultas; evita implementar manualmente la renovación de tokens. Despliegue previsto en Vercel.

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
- Ficha de producto con precio por kg/pieza e imagen; ilustración alternativa si no se proporciona foto.
- Contacto telefónico y enlace a WhatsApp con el número del negocio proporcionado por su responsable.
- Login y autorización mediante lista de administradores en Supabase.
- Creación y edición de productos, precios, descripción, promoción, stock mínimo y foto mediante URL HTTPS.
- Entradas y salidas por merma, historial de los últimos 100 movimientos y resumen de inventario.
- Cambio de stock y registro de historial en una sola transacción, bloqueo por producto y protección contra reintentos duplicados.
- Existencias negativas rechazadas; cantidades enteras para piezas y máximo tres decimales para kg.

## Pendiente

- Crear/conectar el proyecto real de Supabase, aplicar SQL, crear el administrador y probar sesión/persistencia en ese servicio.
- Crear el proyecto de Vercel y verificar la URL publicada. **Aún no existe un despliegue verificado.**
- Registro de ventas, reportes por periodo, ingresos y producto más vendido.
- Alertas WhatsApp: detección y cola instaladas, función de envío preparada y desplegada. Falta configurar Meta, secretos y webhook para activar envíos y confirmar recepción. Ver [docs/ALERTAS.md](docs/ALERTAS.md).
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
