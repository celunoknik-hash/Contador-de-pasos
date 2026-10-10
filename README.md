# WalkWorld

**Cada paso cuenta. Camina, explora y construye tu mundo.**

Aplicación Android con Expo 57, React Native, TypeScript, SQLite y Supabase. Registro real con Recording API de Android en segundo plano, importación Health Connect, WalkCoins, cinco desafíos, historial, exploración GPS voluntaria y cuentas con sincronización privada.

Estado e instrucciones actuales: [Entrega del MVP](docs/MVP.md). [Pruebas](docs/TESTING.md), [arquitectura](docs/ARCHITECTURE.md), [Supabase](docs/SUPABASE.md). La versión 0.2.0 integra Recording API; las pruebas físicas con pantalla bloqueada y la configuración SMTP siguen pendientes. Consulta [registro en segundo plano](docs/BACKGROUND.md).

```sh
npm ci
npm run verify
npx eas-cli@latest build --platform android --profile preview
```

No hay actividad ficticia, pagos ni monedas convertibles en dinero. Android 9+; Health Connect depende del soporte del dispositivo y de una fuente que registre pasos. Recording API necesita Google Play Services actualizado. Expo Go no incluye estas integraciones nativas.
