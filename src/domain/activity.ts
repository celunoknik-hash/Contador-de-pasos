export type StepSource = 'sensor' | 'health-connect';
export type ThemePreference = 'system' | 'light' | 'dark';
export interface Preferences {
  name: string;
  avatar: 'walker' | 'forest' | 'ocean' | 'mountain';
  goal: number;
  strideMeters: number;
  weightKg: number;
  theme: ThemePreference;
  source: StepSource;
  enabled: boolean;
}
export interface ActivityDay {
  deviceId?: string;
  date: string;
  steps: number;
  goal: number;
  source: StepSource;
  partial: boolean;
  timezone: string;
  updatedAt: string;
  revision: number;
  anomalies: number;
}
export const defaults: Preferences = {
  name: 'Explorador', avatar: 'walker', goal: 5000, strideMeters: 0.7, weightKg: 70,
  theme: 'system', source: 'sensor', enabled: false,
};
export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dayWindow(key: string, now = new Date()) {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return { start, end: new Date(Math.min(end.getTime(), now.getTime())) };
}
export function recentDays(count = 7, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - count + i + 1); return dayKey(d);
  });
}
export function estimates(steps: number, stride: number, weight: number) {
  const kilometers = steps * stride / 1000;
  return { kilometers, calories: Math.round(kilometers * weight * 0.5) };
}
export function validGoal(value: number) {
  return Number.isInteger(value) && value >= 500 && value <= 50000;
}
export function validTotal(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 250000;
}
export interface SensorSession { cumulative: number | null; at: number; day: string }
export interface SensorResult { session: SensorSession; delta: number; anomaly: boolean; boundary: boolean }
// Expo emits cumulative steps since each new subscription. Never persist/replay this cumulative value.
export function consumeSensor(session: SensorSession, cumulative: number, at: number, day: string): SensorResult {
  const boundary = session.day !== day;
  const next = { cumulative, at, day };
  // Android may deliver the current boot counter immediately after subscribing.
  // Establish a fresh baseline, rather than rewarding the initial synthetic +1 from Expo.
  if (session.cumulative === null) return { session: next, delta: 0, anomaly: !validTotal(cumulative), boundary };
  const delta = cumulative - session.cumulative;
  const seconds = (at - session.at) / 1000;
  const anomaly = !Number.isSafeInteger(cumulative) || cumulative < 0 || delta < 0 || seconds < 0 || delta > Math.max(20, seconds * 5 + 10);
  // Discard ambiguous batches across midnight; do not attribute old steps to the new day.
  return { session: next, delta: anomaly || boundary ? 0 : delta, anomaly, boundary };
}

export function validDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
