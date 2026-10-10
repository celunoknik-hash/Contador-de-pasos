import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { ActivityRepository } from '../data/local';
import { ActivityDay, consumeSensor, dayKey, Preferences, recentDays, SensorSession } from '../domain/activity';
import { challengesFor } from '../domain/rewards';
import { connectHealth, healthTotal } from './healthConnect';

export function useActivity(repo: ActivityRepository) {
  const [preferences, setPreferences] = useState(repo.preferences);
  const [days, setDays] = useState(()=>displayDays(repo));
  const [cells, setCells] = useState(repo.cells);
  const [wallet, setWallet] = useState(repo.wallet);
  const [todayKey, setTodayKey] = useState(dayKey);
  const [status, setStatus] = useState(preferences.source === 'health-connect' ? 'Consultando pasos de Health Connect…' : 'Conectando sensor del teléfono…');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const watcher = useRef<{remove(): void} | null>(null);
  const inFlight = useRef(false);
  const actionBusy = useRef(false);
  const settings = useRef(preferences);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; watcher.current?.remove(); }; }, []);
  const reload = useCallback(() => { if (alive.current) { setDays(displayDays(repo)); setWallet(repo.wallet()); const p=repo.preferences(); settings.current=p; setPreferences(p); setCells(repo.cells()); setTodayKey(dayKey()); } }, [repo]);
  const save = useCallback((next: Preferences) => {
    repo.savePreferences(next); settings.current = next; setPreferences(next);
  }, [repo]);
  const refreshHealth = useCallback(async (includeHistory = true) => {
    if (inFlight.current || AppState.currentState !== 'active' || !settings.current.enabled || settings.current.source !== 'health-connect') return;
    inFlight.current = true;
    try {
      for (const day of includeHistory ? recentDays() : [dayKey()]) {
        const total = await healthTotal(day);
        // Disabling/switching while a native read is pending must cancel future writes.
        if (!alive.current || AppState.currentState !== 'active' || !settings.current.enabled || settings.current.source !== 'health-connect') return;
        if (includeHistory) setStatus('Consultando pasos de Health Connect…');
        repo.reconcileHealth(day, total, settings.current.goal);
      }
      if (alive.current) {
        setError(null); setStatus('Total de Health Connect · puede tardar en actualizarse'); reload();
      }
    } catch (e) { if (alive.current) { setError(message(e)); setStatus('Health Connect necesita atención.'); } }
    finally { inFlight.current = false; }
  }, [repo, reload]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => { setTodayKey(dayKey()); }, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    watcher.current?.remove(); watcher.current = null;
    if (!preferences.enabled) return;
    if (!active) return;
    if (preferences.source === 'health-connect') {
      // Defer the native read until after the first committed frame; cancel pending work on exit.
      const firstRead = setTimeout(() => { if (!cancelled) void refreshHealth(); }, 0);
      const timer = setInterval(() => void refreshHealth(false), 60000);
      return () => { cancelled = true; clearTimeout(firstRead); clearInterval(timer); };
    }
    const begin = async () => {
      try {
        if (Platform.OS !== 'android') throw new Error('El contador de esta versión está preparado para Android.');
        if (!await Pedometer.isAvailableAsync()) throw new Error('El teléfono no tiene un sensor de pasos disponible. Prueba Health Connect.');
        if (!(await Pedometer.getPermissionsAsync()).granted) throw new Error('Permiso de actividad no concedido. Actívalo desde Perfil.');
        if (cancelled) return;
        if (repo.remote()?.days.some(day => day.date===dayKey() && day.deviceId!==repo.deviceId(()=>{throw new Error('Identificador no disponible.');}))) throw new Error('Hoy el registro pertenece a otro dispositivo. Consulta el progreso aquí y usa ese dispositivo para seguir contando.');
        if (repo.list().some(day => day.date === dayKey() && day.source === 'health-connect')) {
          throw new Error('Hoy ya usaste Health Connect. Para evitar mezclar fuentes, reconéctalo o usa el sensor desde mañana.');
        }
        let session: SensorSession = { cumulative: null, at: Date.now(), day: dayKey() };
        watcher.current = Pedometer.watchStepCount(reading => {
          if (cancelled || AppState.currentState !== 'active') return;
          const result = consumeSensor(session, reading.steps, Date.now(), dayKey());
          session = result.session;
          try {
            repo.recordSensor(session.day, result.delta, settings.current.goal, result.anomaly);
            reload();
            if (result.anomaly) setError('Se descartó una lectura anómala del sensor.');
            else if (result.boundary) setStatus('Nuevo día · el primer lote de medianoche se descartó para evitar duplicados.');
          } catch (e) { setError(message(e)); watcher.current?.remove(); watcher.current = null; }
        });
        setError(null); setStatus('Sensor activo · cuenta mientras WalkWorld está abierta');
      } catch (e) { if (!cancelled) { setError(message(e)); setStatus('El contador necesita atención.'); } }
    };
    void begin();
    return () => { cancelled = true; watcher.current?.remove(); watcher.current = null; };
  }, [active, preferences.enabled, preferences.source, refreshHealth, repo, reload]);
  const enable = async (source: Preferences['source']) => {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError(null);
    try {
      if (source === 'health-connect') await connectHealth();
      else {
        if (Platform.OS !== 'android') throw new Error('Prueba el contador en un teléfono Android.');
        if (!await Pedometer.isAvailableAsync()) throw new Error('Sensor no disponible en este dispositivo.');
        if (!(await Pedometer.requestPermissionsAsync()).granted) throw new Error('Permiso denegado. Puedes habilitarlo en los ajustes de Android.');
        if (repo.list().some(day => day.date === dayKey() && day.source === 'health-connect')) throw new Error('Hoy ya se importaron pasos de Health Connect. Puedes volver al sensor mañana.');
      }
      save({ ...settings.current, source, enabled: true });
      if (source === 'health-connect') await refreshHealth();
    } catch (e) { setError(message(e)); }
    finally { actionBusy.current = false; setBusy(false); }
  };
  const remoteBalance=repo.remote()?.balance;
  const today: ActivityDay | undefined = days.find(day => day.date === todayKey);
  return { preferences, days, today, todayKey, wallet, remoteBalance, cells, challenges: [...challengesFor(days, todayKey, preferences.goal), { id: 'first-sector', title: 'El primer descubrimiento', description: 'Descubre un sector durante una sesión de exploración. Recompensa única.', progress: cells.length ? 1 : 0, target: 1, reward: 10, completed: cells.length > 0, eligible: true }], status: preferences.enabled ? status : 'Contador pausado. Actívalo para comenzar; tus datos permanecen guardados.', error, busy, save, enable,
    pause: () => {
      watcher.current?.remove(); watcher.current = null;
      try { save({ ...settings.current, enabled: false }); }
      catch { setError('No se pudo guardar la pausa. Revisa el espacio disponible.'); }
    },
    refresh: refreshHealth, reload,
  };
}
function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo leer la actividad. Inténtalo nuevamente.'; }

function displayDays(repo:ActivityRepository):ActivityDay[] {
  const days=new Map(repo.list().map(day=>[day.date,day]));
  const id=repo.deviceId(()=> {throw new Error('Identificador no inicializado.');});
  for(const day of repo.remote()?.days ?? []) { const local=days.get(day.date); if(!local || day.deviceId!==id || day.revision>=local.revision) days.set(day.date,day); }
  return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
