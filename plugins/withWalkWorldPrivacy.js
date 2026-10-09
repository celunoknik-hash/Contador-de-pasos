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
    content.text = "WalkWorld — Privacidad\\n\\nEn esta versión: pasos, objetivos, preferencias y recompensas locales se guardan únicamente en este teléfono. No se envían a servidores.\\n\\nHealth Connect: solicitamos solo permiso de lectura de pasos para mostrar el progreso diario. WalkWorld no escribe pasos ni lee otros datos de salud. Los totales provienen de las fuentes configuradas en Health Connect.\\n\\nNo usamos GPS, contactos, cámara ni micrófono. Pausar detiene las lecturas de WalkWorld. Puedes revocar los permisos desde Health Connect o los ajustes de Android.\\n\\nEl sensor alternativo cuenta únicamente mientras la app está abierta. No prometemos contar con la app cerrada.\\n\\nPara eliminar los datos locales, borra el almacenamiento de WalkWorld desde Android. Las cuentas y la sincronización en la nube todavía no están activadas.\\n\\nWalkCoins es una moneda exclusivamente virtual, sin valor monetario, venta ni conversión a dinero. El saldo local de pruebas no está validado por el servidor."
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
