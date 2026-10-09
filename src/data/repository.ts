import type { SQLiteDatabase } from 'expo-sqlite';
import { ActivityDay, defaults, Preferences, StepSource, validTotal } from '../domain/activity';

export interface ActivityRepository {
  preferences(): Preferences;
  savePreferences(value: Preferences): void;
  list(): ActivityDay[];
  recordSensor(date: string, delta: number, goal: number, anomaly: boolean): void;
  reconcileHealth(date: string, total: number, goal: number): void;
}
interface DayRow { date: string; steps: number; goal: number; source: StepSource; partial: number; timezone: string; updated_at: string; revision: number; anomalies: number }
export function createRepository(db: Pick<SQLiteDatabase, 'execSync' | 'getFirstSync' | 'getAllSync' | 'runSync' | 'withTransactionSync'>): ActivityRepository {
  db.execSync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version);
    CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity_days (
      date TEXT PRIMARY KEY, steps INTEGER NOT NULL CHECK (steps BETWEEN 0 AND 250000),
      goal INTEGER NOT NULL, source TEXT NOT NULL CHECK(source IN ('sensor','health-connect')),
      partial INTEGER NOT NULL, timezone TEXT NOT NULL, updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, anomalies INTEGER NOT NULL DEFAULT 0
    );`);
  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  const preferences = (): Preferences => {
    const row = db.getFirstSync<{value: string}>('SELECT value FROM preferences WHERE id = 1');
    return row ? { ...defaults, ...JSON.parse(row.value) as Partial<Preferences> } : { ...defaults };
  };
  return {
    preferences,
    savePreferences(value) {
      db.withTransactionSync(() => {
        db.runSync('INSERT INTO preferences(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value', JSON.stringify(value));
      });
    },
    list() {
      return db.getAllSync<DayRow>('SELECT * FROM activity_days ORDER BY date DESC').map(row => ({
        date: row.date, steps: row.steps, goal: row.goal, source: row.source, partial: !!row.partial,
        timezone: row.timezone, updatedAt: row.updated_at, revision: row.revision, anomalies: row.anomalies,
      }));
    },
    recordSensor(date, delta, goal, anomaly) {
      if (!validTotal(delta)) throw new Error('Lectura de sensor no válida.');
      if (delta === 0 && !anomaly) return;
      db.withTransactionSync(() => {
        const old = db.getFirstSync<DayRow>('SELECT * FROM activity_days WHERE date=?', date);
        // Health Connect is authoritative for an already imported day. No cross-source summation.
        if (old?.source === 'health-connect') return;
        if (!validTotal((old?.steps ?? 0) + delta)) throw new Error('Se alcanzó el límite de validación diario.');
        db.runSync(`INSERT INTO activity_days(date,steps,goal,source,partial,timezone,updated_at,anomalies)
          VALUES(?,?,?,'sensor',1,?,?,?) ON CONFLICT(date) DO UPDATE SET
          steps=activity_days.steps+excluded.steps, goal=excluded.goal, updated_at=excluded.updated_at,
          revision=activity_days.revision+1, anomalies=activity_days.anomalies+excluded.anomalies`,
          date, delta, goal, zone(), new Date().toISOString(), Number(anomaly));
      });
    },
    reconcileHealth(date, total, goal) {
      if (!validTotal(total)) throw new Error('Health Connect devolvió un total anómalo.');
      db.withTransactionSync(() => {
        const old = db.getFirstSync<DayRow>('SELECT * FROM activity_days WHERE date=?', date);
        // Same snapshot is a no-op. Repeated refreshes/restarts cannot create additional steps.
        if (old?.source === 'health-connect' && old.steps === total) return;
        db.runSync(`INSERT INTO activity_days(date,steps,goal,source,partial,timezone,updated_at)
          VALUES(?,?,?,'health-connect',0,?,?) ON CONFLICT(date) DO UPDATE SET
          steps=excluded.steps, source=excluded.source, partial=0, updated_at=excluded.updated_at,
          revision=activity_days.revision+1`, date, total, old?.goal ?? goal, zone(), new Date().toISOString());
      });
    },
  };
}
