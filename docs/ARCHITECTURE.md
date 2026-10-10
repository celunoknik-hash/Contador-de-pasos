# Arquitectura actual

La especificación vigente y sus límites se encuentran en [MVP.md](MVP.md).

| Capa | Módulos | Responsabilidad |
|---|---|---|
| Dominio | activity, rewards, exploration, entitlements | Validación, calendario, recompensas, cuadrícula y derechos futuros |
| Actividad | useActivity, recording, módulo Kotlin local, healthConnect | Recording API nativa en segundo plano y lectura agregada de HC |
| Datos | repository, local | SQLite transaccional, cuentas aisladas, revisiones y cola |
| Cuenta | client, secureStorage, useAuth, useSync | Credenciales cifradas, sesión, confirmación y API |
| Exploración | useExploration, ExploreScreen | Sesiones voluntarias, consumo limitado, mapa offline |
| Servidor | walkworld-api, sync_walkworld | Autenticación verificada, datos canónicos y monedas idempotentes |
| UI | src/ui, src/app | Cinco pestañas, temas, accesibilidad y áreas seguras |
| Distribución | app.json, plugins, eas.json | Generación nativa, permisos y firma por perfil |

El repositorio se sustituye mediante ActivityRepository; fuentes, GPS, recompensas y autenticación se separan. Cada fecha registra zona horaria, fuente, objetivo congelado, calidad parcial, revisión y anomalías. Los agregados de HC reemplazan la fuente del día y permiten correcciones hacia abajo. Sensor y HC nunca se suman.

Las tablas de Supabase guardan un dispositivo canónico por día y envíos por dispositivo/revisión. No se suman teléfonos; la primera fuente del día se conserva salvo conciliación hacia HC. El servidor recalcula derechos y añade diferencias al ledger con clave única por derecho/version. Desafíos/logros se derivan del historial.

Las consultas y el GPS de WalkWorld se detienen al pasar a segundo plano; la suscripción de Recording API permanece activa en Google Play Services. Su intervalo empieza al activarla y cambia al pausar o cambiar de cuenta. Cada cuenta guarda un cursor de total por fecha, escrito atómicamente con actividad, monedas y cola; las lecturas repetidas o menores no generan pasos adicionales. No se combina un watcher de Expo con Recording API. Al cambiar de cuenta el proveedor se desmonta y usa otra base. Las instantáneas remotas solo son caché de presentación; nunca pasan por recordSensor ni vuelven a generar monedas. La cola se confirma por revisión exacta. El token no autoriza un user_id enviado por cliente: la API obtiene la identidad con auth.getUser.

Las sesiones GPS mantienen posiciones solo en memoria y almacenan sectores privados. No hay ubicación permanente ni lectura HC en segundo plano. Social, ligas, ciudades y misiones serán módulos independientes; no se implementan ahora. Los derechos futuros están separados del núcleo gratuito.

Dependencias fijadas en package-lock.json y módulos Expo compatibles con SDK 57. Detalles y límites de retención: [BACKGROUND.md](BACKGROUND.md). Fuentes: documentación Expo 57 (Pedometer, Location, SQLite, SecureStore y Router), documentación oficial Android Health Connect, documentación Supabase Auth y plugin react-native-health-connect 4.1.3.
