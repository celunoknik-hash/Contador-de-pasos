# Registro en segundo plano — WalkWorld 0.2.0

## Implementado

Módulo local Expo `modules/walkworld-recording` en Kotlin. Dependencia oficial `com.google.android.gms:play-services-fitness:21.2.0`, `FitnessLocal.getLocalRecordingClient`, tipo `LocalDataType.TYPE_STEP_COUNT_DELTA`. Esta es Recording API **on mobile**, sin cuenta Google, distinta de la antigua API Google Fit con OAuth. No requiere un backend de pago, GPS permanente ni un servicio de WalkWorld con notificación permanente.

Activación voluntaria solicita únicamente ACTIVITY_RECOGNITION. Se comprueba sensor TYPE_STEP_COUNTER y versión mínima de Google Play Services. Si falta compatibilidad, se muestra error y se ofrece Health Connect; no se sustituye por actividad inventada.

Google Play Services mantiene la suscripción cuando WalkWorld pasa a segundo plano. Al volver, WalkWorld consulta ventanas por día de hasta 10 días, cada una limitada al inicio real de la suscripción de esa cuenta. Mientras está visible, actualiza cada 15 segundos. No hay temporizadores JavaScript pretendiendo ejecutarse con la app cerrada, ni watcher de Expo contando en paralelo.

`src/activity/recording.ts` serializa las operaciones nativas entre cuentas. El módulo guarda el propietario local (UUID de dispositivo por cuenta) y el inicio del intervalo. Al cambiar de cuenta empieza un intervalo nuevo: jamás asigna a la cuenta entrante los pasos anteriores. Si la nueva cuenta está pausada, detiene la colección. No importa automáticamente pasos de invitado.

`src/data/repository.ts` guarda el total ya procesado por fecha e intervalo. Cada lectura añade solo la diferencia positiva, con cursor, actividad, recompensas y cola dentro de la misma transacción SQLite. Reiniciar o repetir la consulta no duplica pasos ni WalkCoins. Totales temporalmente menores no restan ni se vuelven a acreditar. La fuente de datos sigue siendo `sensor` (sensor del teléfono vía Recording API), compatible con validación y límites existentes de Supabase. Los datos HC no se suman con los del sensor.

Pausar intenta recuperar primero el historial disponible y elimina la suscripción. Volver a activar comienza un intervalo nuevo. Android mantiene el registro por medio de Google Play Services; eliminar el componente React o bloquear la pantalla no elimina la suscripción.

## Limitaciones reales

- Google Play Services guarda **hasta 10 días**, no indefinidamente. Esta versión no tiene todavía un Worker nativo que archive diariamente el historial cuando WalkWorld no se abre. Debe abrirse al menos cada 9 días; periodos anteriores no guardados pueden perderse. Los días ya guardados en SQLite permanecen.
- Los pasos anteriores a la primera activación no se importan automáticamente. La actualización conserva los pasos y monedas de 0.1.0 y comienza un intervalo adicional; no vuelve a contar el mismo periodo.
- La API puede actualizar con retraso. Pausar elimina datos que aún no haya entregado; no se garantiza recuperar cada último paso inmediatamente antes de pausar.
- Permiso revocado, forzar detención, reinicio, ahorro de batería y restricciones del fabricante requieren pruebas físicas. No se ofrece una garantía de registro tras forzar detención o borrar datos. Reactivar después de revocar permisos puede necesitar un intervalo nuevo.
- No se ha probado esta integración en teléfono real. La compilación valida integración nativa, no demuestra captura de pasos con pantalla bloqueada ni consumo de batería.
- La exploración GPS sigue siendo exclusivamente voluntaria y en primer plano; no se desbloquean sectores geográficos mientras el GPS está detenido.
- No se añadió un servicio propio de respaldo para teléfonos sin Play Services. Health Connect sigue disponible con sus condiciones existentes.

## Pruebas automáticas

`npm run verify`: 33 pruebas; lint y TypeScript. Tres pruebas nuevas ejecutan SQL real: cursor persiste tras reiniciar sin doble recompensa; intervalo nuevo tras pausa descarta lecturas obsoletas y separa días; fallo del ledger revierte cursor y actividad y permite reintento. Expo prebuild detecta y enlaza el módulo local.

Compilación APK en GitHub Actions: verificar estado del commit de esta entrega antes de distribuir. Firma de pruebas, arm64, Android 9+.

## Prueba Android pendiente

1. Instalar el APK 0.2.0; activar sensor y conceder actividad física. No necesita iniciar sesión con Google ni abrir una app fitness.
2. Anotar pasos y monedas; bloquear pantalla, guardar en bolsillo y caminar 100–200 pasos contados manualmente. Esperar actualización y abrir WalkWorld: revisar diferencia y ausencia de pasos duplicados.
3. Repetir usando otra aplicación durante 5–10 minutos. Reabrir varias veces; el mismo total no debe aumentar las monedas.
4. Cerrar la app desde recientes, reiniciar el teléfono y probar ahorro de batería por separado. Registrar modelo, versión Android, Google Play Services y resultados; no generalizar un resultado a todos los teléfonos.
5. Probar cambio de día, pausa/reanudación, permiso revocado, modo avión y posterior sincronización. Conservar historial previo a la actualización.
6. Cambiar de cuenta y volver; la cuenta nueva no debe recibir pasos previos de la anterior. Comprobar eliminación de cuenta y transición a invitado.
7. Contrastar consumo de batería durante varias horas. Verificar que el GPS no se activa fuera de Explorar.

## Fuentes oficiales consultadas

- https://developer.android.com/health-and-fitness/recording-api
- https://developers.google.com/android/reference/com/google/android/gms/fitness/LocalRecordingClient
- https://docs.expo.dev/versions/v57.0.0/sdk/expo/
- https://docs.expo.dev/modules/get-started/
- https://docs.expo.dev/modules/module-api/
