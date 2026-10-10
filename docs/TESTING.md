# Pruebas del MVP — 10 de octubre de 2026

Resultados actuales: [MVP.md](MVP.md). Lint/TypeScript y 30 pruebas de lógica/SQLite real pasan; Edge Function pasa deno check, API sin token devuelve 401, pruebas SQL transaccionales pasan y advisors no detectan incidencias. Prebuild, bundle Hermes y Gradle assembleRelease pasan; APK arm64 generado, firma v2 e integridad verificadas. Claves foráneas en cascada comprobadas por lectura de catálogo. Prueba adicional de borrado de fixtures preparada en deletion.sql pero no ejecutada (error de requestState de la herramienta). Ninguna prueba física está completada.

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


Añadir: descubrir sectores caminando, denegar ubicación, salir de Explorar y verificar detención GPS, señal imprecisa/saltos, persistencia de sectores, registro/confirmación/recuperación, login offline, importación explícita de invitado, cola al reconectar, dos cuentas sin mezcla, dos dispositivos sin sumar y eliminación por cascada. Todo pendiente en Android físico.
