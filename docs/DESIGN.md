# WalkWorld 0.3.0 — diseño monocromo

La interfaz utiliza blanco cálido, gris y grafito. El modo oscuro invierte la jerarquía de superficies y botones; no aplica un filtro a la pantalla. El rojo queda reservado para errores. No se alteran los sensores, las recompensas, la exploración ni las políticas de sincronización.

## Componentes

- `src/ui/theme.ts`: colores compartidos, incluido texto sobre botones primarios.
- `src/ui/components.tsx`: tarjetas de borde fino, botones, títulos de sección, aro de progreso de 5 puntos y desplegables accesibles.
- `src/ui/Screen.tsx`: contenido centrado con ancho máximo de 620 puntos y desplazamiento vertical.
- `src/app/(tabs)/_layout.tsx`: marca compacta, navegación inferior y áreas seguras del sistema.
- `src/ui/screens.tsx`: inicio, desafíos, progreso, perfil y avatares monocromos.
- `src/exploration/ExploreScreen.tsx` y `src/account/AccountCard.tsx`: tratamiento compartido y detalles secundarios desplegables.
- `assets/brand-mark.svg`: fuente vectorial de los iconos PNG de la aplicación.

Se conserva la fuente del sistema de Android. La inspiración visual no requiere fuentes propietarias de Apple ni dependencias nuevas en la aplicación.

## Validación

Lint, TypeScript, las 33 pruebas existentes y la exportación del paquete Android pasan. Los contrastes comprobados entre texto normal/secundario y sus superficies están entre 5,23:1 y 17,90:1; texto sobre botones, entre 15,74:1 y 16,25:1.

La revisión aislada de los componentes reales mediante React Native Web y Chromium Headless Shell pasó 30 combinaciones: Inicio, Desafíos, Progreso, Perfil y Explorar, en claro/oscuro y anchos de 320, 390 y 768 píxeles. No se detectaron desbordamientos horizontales ni errores JavaScript. Se comprobó abrir/cerrar los detalles del contador en seis combinaciones y se inspeccionaron capturas de Inicio en ambos temas. Se usaron estados vacíos de prueba, sin sensores ni autenticación; el bloque de cuenta se excluyó del renderizado aislado de Perfil. Las dependencias y los datos de esta herramienta temporal no se incorporaron a la app ni al repositorio. Esta revisión no valida la navegación nativa, las áreas seguras o el escalado de fuentes de Android.

## Comprobación en un teléfono

1. Instalar la versión 0.3.0, código Android 3, sobre la versión de prueba anterior.
2. Abrir las cinco pestañas en modos claro y oscuro; comprobar también «Según el teléfono».
3. Verificar barra de estado y navegación inferior con gestos y con tres botones.
4. Probar tamaño de texto grande y pantalla estrecha. Revisar el aro, formularios, teclado y etiquetas de pestañas.
5. Abrir/cerrar los detalles del contador, las monedas, el mapa y los enlaces de cuenta.
6. Confirmar que objetivo, historial y saldo permanecen tras actualizar.

La validación visual nativa y las pruebas del contador con la pantalla bloqueada siguen pendientes en un dispositivo físico. El APK se firma para pruebas internas, no para distribución comercial.
