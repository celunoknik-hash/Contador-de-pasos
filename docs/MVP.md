# WalkWorld — entrega del MVP

Actualizado el 10 de octubre de 2026. Código funcional para Android, sin pasos o ubicaciones de muestra. Las pruebas físicas están pendientes: este documento distingue implementación, compilación y comportamiento observado.

## Fase 3 — exploración implementada

- Cuadrícula geográfica offline de 120 metros proyectados (tamaño real disminuye según latitud), con ventana de 25 sectores y porcentaje de esa ventana.
- Sesión voluntaria de ubicación en primer plano; permiso solo al iniciarla, detenida al salir de Explorar o pasar a segundo plano.
- Precisión ≤25 m, posiciones recientes/no simuladas, velocidad ≤3 m/s, desplazamiento ≤150 m entre referencias, mínimo 12 pasos del sensor y distancia compatible. La primera ubicación no desbloquea nada; no se reconstruye un recorrido entre saltos.
- SQLite conserva sectores. Primer sector concede +10 WalkCoins una sola vez.
- No se guardan coordenadas GPS crudas ni recorridos. Los identificadores de sectores siguen siendo datos sensibles de ubicación y se sincronizan privados en cuentas.
- Módulos: `src/domain/exploration.ts`, `src/exploration/`, repositorio SQLite, ruta `src/app/(tabs)/explore.tsx`.
- Límite: mapa sin calles, controles básicos sin prueba criptográfica de actividad; GPS o sensor ausente/denegado impiden descubrir sectores. Sin exploración en segundo plano.

## Fase 4 — cuentas y sincronización implementadas

- Correo/contraseña, registro, confirmación por enlace, recuperación y cambio de contraseña, cierre local de sesión y eliminación de cuenta/datos mediante API autenticada.
- Credenciales cifradas con Expo SecureStore, almacenamiento fragmentado para tokens largos, reemplazo transaccional del puntero y operaciones serializadas por clave. No hay clave de servidor en la app.
- Una base SQLite por usuario y otra de invitado. La importación de invitado es explícita, conserva su copia y nunca suma días que ya existen en la cuenta.
- Cola durable de días/revisiones, sectores y preferencias. Reintenta al volver al primer plano y cada minuto mientras la app está activa; también permite sincronizar manualmente. Tiempo máximo de solicitud 20 s y cancelación al salir/cambiar de cuenta.
- Solo se confirman las revisiones enviadas: los pasos o preferencias nuevos quedan pendientes. El saldo remoto no se suma al local. Si un sector no tiene suficientes pasos elegibles en la nube (por ejemplo, tras cambiar a Health Connect antes del primer envío), permanece pendiente sin bloquear la sincronización del resto. Sin conexión se conserva el último saldo sincronizado y el historial local.
- Supabase tiene RLS y permisos explícitos en todas las tablas. `walkworld-api` valida cada token con `auth.getUser`; únicamente el servidor puede ejecutar `sync_walkworld` y escribir pasos canónicos/monedas/sectores.
- Un dispositivo es propietario del registro canónico de cada día: se fija al primer envío y no se suman dos teléfonos. El historial remoto se muestra sin volver a generar monedas locales. Cambiar/reinstalar un teléfono puede requerir esperar al siguiente día; no existe todavía transferencia del dispositivo principal.
- El servidor calcula las recompensas; revisiones únicas y ledger idempotente impiden pagos repetidos. Corrige derechos al sustituir sensor por Health Connect. Bonos de desafío son adicionales al límite de 200 monedas base/día.
- Perfiles/avatar, objetivos, preferencias, días/fuentes, dispositivos, envíos, ledger/derechos y sectores están en tablas. El progreso de desafíos/logros se deriva de días y sectores para no duplicar estado.
- Eliminación en línea borra el usuario Auth y las filas por cascada, revoca refresh tokens y borra la base de esa cuenta en el teléfono después de detener lectores. Las copias en otros teléfonos sin conexión pueden persistir; allí deben borrarse desde Android. Al cerrar sesión, los JWT emitidos pueden durar hasta su caducidad: el cierre local no promete revocación instantánea del access token. `getUser` impide usar usuarios eliminados.
- Módulos: `src/account/`, `src/data/`, `supabase/functions/walkworld-api/`, migraciones y tipos generados.

## Configuración de correo pendiente de operador

Supabase está integrado y la API desplegada en el proyecto **WalkWorld**, ref `rfrcmvoziarfruarjrcc`. El proyecto de otra aplicación no se modifica.

En el dashboard de WalkWorld, Authentication → URL Configuration debe autorizar `walkworld://auth/callback`. El navegador disponible pide iniciar sesión y no se cambió esa configuración. La app permite pegar el enlace completo de confirmación/recuperación del correo como alternativa sin depender del redirect. No desactives la confirmación de correo para saltarte este paso.

El proveedor SMTP incorporado de Supabase tiene restricciones (incluyendo destinatarios autorizados del equipo) y límites; configurar un SMTP propio y probar entrega es necesario antes de invitar usuarios externos. No se dispone de credenciales de un proveedor de correo ni se han enviado correos de prueba al usuario.

## Fase 5 — verificaciones y distribución

- ESLint y TypeScript pasan. 30 pruebas de dominio/SQLite real pasan; contemplan reinicios, medianoche/DST, anomalías, límites/bonos, correcciones, fallos transaccionales, GPS, sectores, cola y aislamiento.
- `deno check` pasa en la Edge Function. API desplegada responde 401 sin token. Advisors de Supabase de seguridad/rendimiento: sin incidencias.
- `supabase/tests/mvp.sql` pasa en una transacción con ROLLBACK: recompensas esperadas, replay idempotente, dos dispositivos sin sumar, cambio a HC sin recompensas, aislamiento RLS y RPC prohibido al cliente. No deja actividad de prueba en producción.
- Se añade workflow `.github/workflows/android-apk.yml` para generar un APK arm64 de pruebas con bundle release y firma debug, sin claves privadas; no usar en Play Store. La compilación local queda bloqueada por acceso de red al repositorio de plugins Gradle.
- Expo Doctor: 21/21 verificaciones pasan. Prebuild Android y exportación Hermes pasan. Eso no sustituye una compilación Gradle ni pruebas de teléfono.
- Véase `TESTING.md` para matriz Android. Ningún sensor, GPS, correo, inicio de sesión móvil ni batería se ha validado en un teléfono real.

## Probar en Android

1. Node 24, `npm ci`, `npm run verify`.
2. Con cuenta Expo: `npx eas-cli@latest login`, `npx eas-cli@latest build:configure` y `npx eas-cli@latest build --platform android --profile preview`. Instalar el APK de ese build. No usar Expo Go para Health Connect.
3. Alternativa con JDK 17 y Android SDK: `npm run prebuild:android`; `cd android`; `./gradlew assembleRelease`. El proyecto generado usa clave debug para pruebas locales; no publicar ese APK en Play Store. Configurar firma privada de producción con EAS para distribución comercial.
4. Iniciar sin internet, activar sensor, caminar con la app abierta y reiniciar sin caminar: el total debe persistir sin crecer por reinicios. La primera lectura se usa como referencia y puede perder el primer paso.
5. Explorar → iniciar sesión GPS → caminar al exterior con señal precisa y sensor activo. Verificar desbloqueo/primer desafío; salir y comprobar que ubicación se detiene.
6. Perfil → cuenta: probar confirmación, login, sincronización, modo avión, reconexión, dos cuentas sin mezcla y dos dispositivos sin suma. Importar invitado solo si se desea.
7. Health Connect depende de un productor compatible que guarde pasos mientras WalkWorld no está activa. Importa agregados para estadísticas; no da monedas porque aún no se audita actividad manual. No se afirma que WalkWorld cuente con la app cerrada.

No hay pagos, amigos, ligas, clasificaciones o ciudades virtuales. `src/domain/entitlements.ts` prepara permisos futuros manteniendo pasos/progreso diarios gratuitos.
