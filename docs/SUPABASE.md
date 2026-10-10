# Supabase WalkWorld

Proyecto aislado `rfrcmvoziarfruarjrcc`, región sa-east-1. No modificar proyectos de otras aplicaciones.

Se desplegaron cinco migraciones (core, mvp_sync, auth_standard, sync_validation, sector_queue) y la Edge Function `walkworld-api`. Tipos en src/data/database.types.ts. Todas las tablas públicas tienen RLS y permisos explícitos. El cliente solo usa una publishable key; las claves de servidor permanecen en el entorno de Supabase.

La función Edge usa auth.getUser(token) antes de cualquier operación. El gateway verify_jwt está deshabilitado deliberadamente para usar esta autenticación propia compatible con las nuevas claves; el endpoint sin token responde 401. RPC sync_walkworld es SECURITY INVOKER y ejecutable solo por service_role. No se concedieron permisos nuevos sobre tablas internas de autenticación.

Datos: perfiles, preferencias, dispositivos, envíos idempotentes, pasos canónicos, ledger, derechos de recompensas, sectores privados. Propiedad diaria fija evita sumar dos dispositivos. La API limita lotes a 100 días/sectores, comprueba fechas/zonas/totales/revisiones y recalcula derechos por transacción con bloqueo de usuario. Los controles de GPS se ejecutan en el cliente: no constituyen prueba criptográfica ni antifraude comercial.

Tests `supabase/tests/access.sql` y `mvp.sql` usan ROLLBACK. La eliminación de cuenta utiliza Auth Admin en el servidor y FKs ON DELETE CASCADE. Los access tokens de signout pueden permanecer válidos hasta caducar; getUser rechaza usuarios eliminados. Copias offline en otros dispositivos requieren borrar almacenamiento local.

Para correos públicos hay que configurar SMTP y permitir redirect `walkworld://auth/callback` en Authentication → URL Configuration. La alternativa de pegar enlace de confirmación ya está implementada. Véase [MVP.md](MVP.md).
