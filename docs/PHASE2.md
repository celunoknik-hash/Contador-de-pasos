# Fase 2 — progreso y gamificación local

Código implementado el 9 de octubre de 2026. No equivale a un MVP comercial validado en teléfono ni a una implementación de sincronización.

## Implementado

- Saldo WalkCoins en Inicio y Desafíos, persistente sin internet. Historial de los últimos 50 movimientos en Progreso; el saldo incluye todos los movimientos.
- Regla base: `floor(min(pasos_aceptados, 20000) / 100)`, hasta 200 monedas base por día. Los restos inferiores a 100 no se trasladan a otro día.
- Retos diarios: 3.000 pasos (+5), 5.000 (+10), objetivo del día (+10). Bonos adicionales al límite de monedas base, registrados automáticamente una vez por reto/fecha.
- Tres objetivos en fechas consecutivas: logro y bono único de +25. Una racha nueva no concede de nuevo el bono mientras el derecho original siga vigente.
- Progreso visible, metas guardadas por día, logros y movimientos. Hoy conserva la meta registrada aunque el usuario cambie sus preferencias; el nuevo objetivo se usa en el siguiente día sin registros.
- Migración SQLite v1 → v2 mantiene pasos y preferencias y reconoce el historial anterior del sensor una sola vez.
- Validación adicional de fechas/objetivos; una lectura marcada anómala con incremento positivo es rechazada también por el repositorio.

## Recompensas y correcciones

Se aceptan **solo los pasos del sensor en primer plano después de las comprobaciones de referencia y cadencia**. Los agregados de Health Connect todavía no distinguen introducción manual ni ofrecen en esta implementación una auditoría de procedencia adecuada: continúan en estadísticas, sin generar monedas, bonos o rachas.

Al reemplazar un día del sensor por Health Connect, el día se vuelve no elegible y se registran ajustes negativos para retirar sus monedas y bonos. Si deja de existir una racha válida, también se retira el bono único; si luego existe otra racha válida, se restaura el derecho de +25, sin duplicar el saldo neto. La interfaz explica la sustitución de fuente y muestra los ajustes.

`rewardTargets` calcula los derechos actuales. `reward_state` almacena cantidad y versión por clave de recompensa; `local_coin_ledger` registra únicamente diferencias, con identidad única `(reward_key, version)`. Pasos, ajustes y estado se confirman en la **misma transacción**. Ante un fallo se deshace el cambio completo; reabrir no genera monedas adicionales. El saldo se deriva de los derechos reconciliados, equivalentes a la suma del ledger y más pequeños que un historial de movimientos por cada 100 pasos.

Durante una lectura se evalúa solo el día modificado. La consulta de rachas se ejecuta al alcanzar la meta o invalidar un día que la cumplía; no vuelve a recorrer y escribir recompensas de todo el historial por cada paso.

Las monedas son exclusivamente virtuales: sin valor monetario, venta o conversión a dinero. El saldo se etiqueta **local de pruebas**. No se envía al ledger remoto ni se confía en él como saldo validado por servidor. Todavía no hay tienda ni gastos de monedas.

## Archivos

| Módulo | Responsabilidad |
|---|---|
| `src/domain/rewards.ts` | Reglas de monedas, retos y rachas |
| `src/data/repository.ts` | Migración v2 y reconciliación transaccional |
| `src/activity/useActivity.ts` | Actualización conjunta del modelo de actividad y saldo |
| `src/ui/screens.tsx` | Saldo, desafíos, logro y movimientos |
| `src/app/(tabs)/challenges.tsx` | Ruta funcional de desafíos |
| `tests/repository.test.ts`, `tests/rewards.test.ts` | Persistencia, correcciones y condiciones |

## Pruebas realizadas

`npm run verify`: lint y TypeScript sin errores, 19 tests aprobados. Incluyen reinicio sin duplicados, umbrales de 100 pasos, límite diario, bonos únicos, meta fija, racha y huecos de fechas, corrección de fuente, ausencia de recompensas HC, fallo inyectado del ledger con rollback, migración v1, fechas inválidas/futuras y equivalencia entre saldo y ledger aunque el historial visible esté limitado.

`npm run prebuild:android`: generación nativa correcta, incluido texto actualizado de privacidad. `npm run bundle:android`: exportación Android Hermes correcta. **No se compiló un APK ni se ejecutaron pruebas físicas o revisión visual en un dispositivo.**

## Cómo probar en Android

Las instrucciones EAS del README siguen vigentes. Con un APK de esta revisión:

1. Activa el sensor voluntariamente, camina con WalkWorld abierta y revisa Inicio. Cada centena de pasos aceptados añade una moneda; la lectura de referencia puede perder el primer paso de la sesión.
2. Cierra y abre sin caminar: saldo y pasos no deben subir por el reinicio.
3. Revisa Desafíos: progreso actualizado y bono automático al cruzar un umbral. No hay botón para reclamarlo repetidamente.
4. Cambia el objetivo en Perfil después de registrar actividad: la meta de hoy debe conservarse.
5. Conecta Health Connect y actualiza: se sustituye el total del día, sus recompensas locales se retiran y Progreso muestra los ajustes. Actualizar de nuevo no añade movimientos duplicados.
6. Repite sin internet. Pasos, movimientos y preferencias deben mantenerse en el teléfono.

Probar límite y racha mediante caminatas reales en varios días; los fixtures SQL de tests automatizados no son evidencia de actividad física. Registrar modelo, Android, fuente y capturas. No adelantar el reloj para presentar una racha simulada como prueba real.

## Pendiente

- Validar sensor, batería, accesibilidad y presentación en un teléfono real. Los controles locales no impiden un teléfono modificado, manipulación del reloj ni alteración externa del almacenamiento.
- Auditar Health Connect por método de registro/procedencia antes de activar recompensas sobre esa fuente.
- Desafío de descubrir un sector: depende de Fase 3; la tarjeta informa que está pendiente y no pide GPS.
- Login, separación de almacenamiento por cuenta, outbox, conciliación en servidor y eliminación: Fase 4. No importar automáticamente este saldo a Supabase; el servidor debe recalcularlo a partir de actividad validada.
