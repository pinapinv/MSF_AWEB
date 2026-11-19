# Supabase y Vercel desde cero

El código está preparado; esta guía no significa que ya existan cuentas, base de datos o despliegue. No se requiere contratar servicios de pago para ejecutar los pasos de configuración inicial si las cuentas ofrecen el plan gratuito correspondiente. Revisar las opciones y límites que aparezcan en cada cuenta antes de aceptar un plan.

## 1. Crear el proyecto de Supabase

1. Abrir https://supabase.com/dashboard y crear/iniciar sesión en tu cuenta. Completar personalmente contraseñas y aceptación de términos.
2. Crear una organización si lo solicita y un proyecto. `msf-aweb` es un nombre sugerido, no un proyecto existente.
3. Guardar la contraseña de la base de datos de forma privada; no se necesita en React ni en el repositorio.
4. En SQL Editor ejecutar el contenido de `supabase/migrations/202611190001_catalogo_inventario.sql` **una vez en un proyecto nuevo**. No ejecutar a ciegas sobre una base existente.
5. Opcionalmente ejecutar `supabase/seed.sql`: añade seis productos ficticios sin existencias. Las entradas se registrarán desde la app.

## 2. Habilitar al administrador

1. En Authentication crear un usuario de correo/contraseña. Completar la confirmación del correo si corresponde. No se ofrece registro público en la app.
2. Copiar el UUID de ese usuario.
3. En SQL Editor ejecutar lo siguiente **sustituyendo** el marcador por su UUID real:

```sql
insert into public.administradores (usuario_id)
values ('REEMPLAZAR_POR_UUID_REAL')
on conflict do nothing;
```

La sesión por sí sola no autoriza la administración: solo los usuarios incluidos en esa tabla pueden editar. El cliente no puede otorgarse permisos. Las claves secretas de Supabase no deben compartirse aquí ni incluirse en Git.

## 3. Configurar la app local

En el panel Connect/API Keys del proyecto copiar la URL del proyecto y su clave **publishable**. Usar estos valores públicos en `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://REFERENCIA_REAL.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICABLE_REAL
VITE_WHATSAPP_NUMBER=
```

Los marcadores no son credenciales válidas. No usar `service_role` ni una clave `secret`. El número de WhatsApp se deja vacío hasta contar con el dato real, con código de país y solo dígitos. Reiniciar `pnpm dev` después de cambiar variables.

Iniciar sesión, registrar una entrada de mercancía y recargar: el stock y el movimiento deben persistir. Abrir el catálogo en otra ventana para confirmar la disponibilidad desde la base.

## 4. Publicar en Vercel

1. Crear/iniciar sesión en https://vercel.com e importar `pinapinv/MSF_AWEB` desde GitHub. Elegir la cuenta/proyecto correcto y autorizar el repositorio solicitado.
2. Framework: Vite. Directorio raíz: raíz del repositorio. Build: `pnpm build`. Salida: `dist`. La configuración se incluye en `vercel.json`.
3. Agregar las dos variables públicas de Supabase en el entorno Production. El número de WhatsApp es opcional. Para Preview, usar una base de pruebas o configurar conscientemente el entorno correspondiente.
4. Ejecutar Deploy. Si se publica sin variables, solo se verá la demostración y no se podrá administrar.
5. En la configuración de URL de Supabase Auth establecer la URL real publicada como Site URL. Usar URLs de redirección concretas si posteriormente se incorporan recuperación de contraseña o invitaciones.
6. Visitar `/`, `/login` y `/admin` en la URL pública y recargar cada ruta. Verificar sesión, permisos y persistencia. Cambiar variables de Vite requiere un nuevo despliegue porque se incorporan durante la compilación.

## Lista breve de aceptación conectada

- Visitante: consulta catálogo; no puede leer historial ni modificar productos.
- Usuario sin autorización: inicia sesión, pero no entra al panel ni modifica mediante API.
- Administrador: crea producto, cambia precio y foto HTTPS; registra entrada y merma.
- Una merma excesiva falla sin modificar stock ni crear historial.
- Al llegar a cero aparece agotado al consultar el catálogo; una entrada restaura disponibilidad.
- Recargar la app y la URL pública conserva datos y sirve las rutas correctamente.

## Referencias oficiales

- https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://vercel.com/docs/frameworks/frontend/vite
