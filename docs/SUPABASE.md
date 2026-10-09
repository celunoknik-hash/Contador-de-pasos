# Supabase — diseño de Fase 4

Estado: no se creó una base de datos de WalkWorld en esta entrega. Se pudo consultar la organización disponible, pero la operación para consultar el costo de creación no está expuesta por el servicio conectado. No se modificó el proyecto existente de Gestión Negocio. Fase 1 funciona sin Supabase.

Crear un proyecto independiente `WalkWorld`, preferentemente en São Paulo para usuarios en Chile, después de elegir organización y confirmar el costo que indique Supabase. No se debe inferir que habrá cupo gratuito disponible. No incluir la clave secreta/service-role en la aplicación.

## Esquema previsto

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

## Trabajo pendiente

No hay cliente de autenticación, sincronización, migraciones desplegadas ni RLS aplicado todavía. Este documento define el contrato; no equivale a una base segura ya operativa. Las migraciones se generarán con el CLI a partir del esquema implementado y verificado en el nuevo proyecto.
