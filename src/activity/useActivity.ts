import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { ActivityRepository } from '../data/local';
import { ActivityDay, dayKey, dayWindow, Preferences, recentDays } from '../domain/activity';
import { challengesFor } from '../domain/rewards';
import { connectHealth, healthTotal } from './healthConnect';
import { recording } from './recording';

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
  const generation = useRef(0);
  const owner = repo.deviceId(() => { throw new Error('Identificador no disponible.'); });
  const inFlight = useRef(false);
  const actionBusy = useRef(false);
  const settings = useRef(preferences);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
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
  const refreshRecording = useCallback(async (includeHistory = true) => {
    if (inFlight.current || AppState.currentState !== 'active' || !settings.current.enabled || settings.current.source !== 'sensor') return;
    const token = generation.current;
    inFlight.current = true;
    try {
      const epoch = await recording.start(owner);
      if (!alive.current || token !== generation.current || AppState.currentState !== 'active') return;
      repo.beginRecording(epoch);
      const now = new Date();
      for (const day of includeHistory ? recentDays(10, now) : [dayKey(now)]) {
        const window = dayWindow(day, now);
        const start = Math.max(epoch, window.start.getTime());
        const end = window.end.getTime();
        if (end <= start || start < now.getTime() - 10 * 86400000) continue;
        const remote = repo.remote()?.days.find(item => item.date === day);
        if (remote && (remote.deviceId !== owner || remote.source !== 'sensor')) continue;
        if (repo.list().some(item => item.date === day && item.source === 'health-connect')) continue;
        const total = await recording.read(owner, epoch, start, end);
        if (!alive.current || token !== generation.current || !settings.current.enabled || settings.current.source !== 'sensor' || AppState.currentState !== 'active') return;
        if (!Number.isSafeInteger(total) || total < 0 || total > Math.min(250000, (end - start) / 1000 * 4 + 20)) throw new Error('Se descartó un total anómalo de Recording API.');
        // Ownership may change while the native read is pending.
        const latest = repo.remote()?.days.find(item => item.date === day);
        if (latest && (latest.deviceId !== owner || latest.source !== 'sensor')) continue;
        repo.recordRecording(day, total, settings.current.goal, epoch);
      }
      if (alive.current && token === generation.current) { setError(null); setStatus('Recording API activa · recupera pasos con la pantalla bloqueada'); reload(); }
    } catch (e) { if (alive.current && token === generation.current) { setError(message(e)); setStatus('El registro en segundo plano necesita atención.'); } }
    finally { inFlight.current = false; }
  }, [owner, repo, reload]);
  useEffect(() => {
    let cancelled = false;
    if (!preferences.enabled || preferences.source !== 'sensor') {
      // Stop collection on explicit pause, source change or switching to a disabled account.
      // No unsubscribe on background/unmount: that would discard the system's pending history.
      void recording.stop().catch(e => { if (!cancelled && alive.current && preferences.source === 'sensor') setError(message(e)); });
    }
    return () => { cancelled = true; };
  }, [preferences.enabled, preferences.source, owner]);
  useEffect(() => {
    if (!preferences.enabled || !active) return;
    const refresh = preferences.source === 'sensor' ? refreshRecording : refreshHealth;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(false), preferences.source === 'sensor' ? 15000 : 60000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [active, preferences.enabled, preferences.source, refreshHealth, refreshRecording]);
  const enable = async (source: Preferences['source']) => {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError(null);
    try {
      const remoteToday=repo.remote()?.days.find(day=>day.date===dayKey());
      if(remoteToday && remoteToday.deviceId!==repo.deviceId(()=>{throw new Error('Identificador no disponible.');})) throw new Error('Hoy el registro pertenece a otro dispositivo. Usa ese dispositivo para seguir contando; aquí puedes consultar tu historial.');
      if (source === 'health-connect') await connectHealth();
      else {
        if (Platform.OS !== 'android') throw new Error('Prueba el contador en un teléfono Android.');
        
        if (!(await Pedometer.requestPermissionsAsync()).granted) throw new Error('Permiso denegado. Puedes habilitarlo en los ajustes de Android.');
        if ([...repo.list(),...(repo.remote()?.days ?? [])].some(day => day.date === dayKey() && day.source === 'health-connect')) throw new Error('Hoy ya se importaron pasos de Health Connect. Puedes volver al sensor mañana.');
      }
      if (!alive.current) return;
      generation.current++;
      if (source === 'sensor') { const epoch = await recording.start(owner); if (!alive.current) return; repo.beginRecording(epoch); }
      else await recording.stop();
      if (!alive.current) return;
      save({ ...settings.current, source, enabled: true });
      if (source === 'health-connect') await refreshHealth();
      else await refreshRecording();
    } catch (e) { if (alive.current) setError(message(e)); }
    finally { actionBusy.current = false; if (alive.current) setBusy(false); }
  };
  const remoteBalance=repo.remote()?.balance;
  const today: ActivityDay | undefined = days.find(day => day.date === todayKey);
  return { preferences, days, today, todayKey, wallet, remoteBalance, cells, challenges: [...challengesFor(days, todayKey, preferences.goal), { id: 'first-sector', title: 'El primer descubrimiento', description: 'Descubre un sector durante una sesión de exploración. Recompensa única.', progress: cells.length ? 1 : 0, target: 1, reward: 10, completed: cells.length > 0, eligible: true }], status: preferences.enabled ? status : 'Contador pausado. Actívalo para comenzar; tus datos permanecen guardados.', error, busy, save, enable,
    pause: async () => {
      if (actionBusy.current) return;
      actionBusy.current = true; setBusy(true);
      try {
        if (settings.current.source === 'sensor') { await refreshRecording(); await recording.stop(); }
        if (!alive.current) return;
        generation.current++;
        save({ ...settings.current, enabled: false });
      } catch (e) { if (alive.current) setError(message(e)); }
      finally { actionBusy.current = false; if (alive.current) setBusy(false); }
    },
    refresh: preferences.source === 'sensor' ? refreshRecording : refreshHealth, reload,

  };
}
function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo leer la actividad. Inténtalo nuevamente.'; }

function displayDays(repo:ActivityRepository):ActivityDay[] {
  const days=new Map(repo.list().map(day=>[day.date,day]));
  const id=repo.deviceId(()=> {throw new Error('Identificador no inicializado.');});
  for(const day of repo.remote()?.days ?? []) { const local=days.get(day.date); if(!local || day.deviceId!==id || day.revision>=local.revision) days.set(day.date,day); }
  return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
