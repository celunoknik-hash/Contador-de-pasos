package expo.modules.walkworldrecording

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.fitness.FitnessLocal
import com.google.android.gms.fitness.LocalRecordingClient
import com.google.android.gms.fitness.data.LocalDataType
import com.google.android.gms.fitness.data.LocalField
import com.google.android.gms.fitness.request.LocalDataReadRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

/** Accountless, on-device Google Play services recording. No JS background timer or GPS. */
class WalkWorldRecordingModule : Module() {
  private fun context(): Context = requireNotNull(appContext.reactContext).applicationContext
  private fun storage() = context().getSharedPreferences("walkworld-recording-v1", Context.MODE_PRIVATE)
  private fun client() = FitnessLocal.getLocalRecordingClient(context())

  private fun check() {
    val ctx = context()
    check(GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx,
      LocalRecordingClient.LOCAL_RECORDING_CLIENT_MIN_VERSION_CODE) == ConnectionResult.SUCCESS) {
      "Actualiza Google Play Services para contar pasos en segundo plano, o usa Health Connect."
    }
    val manager = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    check(manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null) {
      "Este teléfono no tiene sensor de pasos. Puedes usar Health Connect con una fuente compatible."
    }
    check(Build.VERSION.SDK_INT < 29 || ctx.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED) {
      "Permiso de actividad física no concedido. Actívalo desde Perfil."
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WalkWorldRecording")
    AsyncFunction("start") { owner: String, promise: Promise ->
      try {
        check()
        client().subscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
          .addOnSuccessListener {
            val prefs = storage()
            // A new account or a pause starts a fresh interval. Never import another account's steps.
            val start = if (prefs.getString("owner", null) == owner) prefs.getLong("start", 0L) else 0L
            val epoch = if (start > 0L) start else System.currentTimeMillis()
            if (!prefs.edit().putString("owner", owner).putLong("start", epoch).commit()) {
              promise.reject("RECORDING_STORAGE", "No se pudo guardar el inicio del contador.", null)
            } else promise.resolve(epoch.toDouble())
          }
          .addOnFailureListener { promise.reject("RECORDING_START", "No se pudo activar Recording API. Actualiza Google Play Services o usa Health Connect.", it) }
      } catch (e: Exception) { promise.reject("RECORDING_UNAVAILABLE", e.message, e) }
    }
    AsyncFunction("readSteps") { owner: String, epoch: Double, start: Double, end: Double, promise: Promise ->
      try {
        check()
        val prefs = storage()
        check(prefs.getString("owner", null) == owner && prefs.getLong("start", 0L) == epoch.toLong()) {
          "La sesión del contador cambió. Vuelve a actualizar los pasos."
        }
        require(start.isFinite() && end.isFinite() && start >= epoch && end > start && end - start <= TimeUnit.DAYS.toMillis(2))
        val request = LocalDataReadRequest.Builder()
          .aggregate(LocalDataType.TYPE_STEP_COUNT_DELTA)
          .bucketByTime(1, TimeUnit.DAYS)
          .setTimeRange(start.toLong(), end.toLong(), TimeUnit.MILLISECONDS).build()
        client().readData(request)
          .addOnSuccessListener { response ->
            val total = response.buckets.flatMap { it.dataSets }.flatMap { it.dataPoints }
              .sumOf { it.getValue(LocalField.FIELD_STEPS).asInt().toLong() }
            if (total !in 0L..250000L) promise.reject("RECORDING_ANOMALY", "Recording API devolvió un total anómalo.", null)
            else promise.resolve(total.toDouble())
          }
          .addOnFailureListener { promise.reject("RECORDING_READ", "No se pudieron recuperar los pasos. Revisa permisos y Google Play Services.", it) }
      } catch (e: Exception) { promise.reject("RECORDING_READ", e.message, e) }
    }
    AsyncFunction("stop") { promise: Promise ->
      try {
        if (storage().getString("owner", null) == null ||
          (Build.VERSION.SDK_INT >= 29 && context().checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED)) {
          if (storage().edit().clear().commit()) promise.resolve()
          else promise.reject("RECORDING_STORAGE", "No se pudo guardar la pausa.", null)
          return@AsyncFunction
        }
        client().unsubscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
          .addOnSuccessListener {
            if (storage().edit().clear().commit()) promise.resolve()
            else promise.reject("RECORDING_STORAGE", "No se pudo guardar la pausa.", null)
          }
          .addOnFailureListener { promise.reject("RECORDING_STOP", "No se pudo detener el registro. Puedes revocar el permiso de actividad en Android.", it) }
      } catch (e: Exception) { promise.reject("RECORDING_STOP", e.message, e) }
    }
  }
}
