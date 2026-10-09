# Verificación de Fase 1

Fecha: 9 de octubre de 2026. Entorno de código: Linux, Node 24.19.0. No hay un teléfono Android conectado, JDK ni Android SDK en este entorno; no se afirma haber probado sensores físicos ni generado un APK.

## Resultados automáticos

| Comprobación | Resultado |
|---|---|
| ESLint `npm run lint` | Sin errores |
| TypeScript `npm run typecheck` | Sin errores |
| Tests `npm test` | 9 aprobados, 0 fallidos |
| Persistencia | Producción SQL ejecutado en SQLite real; preferencias y pasos sobreviven al reabrir el repositorio |
| Primera lectura Android | Se descarta como referencia; no emite un paso al abrir la app |
| Eventos repetidos/reinicio de suscripción | No añaden de nuevo el acumulado |
| Cambio de día | Descarta lote ambiguo de medianoche y continúa con referencia nueva |
| Anomalías | Saltos, fracciones, negativos y contador decreciente rechazados |
| Health Connect | Instantánea idéntica no cambia total/revisión; reemplaza sensor; acepta correcciones hacia abajo |
| Calendario de Chile | Ventana de 23 horas en cambio de horario de verano, sin asumir días de 24 h |
| Dependencias Expo | Coinciden con las versiones del catálogo instalado; check offline informa que su validación es limitada |
| `expo prebuild --platform android --no-install` | Exitoso; genera proyecto Android y actividad de privacidad |
| Manifest generado | Lectura de pasos y actividad física; permisos de GPS/cámara/micrófono/almacenamiento/overlay/vibración bloqueados |
| Rationale/alias Health Connect | Alias Android 14 apunta a `WalkWorldPrivacyActivity`; Android anterior tiene acción en esa actividad, no en Inicio |
| `expo export --platform android` | Bundle Hermes Android generado correctamente |

Prebuild y export verifican la generación nativa y el bundle JavaScript. **No compilan el código Kotlin/Gradle ni validan librerías en un dispositivo.** La primera compilación EAS o local deberá comprobar esa compatibilidad.

## Matriz de pruebas físicas pendientes

En cada prueba registrar modelo, versión Android, versión Health Connect, origen de pasos, permisos, total anterior/posterior y captura de pantalla. No usar registros simulados como resultados reales.

| Prueba | Resultado esperado | Estado |
|---|---|---|
| Instalación APK, arranque sin internet | Inicia sin cuenta; no solicita GPS ni datos de salud automáticamente | Pendiente |
| Sensor: denegar permiso | Mensaje claro, no genera pasos; se puede abrir ajustes | Pendiente |
| Caminar 100 pasos con app abierta | Conteo real, tolerancia documentada; primer evento se usa como referencia | Pendiente |
| Abrir/cerrar 10 veces sin caminar | Total guardado no sube por iniciar sesiones | Pendiente |
| Segundo plano con otra app | Sensor detiene lectura; el registro se etiqueta parcial | Pendiente |
| Health Connect sin productor | Sin actividad inventada; total cero o estado de disponibilidad explícito | Pendiente |
| Health Connect con productor, WalkWorld en segundo plano | Al volver, total coincide con Health Connect; documentar si productor continuó | Pendiente |
| Cierre forzado/reinicio/ahorro de batería | Registrar pérdidas y limitaciones; no prometer recuperación no observada | Pendiente |
| Revocar READ_STEPS | Error visible y reconexión voluntaria | Pendiente |
| Repetir actualización de Health Connect | Total no se suma de nuevo | Pendiente |
| Cambiar fuente tras importar HC | Impide sumar sensor ese mismo día | Pendiente |
| Medianoche y cambio de zona | Sin duplicados; documentar lote descartado y limitación de reloj manual | Pendiente |
| Pantalla pequeña, grande, notch y navegación por gestos | Contenido debajo de hora/batería y encima de navegación | Pendiente |
| Texto ampliado/TalkBack | Botones legibles, navegación accesible y objetivos anunciados | Pendiente |
| Tema claro/oscuro/sistema | Legibilidad y preferencia persistente | Pendiente |
| 30 minutos y 24 h de uso | Medir batería, no atribuir lecturas a temporizadores en segundo plano | Pendiente |

## Próxima etapa

Validar APK y sensor antes de usar estos registros para emitir WalkCoins. Después, implementar Fase 2 con ledger idempotente, límite diario y condiciones verificables. La interfaz no otorga recompensas ni presenta mapas como si ya estuvieran implementados.

## Base de Supabase (preparación de Fase 4)

Se desplegó la migración `walkworld_core` en el proyecto independiente WalkWorld y se ejecutó `supabase/tests/access.sql` en una sola transacción: PASS. Comprueba aislamiento de dos identidades, permisos de invitado, ediciones propias/ajenas, reasignación de propietario, objetivos inválidos y unicidad del ledger. ROLLBACK elimina todos los fixtures; las seis tablas quedaron vacías. Advisors de seguridad sin incidencias.

Esto valida las políticas SQL, no un login del móvil ni sincronización de extremo a extremo: ambas funciones y su validación Android siguen pendientes. Ver [SUPABASE.md](SUPABASE.md).
