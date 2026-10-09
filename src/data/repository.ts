import type { SQLiteDatabase } from 'expo-sqlite';
import { ActivityDay, defaults, Preferences, StepSource, validTotal, validGoal, dayKey, validDayKey } from '../domain/activity';

import { rewardTargets, Wallet } from '../domain/rewards';

export interface ActivityRepository {
  preferences(): Preferences;
  savePreferences(value: Preferences): void;
  list(): ActivityDay[];
  wallet(): Wallet;
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
    );
    CREATE TABLE IF NOT EXISTS reward_state (
      reward_key TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK(amount >= 0), version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_coin_ledger (
      id INTEGER PRIMARY KEY, reward_key TEXT NOT NULL, version INTEGER NOT NULL,
      delta INTEGER NOT NULL CHECK(delta <> 0), label TEXT NOT NULL, date TEXT, created_at TEXT NOT NULL,
      UNIQUE(reward_key, version)
    );`);
  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  const preferences = (): Preferences => {
    const row = db.getFirstSync<{value: string}>('SELECT value FROM preferences WHERE id = 1');
    return row ? { ...defaults, ...JSON.parse(row.value) as Partial<Preferences> } : { ...defaults };
  };
  const mapDay = (row: DayRow): ActivityDay => ({
    date: row.date, steps: row.steps, goal: row.goal, source: row.source, partial: !!row.partial,
    timezone: row.timezone, updatedAt: row.updated_at, revision: row.revision, anomalies: row.anomalies,
  });
  const list = (date?: string): ActivityDay[] => {
    return (date ? db.getAllSync<DayRow>('SELECT * FROM activity_days WHERE date=?', date) : db.getAllSync<DayRow>('SELECT * FROM activity_days ORDER BY date DESC')).map(mapDay);
  };
  // Call only inside the same transaction as the activity change.
  const reconcileRewards = (date?: string, includeStreak = true) => {
    const targets = rewardTargets(list(date), dayKey(), !date);
    if (date && includeStreak) {
      const qualified = db.getAllSync<DayRow>("SELECT * FROM activity_days WHERE source='sensor' AND steps>=goal")
        .map(mapDay);
      const streak = rewardTargets(qualified, dayKey()).find(target => target.key === 'three-days:v1');
      if (streak) targets.push(streak);
    }
    for (const target of targets) {
      const old = db.getFirstSync<{amount:number;version:number}>('SELECT amount,version FROM reward_state WHERE reward_key=?', target.key);
      const delta = target.amount - (old?.amount ?? 0);
      if (delta === 0) continue;
      const version = (old?.version ?? 0) + 1;
      db.runSync('INSERT INTO local_coin_ledger(reward_key,version,delta,label,date,created_at) VALUES(?,?,?,?,?,?)', target.key, version, delta, target.label, target.date, new Date().toISOString());
      db.runSync('INSERT INTO reward_state(reward_key,amount,version) VALUES(?,?,?) ON CONFLICT(reward_key) DO UPDATE SET amount=excluded.amount,version=excluded.version', target.key, target.amount, version);
    }
  };
  db.withTransactionSync(() => {
    const version = db.getFirstSync<{version:number}>('SELECT version FROM schema_version')?.version ?? 1;
    if (version > 2) throw new Error('Actualiza WalkWorld para abrir estos datos.');
    // Upgrade existing real records once; reopening produces no duplicate entitlement.
    reconcileRewards();
    db.runSync('UPDATE schema_version SET version=2');
  });
  return {
    preferences,
    savePreferences(value) {
      db.withTransactionSync(() => {
        db.runSync('INSERT INTO preferences(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value', JSON.stringify(value));
      });
    },
    list,
    wallet() {
      return {
        balance: db.getFirstSync<{balance: number}>('SELECT COALESCE(SUM(amount),0) AS balance FROM reward_state')?.balance ?? 0,
        movements: db.getAllSync<{id:number;reward_key:string;delta:number;label:string;date:string|null;created_at:string}>('SELECT * FROM local_coin_ledger ORDER BY id DESC LIMIT 50')
          .map(row => ({ id: row.id, key: row.reward_key, delta: row.delta, label: row.label, date: row.date, createdAt: row.created_at })),
      };
    },
    recordSensor(date, delta, goal, anomaly) {
      if (!validDayKey(date)) throw new Error('Fecha de actividad no válida.');
      if (!validGoal(goal)) throw new Error('Objetivo diario no válido.');
      if (anomaly && delta !== 0) throw new Error('Una lectura anómala no puede generar pasos.');
      if (!validTotal(delta)) throw new Error('Lectura de sensor no válida.');
      if (delta === 0 && !anomaly) return;
      db.withTransactionSync(() => {
        const old = db.getFirstSync<DayRow>('SELECT * FROM activity_days WHERE date=?', date);
        // Health Connect is authoritative for an already imported day. No cross-source summation.
        if (old?.source === 'health-connect') return;
        if (!validTotal((old?.steps ?? 0) + delta)) throw new Error('Se alcanzó el límite de validación diario.');
        db.runSync(`INSERT INTO activity_days(date,steps,goal,source,partial,timezone,updated_at,anomalies)
          VALUES(?,?,?,'sensor',1,?,?,?) ON CONFLICT(date) DO UPDATE SET
          steps=activity_days.steps+excluded.steps, updated_at=excluded.updated_at,
          revision=activity_days.revision+1, anomalies=activity_days.anomalies+excluded.anomalies`,
          date, delta, goal, zone(), new Date().toISOString(), Number(anomaly));
        reconcileRewards(date, (old?.steps ?? 0) < (old?.goal ?? goal) && (old?.steps ?? 0) + delta >= (old?.goal ?? goal));
      });
    },
    reconcileHealth(date, total, goal) {
      if (!validDayKey(date)) throw new Error('Fecha de actividad no válida.');
      if (!validGoal(goal)) throw new Error('Objetivo diario no válido.');
      if (!validTotal(total)) throw new Error('Health Connect devolvió un total anómalo.');
      db.withTransactionSync(() => {
        const old = db.getFirstSync<DayRow>('SELECT * FROM activity_days WHERE date=?', date);
        // Same snapshot is a no-op. Repeated refreshes/restarts cannot create additional steps.
        if (old?.source === 'health-connect' && old.steps === total) return;
        db.runSync(`INSERT INTO activity_days(date,steps,goal,source,partial,timezone,updated_at)
          VALUES(?,?,?,'health-connect',0,?,?) ON CONFLICT(date) DO UPDATE SET
          steps=excluded.steps, source=excluded.source, partial=0, updated_at=excluded.updated_at,
          revision=activity_days.revision+1`, date, total, old?.goal ?? goal, zone(), new Date().toISOString());
        reconcileRewards(date, old?.source === 'sensor' && old.steps >= old.goal);
      });
    },
  };
}
