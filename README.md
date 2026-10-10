# WalkWorld

**Cada paso cuenta. Camina, explora y construye tu mundo.**

Aplicación Android con Expo 57, React Native, TypeScript, SQLite y Supabase. Contador real en primer plano, importación Health Connect, WalkCoins, cinco desafíos, historial, exploración GPS voluntaria y cuentas con sincronización privada.

Estado e instrucciones actuales: [Entrega del MVP](docs/MVP.md). [Pruebas](docs/TESTING.md), [arquitectura](docs/ARCHITECTURE.md), [Supabase](docs/SUPABASE.md). Las pruebas físicas y la configuración SMTP siguen pendientes; no se promete contar con la app cerrada.

```sh
npm ci
npm run verify
npx eas-cli@latest build --platform android --profile preview
```

No hay actividad ficticia, pagos ni monedas convertibles en dinero. Android 9+; Health Connect depende del soporte del dispositivo y de una fuente que registre pasos. Expo Go no incluye esa integración nativa.
