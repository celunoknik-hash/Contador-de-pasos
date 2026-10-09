# WalkWorld

**Cada paso cuenta. Camina, explora y construye tu mundo.**

Aplicación móvil independiente en español, desarrollada con Expo, React Native y TypeScript. Android es la plataforma inicial. Versión 0.1.0: código de Fase 1 implementado; la validación física y compilación del APK siguen pendientes.

## Implementado

- Sensor real del teléfono mientras la app está abierta; activación voluntaria, disponibilidad y permisos.
- Adaptador Health Connect de solo lectura de pasos, conciliación de totales diarios y recuperación de últimos siete días.
- Objetivo configurable, porcentaje, distancia y calorías aproximadas.
- SQLite sin internet, historial y gráfico de siete días. Controles contra lecturas anómalas y duplicados.
- Perfil local, preferencias persistentes y modo claro/oscuro/sistema.
- Cinco pestañas y áreas seguras superior/inferior. Explorar y Desafíos explican su fase pendiente; todavía no presentan funcionalidades ficticias.
- Configuración EAS para APK de pruebas y AAB de producción, y explicación de permisos de Health Connect nativa y sin conexión.

**No implementado todavía:** WalkCoins, desafíos verificables, mapa/GPS, cuentas, Supabase activo, sincronización, eliminación de cuenta en nube y pagos. El diseño de Supabase está en `docs/SUPABASE.md`; no se usó ni modificó la base de Gestión Negocio.

## Instalar y verificar

Requisitos: Node.js 24 y npm. La versión de Node importa: los tests de persistencia ejecutan SQL real con `node:sqlite`.

```bash
npm ci
npm run verify
npm run prebuild:android
npm run bundle:android
```

Resultados de esta entrega y matriz de teléfono: [docs/TESTING.md](docs/TESTING.md). Arquitectura, módulos y limitaciones: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Probar en Android

### APK completo con Health Connect

Se necesita una cuenta Expo/EAS. Desde una copia del repositorio:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

La configuración inicial puede añadir `extra.eas.projectId` y asociar el proyecto a tu cuenta. Usa el nombre WalkWorld y conserva `com.walkworld.mobile` como paquete. No guardes tokens ni contraseñas en el repositorio. EAS puede tener cuotas/colas según tu plan. Al finalizar una compilación exitosa, descarga su APK e instálalo en un teléfono Android; el perfil preview incluye el JavaScript y funciona sin Metro.

### Compilación local

Con Android Studio, JDK 17 y SDK/NDK compatibles con el proyecto:

```bash
npm ci
npm run android
```

Este comando crea e instala una compilación de desarrollo y requiere un teléfono por USB con depuración habilitada o un emulador. Un emulador no valida que el sensor físico funcione.

### Expo Go

```bash
npm start
```

Expo Go compatible con este SDK permite una prueba limitada del sensor en primer plano y la interfaz. **Health Connect no funciona dentro de Expo Go**; el botón mostrará esa limitación. La app requiere Android y un sensor compatible. No confundir la vista en Expo Go con una compilación Android validada.

## Primera caminata

1. Abre Inicio y pulsa **Activar sensor del teléfono**. Concede actividad física cuando Android lo solicite.
2. La primera lectura establece la referencia, sin añadir pasos. Camina con la app abierta y observa el progreso. Reiniciar no debe sumar pasos por sí solo.
3. Perfil permite guardar nombre, objetivo, longitud de paso, peso estimado y apariencia. Progreso muestra los registros reales guardados.
4. Para recuperar registros externos, pulsa **Conectar Health Connect** en un APK. Concede solo lectura de pasos. Debe existir una fuente que produzca pasos en Health Connect o un dispositivo con conteo integrado compatible.
5. Health Connect reemplaza el total parcial del sensor; puede bajar si contiene menos datos. No se suman fuentes. No se permite volver al sensor el mismo día ya importado de Health Connect.

## Limitaciones importantes

El sensor de Expo no es seguimiento en segundo plano. El adaptador Health Connect lee datos existentes al volver a la app; no prueba que otro productor registre pasos con la app cerrada. No se ha comprobado aún cierre forzado, reinicio del teléfono, consumo de batería o precisión en un teléfono físico.

No se utilizan datos falsos ni GPS. Los controles iniciales no equivalen a un antifraude comercial. No hay claves de Supabase ni credenciales empaquetadas. Los datos son locales; cuentas y nube se implementarán en su fase.
