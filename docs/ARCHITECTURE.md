# WalkWorld — Arquitectura y decisiones

Versión 0.1.0. Alcance entregado: Fase 1 y Fase 2 local. Android inicial. Aplicación móvil real, sin datos de demostración en producción.

## Capas

| Capa | Módulos | Responsabilidad |
|---|---|---|
| Dominio | `src/domain/activity.ts`, `rewards.ts` | Días locales, estimaciones, validaciones, consumo de eventos acumulativos y derechos de recompensas |
| Fuentes | `src/activity/healthConnect.ts`, `useActivity.ts` | Permisos, lectura agregada de Health Connect, suscripción real al sensor y ciclo de vida |
| Persistencia | `src/data/repository.ts`, `local.ts` | Interfaz reemplazable; SQLite, transacciones, conciliación de instantáneas |
| Presentación | `src/ui/`, `src/app/` | Expo Router, cinco pestañas, anillo animado, estadísticas, preferencias, modo oscuro, áreas seguras |
| Configuración Android | `app.json`, `plugins/withWalkWorldPrivacy.js` | Permisos mínimos y explicación de privacidad nativa sin conexión |
| Distribución | `eas.json` | Development/preview APK; producción AAB |

Los componentes consumen el modelo de actividad, sin acceso directo a sensores o SQL. `ActivityRepository` permite sustituir o extender almacenamiento. Las fuentes se seleccionan de forma explícita; no se suman entre sí.

## Dependencias

El proyecto parte de la plantilla oficial blank-typescript disponible al crear la app: Expo 57.0.27, React Native 0.86.3 y React 19.2.3. Los paquetes Expo y nativos se seleccionaron desde `expo/bundledNativeModules.json`. Health Connect 4.1.3 incluye su plugin Expo y delegado de permisos. `package-lock.json` fija el árbol reproducible.

Se usa SQLite con WAL en vez de un documento JSON completo: cada actualización se confirma mediante transacción. Se guarda una fila por fecha local, con fuente, calidad parcial, zona horaria, objetivo, revisión y anomalías. Android backup queda desactivado para no copiar datos de actividad al respaldo del sistema.

Health Connect requiere un APK o development build; Expo Go sirve únicamente para revisar el sensor disponible y la UI. Compatibilidad nativa final requiere una compilación Gradle y pruebas físicas: prebuild y bundle JavaScript no la sustituyen.

## Lectura y consistencia

### Sensor del teléfono

Se comprueba disponibilidad y se solicita actividad física tras pulsar activar. Se suscribe solamente con la app en primer plano; se elimina la suscripción al pausar, salir del primer plano o cambiar de fuente. Cada nueva suscripción usa una referencia nueva. La primera lectura establece la referencia y no añade pasos: en la implementación Android de Expo puede llegar el contador actual con un incremento inicial de 1. Esto evita pasos fantasma al reiniciar; puede perder el primer paso de una sesión.

Eventos repetidos no añaden pasos. Se rechazan reinicios inesperados del contador, fracciones, números negativos, saltos incompatibles con el tiempo transcurrido y totales de más de 250.000 por día. Estas reglas son controles básicos, no una prueba de actividad física ni un sistema antifraude comercial.

El lote que cruza medianoche se descarta para no atribuir pasos del día anterior al nuevo. Puede perderse ese lote. Las fechas usan el calendario local, incluidos cambios de horario de verano. Cambiar manualmente la hora/zona del teléfono requiere validación adicional antes de emitir recompensas.

### Health Connect

Se pide únicamente `READ_STEPS`. Se usa agregación oficial de pasos para evitar sumar registros superpuestos de varias fuentes. Se consultan los últimos siete días al abrir o reactivar la app, y solo el día actual cada 60 segundos mientras está en primer plano. La app no escribe pasos ni solicita lectura en segundo plano.

Cada total agregado reemplaza la instantánea anterior. La misma instantánea no cambia la revisión. Un total corregido hacia abajo también se acepta. Al conectar Health Connect se reemplaza el registro parcial del sensor: el total puede bajar si los datos de Health Connect están incompletos. No se suman dos fuentes. Un día ya importado de Health Connect no admite después incrementos del sensor; se permite volver al sensor a partir de un día nuevo.

Android 14 con extensión SDK 20 o superior puede contar pasos a través de Health Connect. En otros teléfonos se necesita una fuente que escriba pasos allí. Instalar Health Connect por sí solo no garantiza contar pasos. Conceder acceso no prueba que haya un productor activo ni que el seguimiento sobreviva al cierre forzado.

No se implementa aún un servicio Android permanente. Si las pruebas en teléfonos sin productor muestran que hace falta, se añadirá un adaptador nativo con notificación persistente, manejo de reinicio y restricciones del fabricante. No se reemplazará por un temporizador JavaScript en segundo plano.

### Estadísticas

Distancia = pasos × longitud de paso. Calorías = km × peso × 0,5. Son estimaciones simples configurables, no mediciones médicas. Cambiar peso/longitud recalcula las estimaciones mostradas; los pasos originales permanecen intactos. El historial indica cuándo un registro es parcial. La meta del día de historial se captura con su actividad; la meta de Inicio conserva el objetivo guardado al comenzar el día; los cambios de preferencias se aplican a un día sin registros.

## Ampliación por fases

Fase 2 implementada localmente: ledger, saldo derivado, máximo de 200 monedas base/día más bonos, tres retos diarios y un logro por racha. Pasos y monedas se confirman en una transacción; las correcciones generan movimientos de ajuste. Solo el sensor es elegible: los agregados de Health Connect todavía no se auditan por procedencia/manualidad. Ver `docs/PHASE2.md`. Fase 3: cuadrícula geográfica, sesiones voluntarias de GPS y comprobaciones de desplazamiento junto con pasos; guardar celdas descubiertas, evitar recorridos crudos por defecto. Se evaluará `react-native-maps` compatible con Expo y una clave restringida al paquete/certificado Android.

Fase 4: autenticación Supabase y sincronización. Tokens en SecureStore; almacenamiento separado por usuario para impedir que los datos de una cuenta aparezcan en otra. La importación del historial de invitado debe ser explícita. Conservar estas filas locales no constituye una cola de sincronización ya implementada.

Social, ligas, ciudades, misiones y eventos serán módulos separados. Las funciones premium utilizarán una interfaz de derechos (`Entitlements`) en el dominio. Sensor, meta y progreso diario tendrán acceso gratuito permanente. No se incorporan pagos ni suscripciones ahora.

## Fuentes revisadas

- https://docs.expo.dev/versions/latest/sdk/pedometer/
- https://matinzd.github.io/react-native-health-connect/docs/get-started/
- https://matinzd.github.io/react-native-health-connect/docs/permissions/
- https://matinzd.github.io/react-native-health-connect/docs/api/methods/aggregateRecord/
- https://developer.android.com/health-and-fitness/health-connect/read-data
- Fuente instalada `expo-sensors/android/.../PedometerModule.kt` para comprobar el comportamiento de la primera lectura.
