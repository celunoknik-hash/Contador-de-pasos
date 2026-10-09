# Supabase — base desplegada y trabajo de Fase 4

Proyecto independiente **WalkWorld**, activo en São Paulo (`sa-east-1`).

- Referencia: `rfrcmvoziarfruarjrcc`.
- API: `https://rfrcmvoziarfruarjrcc.supabase.co`.
- Dashboard: https://supabase.com/dashboard/project/rfrcmvoziarfruarjrcc
- Migración remota y local: `20261009225930_walkworld_core`.
- Tipos generados de la base desplegada: `src/data/database.types.ts`.

La conexión administrativa con Supabase funciona. **La aplicación móvil todavía funciona solo con SQLite: no tiene login ni sincronización activados.** No se empaquetaron claves ni se modificó Gestión Negocio.

## Tablas realmente desplegadas

| Tabla | Acceso de una cuenta autenticada |
|---|---|
| profiles | Leer, crear y actualizar exclusivamente su perfil |
| preferences | Leer, crear y actualizar exclusivamente sus preferencias |
| devices | Leer exclusivamente sus dispositivos; registro reservado al servidor |
| step_submissions | Leer sus envíos; escrituras reservadas al servidor |
| daily_steps | Leer sus totales; escrituras reservadas al servidor |
| coin_ledger | Leer sus movimientos; escrituras reservadas al servidor |

RLS activo en las seis tablas, con ownership por `auth.uid()`. Sin privilegios para `anon`. Perfiles y preferencias tienen políticas INSERT y UPDATE con comprobación de propietario. Ninguna tabla permite DELETE desde el cliente: la eliminación de la cuenta deberá realizarse mediante un endpoint autenticado con revocación de sesiones y limpieza local. Las claves foráneas eliminan los datos relacionados al borrar el usuario.

Claves únicas para eventos/revisiones de pasos y movimientos de monedas. Estas restricciones previenen duplicados de identidad; **todavía no existe el servicio que valide pasos o conceda monedas**. No hay saldo editable por el cliente ni escrituras directas del móvil sobre pasos canónicos, dispositivos o recompensas. La base admite correcciones de instantáneas, pero su reconciliación debe implementarse en el endpoint antes de habilitar sincronización.

## Verificación realizada

`supabase/tests/access.sql` se ejecutó completo en la base remota. Usa dos identidades temporales dentro de una transacción que termina con ROLLBACK; no deja usuarios, pasos o monedas de prueba guardados.

Comprobó: lectura privada en las seis tablas, acceso denegado a invitados, creación/edición del perfil propio, bloqueo de lectura/edición/inserción sobre otra cuenta, bloqueo de reasignación de propietario, validación del objetivo, ausencia de permisos de escritura de actividad/recompensas y rechazo de un movimiento duplicado. Resultado: PASS. Después se verificó que las seis tablas siguen vacías.

Advisors de seguridad: sin incidencias. Rendimiento: dos avisos informativos de índices todavía no usados, esperado en una base vacía; se conservan para claves foráneas y consultas del historial. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

El archivo de migración fue creado con `supabase migration new walkworld_core` y alineado después con la versión asignada por la migración remota. No volver a ejecutar su CREATE TABLE sobre la base existente. Para reproducir en una base vacía, aplicar la migración una vez. Ejecutar las pruebas completas en una sesión con permisos administrativos; no ejecutar fragmentos ni añadir estas identidades a la aplicación.

## Pendiente para conectar el móvil

1. Cliente Supabase tipado y clave publishable, con sesión en SecureStore. Nunca service-role o claves secretas en Expo.
2. Registro, confirmación de correo, login, recuperación de acceso y cierre de sesión con manejo de errores.
3. Bases locales separadas por usuario, manteniendo invitado sin conexión. Importar datos de invitado únicamente por acción explícita; no transferir silenciosamente los datos entre cuentas.
4. Outbox local transaccional, endpoint autenticado, validación de fuente/revisión, reintentos y confirmación del servidor. No sumar dispositivos ni fuentes superpuestas.
5. Endpoint de eliminación y revocación de sesiones, más pruebas de Auth/REST con dos usuarios reales y validación Android. Las pruebas SQL no equivalen a estas pruebas de extremo a extremo.

La configuración necesaria del proyecto ya está disponible mediante la conexión autorizada; no es necesario compartir contraseñas ni claves privadas en el chat. No activar funciones de nube hasta completar estos puntos.

## Contrato previsto para las siguientes fases

| Tabla | Clave/identidad | Escritura prevista |
|---|---|---|
| profiles | `user_id` → auth.users, nombre/avatar | Propietario, campos no privilegiados |
| preferences | `user_id`, meta/tema/peso/longitud | Propietario |
| devices | `id`, `user_id`, fuente principal | Alta validada; evita sumas por teléfono |
| daily_steps | `user_id, local_date`, zona, fuente, pasos, revisión, calidad | API validada, no un saldo editable |
| step_submissions | `user_id, device_id, client_event_id` único | Entrada idempotente con auditoría |
| coin_ledger | `id`, `user_id`, `idempotency_key` único, motivo/delta | Exclusivamente servidor |
| challenges | `id`, versión de regla y condición | Administración |
| challenge_progress | `user_id, challenge_id, period_key` | Servidor verifica condición |
| achievements | Catálogo | Administración |
| user_achievements | `user_id, achievement_id` | Servidor |
| explored_cells | `user_id, grid_version, cell_id` único | API valida sesión |
| exploration_sessions | `id`, `user_id`, consentimiento/fechas | API validada, sin recorrido preciso por defecto |
| entitlements | `user_id`, capacidades/vigencia | Servidor; esenciales siempre gratuitas |

Saldo: derivado del ledger, o caché mantenida en la misma transacción. Nunca permitir UPDATE del saldo desde el cliente. Los pasos del cliente no son prueba criptográfica de caminata.

## Seguridad y recompensas

- RLS en cada tabla expuesta. SELECT con `(select auth.uid()) = user_id`. En las tablas editables por el propietario: UPDATE con USING y WITH CHECK; no permitir reasignar propietario. Separar políticas por operación.
- Catálogos públicos autenticados de solo lectura; ledger, logros y progresos no reciben escrituras directas desde móvil. Conceder privilegios SQL explícitos junto con RLS.
- Cada día: derecho base `floor(min(pasos_elegibles, 20000)/100)`. El servidor compara con lo ya concedido y añade solo la diferencia positiva, dentro de una transacción con bloqueo de la fila del usuario/día. Reenvíos y concurrencia no duplican monedas.
- No sumar pasos de múltiples dispositivos/fuentes. Elegir una fuente diaria principal y aplicar reconciliación. Auditar orígenes y método de registro; registros manuales no deben generar WalkCoins. Diseñar tratamiento de correcciones posteriores y desfases de zona horaria antes de emitir recompensas.
- UUID de evento + revisión local, outbox transaccional, reintentos con backoff y confirmación del servidor. Una reconexión solo envía eventos pendientes, no vuelve a otorgar recompensas.
- Endpoint de eliminación autenticado, revocación de sesiones, borrado de filas mediante cascadas y limpieza de datos locales de la cuenta. Definir tratamiento de auditorías y retención antes de publicación.
- SecureStore para sesiones; cliente con clave publishable. Secretos únicamente en servidor. Revisar advisors, tipos generados y pruebas de aislamiento con dos usuarios antes de habilitar la nube.

