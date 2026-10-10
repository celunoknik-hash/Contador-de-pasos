import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { ActivityRepository } from '../data/repository';
import { cellFor, consumeFix, ExplorationState, Point } from '../domain/exploration';
import { dayKey } from '../domain/activity';

export function useExploration(repo: ActivityRepository, reload: () => void) {
  const [cells, setCells] = useState(repo.cells);
  const [position, setPosition] = useState<Point | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Inicia una sesión cuando quieras explorar.');
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const state = useRef<ExplorationState>({ anchor: null });
  const stop = useCallback(() => {
    generation.current++; subscription.current?.remove(); subscription.current = null;
    state.current = { anchor: null }; starting.current=false; setPosition(null); setRunning(false); setBusy(false);
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => { if (value !== 'active') stop(); });
    return () => { stop(); listener.remove(); };
  }, [stop]);
  const start = async () => {
    if (subscription.current || starting.current) return;
    const p = repo.preferences();
    if (!p.enabled || p.source !== 'sensor') { setMessage('Activa el sensor del teléfono para vincular pasos y ubicación.'); return; }
    const token = ++generation.current; starting.current=true; setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (token !== generation.current || AppState.currentState !== 'active') return;
      if (!permission.granted) throw new Error('Ubicación denegada. Puedes concederla desde los ajustes de Android.');
      if (!await Location.hasServicesEnabledAsync()) throw new Error('Activa la ubicación del teléfono para explorar.');
      if (token !== generation.current) return;
      const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 10 }, fix => {
        if (token !== generation.current || AppState.currentState !== 'active') return;
        const prefs = repo.preferences();
        if (!prefs.enabled || prefs.source !== 'sensor') { stop(); return; }
        const day = repo.list().find(d => d.date === dayKey());
        const steps = day?.source === 'sensor' ? day.steps : 0;
        const result = consumeFix(state.current, { ...fix.coords, accuracy: fix.coords.accuracy ?? Infinity, timestamp: fix.timestamp, mocked: fix.mocked ?? false, steps }, Date.now());
        state.current = result.state; setMessage(result.message);
        if (result.state.anchor) setPosition(fix.coords);
        try {
          if (result.cell && repo.discover(result.cell.id)) { setCells(repo.cells()); reload(); setMessage('¡Descubriste un nuevo sector!'); }
        } catch { stop(); setMessage('No se pudo guardar el sector. Revisa el almacenamiento.'); }
      });
      if (token !== generation.current || AppState.currentState !== 'active') { watcher.remove(); return; }
      subscription.current = watcher; setRunning(true); setMessage('Buscando una señal GPS precisa…');
    } catch (error) { if (token === generation.current) setMessage(error instanceof Error ? error.message : 'No se pudo iniciar la exploración.'); }
    finally { if (token === generation.current) { starting.current=false; setBusy(false); } }
  };
  const localCell = position ? cellFor(position) : null;
  return { cells, position, localCell, running, busy, message, start, stop };
}
