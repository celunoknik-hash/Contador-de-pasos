const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
// A real, offline rationale page accessible from the Health Connect permission dialog.
module.exports = function withWalkWorldPrivacy(config) {
  config = withAndroidManifest(config, config => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    const action = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
    main['intent-filter'] = (main['intent-filter'] || []).filter(filter => !(filter.action || []).some(a => a.$['android:name'] === action));
    app.activity ||= [];
    if (!app.activity.some(a => a.$['android:name'] === '.WalkWorldPrivacyActivity')) app.activity.push({
      $: { 'android:name': '.WalkWorldPrivacyActivity', 'android:exported': 'true' },
      'intent-filter': [{ action: [{ $: { 'android:name': action } }] }],
    });
    for (const alias of app['activity-alias'] || []) {
      if (alias.$['android:name'] === 'ViewPermissionUsageActivity') alias.$['android:targetActivity'] = '.WalkWorldPrivacyActivity';
    }
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const packageName = config.android.package;
    const folder = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'WalkWorldPrivacyActivity.kt'), `package ${packageName}
import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView
import android.view.WindowInsets

class WalkWorldPrivacyActivity : Activity() {
  @Suppress("DEPRECATION")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val scroll = ScrollView(this)
    val content = TextView(this)
    content.textSize = 18f
    content.setPadding(32, 32, 32, 32)
    content.text = "WalkWorld — Privacidad\\n\\nEl modo invitado guarda datos en este teléfono. En cuentas se sincronizan perfil, pasos diarios, recompensas y sectores privados con Supabase. El historial de invitado no se importa sin elegirlo.\\n\\nHealth Connect: solicitamos solo permiso de lectura de pasos para mostrar el progreso diario. WalkWorld no escribe pasos ni lee otros datos de salud. Los totales provienen de las fuentes configuradas en Health Connect.\\n\\nEl GPS se usa solo en sesiones voluntarias de Explorar, mientras esa pantalla está abierta. Se detiene al salir o pasar a segundo plano. Se guardan sectores, no recorridos ni coordenadas exactas. Los sectores revelan zonas visitadas. No usamos contactos, cámara ni micrófono. Pausar detiene las lecturas de WalkWorld. Puedes revocar los permisos desde Health Connect o los ajustes de Android.\\n\\nRecording API: con permiso de actividad, Google Play Services registra pasos localmente en segundo plano, también con la pantalla bloqueada. No requiere GPS ni iniciar sesión con Google. WalkWorld recupera esos pasos al abrirse y guarda el historial y las recompensas sin repetir lecturas. Pausar detiene esta suscripción. Google Play Services conserva hasta 10 días; abre WalkWorld al menos cada 9 días para guardarlos. La compatibilidad y el comportamiento deben verificarse en cada teléfono.\\n\\nPara eliminar los datos locales, borra el almacenamiento de WalkWorld desde Android. Para eliminar tu cuenta y sus datos en Supabase usa Perfil; requiere internet. Las copias en otros teléfonos pueden permanecer sin conexión hasta borrar su almacenamiento.\\n\\nWalkCoins es una moneda exclusivamente virtual, sin valor monetario, venta ni conversión a dinero. Sin conexión las monedas locales están pendientes de sincronización. El servidor valida límites y evita duplicados; sus controles no garantizan impedir todo fraude."
    scroll.addView(content)
    scroll.setOnApplyWindowInsetsListener { view, insets ->
      val system = if (android.os.Build.VERSION.SDK_INT >= 30) insets.getInsets(WindowInsets.Type.systemBars()) else null
      if (system != null) view.setPadding(system.left, system.top, system.right, system.bottom)
      else view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
      insets
    }
    setContentView(scroll)
  }
}
`);
    return config;
  }]);
};
