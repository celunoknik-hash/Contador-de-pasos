export const GRID_VERSION = 1;
const R = 6378137;
const SIDE = 120; // Projected metres: smaller on the ground away from the equator.
export interface Point { latitude: number; longitude: number }
export interface Fix extends Point { accuracy: number; timestamp: number; mocked: boolean; steps: number }
export interface Cell { id: string; x: number; y: number }
export interface ExplorationState { anchor: Fix | null }
export function validPoint(p: Point) { return Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 85 && Math.abs(p.longitude) <= 180; }
export function cellFor(p: Point): Cell {
  if (!validPoint(p)) throw new Error('Coordenadas no válidas.');
  const x = Math.floor(R * p.longitude * Math.PI / 180 / SIDE);
  const y = Math.floor(R * Math.log(Math.tan(Math.PI / 4 + p.latitude * Math.PI / 360)) / SIDE);
  return { id: `${x}:${y}`, x, y };
}
export function centerFor(cell: Cell): Point {
  return { longitude: (cell.x + 0.5) * SIDE / R * 180 / Math.PI, latitude: (2 * Math.atan(Math.exp((cell.y + 0.5) * SIDE / R)) - Math.PI / 2) * 180 / Math.PI };
}
export function parseCell(id: string): Cell {
  if (!/^-?\d+:-?\d+$/.test(id)) throw new Error('Sector no válido.');
  const [x,y] = id.split(':').map(Number);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || Math.abs(x) > 166980 || Math.abs(y) > 166600 || id!==`${x}:${y}`) throw new Error('Sector fuera del mapa.');
  return { id, x, y };
}
export function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const value = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}
export function consumeFix(state: ExplorationState, fix: Fix, now: number): { state: ExplorationState; cell: Cell | null; message: string } {
  if (!Number.isFinite(now) || !Number.isFinite(fix.timestamp) || !validPoint(fix) || fix.mocked || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 25 || Math.abs(now - fix.timestamp) > 20000 || !Number.isSafeInteger(fix.steps) || fix.steps < 0) {
    return { state: { anchor: null }, cell: null, message: 'Esperando una ubicación precisa y no simulada.' };
  }
  if (!state.anchor) return { state: { anchor: fix }, cell: null, message: 'Ubicación lista. Camina para descubrir sectores.' };
  const a = state.anchor;
  const seconds = (fix.timestamp - a.timestamp) / 1000;
  const metres = distance(a, fix);
  const steps = fix.steps - a.steps;
  if (seconds <= 0) return { state, cell: null, message: 'Esperando una lectura nueva.' };
  if (seconds > 90 || steps < 0 || metres > 150 || metres / seconds > 3 || steps / seconds > 4) return { state: { anchor: fix }, cell: null, message: 'Desplazamiento descartado. Retoma la caminata.' };
  if (metres < Math.max(15, a.accuracy + fix.accuracy) || steps < 12) return { state, cell: null, message: 'Camina un poco más; no desbloqueamos sectores por deriva del GPS.' };
  if (metres > steps * 1.5) return { state: { anchor: fix }, cell: null, message: 'Los pasos no coinciden con el desplazamiento.' };
  return { state: { anchor: fix }, cell: cellFor(fix), message: 'Caminata verificada con controles locales.' };
}
