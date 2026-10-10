import type { SQLiteDatabase } from 'expo-sqlite';
import { ActivityDay, defaults, Preferences, StepSource, validTotal, validGoal, dayKey, validDayKey } from '../domain/activity';

import { parseCell } from '../domain/exploration';
import { rewardTargets, Wallet } from '../domain/rewards';

export interface ActivityRepository {
  preferences(): Preferences;
  deviceId(make: () => string): string;
  restorePreferences(value: Partial<Preferences>): void;
  savePreferences(value: Preferences): void;
  list(): ActivityDay[];
  wallet(): Wallet;
  cells(): string[];
  pending(): { days: ActivityDay[]; cells: string[]; preferences: Preferences; preferenceRevision: number; editPreferences: boolean };
  acknowledge(days: {date:string;revision:number}[], cells: string[], preferenceRevision: number): void;
  remote(): { days: ActivityDay[]; balance: number; cells: string[] } | null;
  saveRemote(value: { days: ActivityDay[]; balance: number; cells: string[] }): void;
  exportGuest(): { days: ActivityDay[]; cells: string[]; preferences: Preferences };
  importGuest(value: { days: ActivityDay[]; cells: string[]; preferences: Preferences }): void;
  discover(id: string): boolean;
  recordSensor(date: string, delta: number, goal: number, anomaly: boolean): void;
  recordingEpoch(): number | null;
  beginRecording(epoch: number): void;
  recordRecording(date: string, total: number, goal: number, epoch: number): void;
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
    CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_days (date TEXT PRIMARY KEY, revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_cells (cell_id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS explored_cells (cell_id TEXT PRIMARY KEY, discovered_at TEXT NOT NULL);
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
    if (version > 4) throw new Error('Actualiza WalkWorld para abrir estos datos.');
    if (version < 4) {
      db.runSync('INSERT OR REPLACE INTO sync_days(date,revision) SELECT date,revision FROM activity_days');
      db.runSync('INSERT OR IGNORE INTO sync_cells(cell_id) SELECT cell_id FROM explored_cells');
    }
    // Upgrade existing real records once; reopening produces no duplicate entitlement.
    reconcileRewards();
    db.runSync('UPDATE schema_version SET version=4');
  });
  const writeSensor = (date: string, delta: number, goal: number, anomaly: boolean) => {
      if (!validDayKey(date)) throw new Error('Fecha de actividad no válida.');
      if (!validGoal(goal)) throw new Error('Objetivo diario no válido.');
      if (anomaly && delta !== 0) throw new Error('Una lectura anómala no puede generar pasos.');
      if (!validTotal(delta)) throw new Error('Lectura de sensor no válida.');
      if (delta === 0 && !anomaly) return;

        const old = db.getFirstSync<DayRow>('SELECT * FROM activity_days WHERE date=?', date);
        // Health Connect is authoritative for an already imported day. No cross-source summation.
        if (old?.source === 'health-connect') return;
        if (!validTotal((old?.steps ?? 0) + delta)) throw new Error('Se alcanzó el límite de validación diario.');
        db.runSync(`INSERT INTO activity_days(date,steps,goal,source,partial,timezone,updated_at,anomalies)
          VALUES(?,?,?,'sensor',1,?,?,?) ON CONFLICT(date) DO UPDATE SET
          steps=activity_days.steps+excluded.steps, updated_at=excluded.updated_at,
          revision=activity_days.revision+1, anomalies=activity_days.anomalies+excluded.anomalies`,
          date, delta, goal, zone(), new Date().toISOString(), Number(anomaly));
        db.runSync('INSERT INTO sync_days(date,revision) SELECT date,revision FROM activity_days WHERE date=? ON CONFLICT(date) DO UPDATE SET revision=excluded.revision', date);
        reconcileRewards(date, (old?.steps ?? 0) < (old?.goal ?? goal) && (old?.steps ?? 0) + delta >= (old?.goal ?? goal));

  };
  return {
    preferences,
    deviceId(make) { const old=db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='device'"); if(old) return old.value; const id=make(); db.runSync("INSERT INTO sync_meta(key,value) VALUES('device',?)",id); return id; },
    restorePreferences(value) { db.runSync('INSERT INTO preferences(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',JSON.stringify({...preferences(),...value})); },
    savePreferences(value) {
      const previousPreferences = preferences();
      db.withTransactionSync(() => {
        db.runSync('INSERT INTO preferences(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value', JSON.stringify(value));
        if (['name','avatar','goal','strideMeters','weightKg','theme'].some(key => previousPreferences[key as keyof Preferences] !== value[key as keyof Preferences])) db.runSync("INSERT INTO sync_meta(key,value) VALUES('preferences-revision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(sync_meta.value AS INTEGER)+1 AS TEXT)");
      });
    },
    list,
    pending() {
      const dirty = new Set(db.getAllSync<{date:string}>('SELECT date FROM sync_days').map(row => row.date));
      return { days: list().filter(day => dirty.has(day.date)), cells: db.getAllSync<{cell_id:string}>('SELECT cell_id FROM sync_cells').map(row => row.cell_id), preferences: preferences(), editPreferences: Number(db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='preferences-revision'")?.value ?? 0)>Number(db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='preferences-ack'")?.value ?? 0), preferenceRevision: Number(db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='preferences-revision'")?.value ?? 0) };
    },
    acknowledge(days, cells, preferenceRevision) {
      db.withTransactionSync(() => {
        for (const d of days) db.runSync('DELETE FROM sync_days WHERE date=? AND revision=?', d.date, d.revision);
        for (const cell of cells) db.runSync('DELETE FROM sync_cells WHERE cell_id=?', cell);
        db.runSync("INSERT INTO sync_meta(key,value) VALUES('preferences-ack',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(preferenceRevision));
      });
    },
    remote() { const row = db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='remote'"); return row ? JSON.parse(row.value) : null; },
    saveRemote(value) { db.withTransactionSync(() => { db.runSync("INSERT INTO sync_meta(key,value) VALUES('remote',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(value)); }); },
    exportGuest() { return { days: list(), cells: db.getAllSync<{cell_id:string}>('SELECT cell_id FROM explored_cells').map(row => row.cell_id), preferences: preferences() }; },
    importGuest(value) {
      db.withTransactionSync(() => {
        for (const day of value.days) {
          if (db.getFirstSync('SELECT 1 FROM activity_days WHERE date=?', day.date)) continue;
          db.runSync('INSERT INTO activity_days(date,steps,goal,source,partial,timezone,updated_at,revision,anomalies) VALUES(?,?,?,?,?,?,?,?,?)', day.date,day.steps,day.goal,day.source,Number(day.partial),day.timezone,day.updatedAt,day.revision,day.anomalies);
          db.runSync('INSERT INTO sync_days(date,revision) VALUES(?,?) ON CONFLICT(date) DO UPDATE SET revision=excluded.revision',day.date,day.revision);
        }
        // Preserve only discovered sectors, never copy GPS fixes/routes.
        for (const cell of value.cells) { parseCell(cell); db.runSync('INSERT OR IGNORE INTO explored_cells(cell_id,discovered_at) VALUES(?,?)',cell,new Date().toISOString()); db.runSync('INSERT OR IGNORE INTO sync_cells(cell_id) VALUES(?)',cell); }
        if(value.cells.length && !db.getFirstSync('SELECT 1 FROM reward_state WHERE reward_key=?','explore-first:v1')) {
          db.runSync('INSERT INTO local_coin_ledger(reward_key,version,delta,label,date,created_at) VALUES(?,1,10,?,?,?)','explore-first:v1','Primer sector',null,new Date().toISOString());
          db.runSync('INSERT INTO reward_state(reward_key,amount,version) VALUES(?,10,1)','explore-first:v1');
        }
        reconcileRewards();
      });
    },
    cells() { const local = db.getAllSync<{cell_id:string}>('SELECT cell_id FROM explored_cells ORDER BY discovered_at DESC').map(row => row.cell_id); const row = db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='remote'"); return [...new Set([...local, ...(row ? JSON.parse(row.value).cells as string[] : [])])]; },
    discover(id) {
      parseCell(id);
      let added = false;
      db.withTransactionSync(() => {
        const exists = db.getFirstSync('SELECT 1 FROM explored_cells WHERE cell_id=?', id);
        if (exists) return;
        db.runSync('INSERT INTO explored_cells(cell_id,discovered_at) VALUES(?,?)', id, new Date().toISOString());
        db.runSync('INSERT INTO sync_cells(cell_id) VALUES(?)', id);
        added = true;
        const key = 'explore-first:v1';
        if (db.getFirstSync('SELECT 1 FROM reward_state WHERE reward_key=?', key)) return;
        db.runSync('INSERT INTO local_coin_ledger(reward_key,version,delta,label,date,created_at) VALUES(?,1,10,?,?,?)', key, 'Primer sector', null, new Date().toISOString());
        db.runSync('INSERT INTO reward_state(reward_key,amount,version) VALUES(?,10,1) ON CONFLICT(reward_key) DO NOTHING', key);
      });
      return added;
    },
    wallet() {
      return {
        balance: db.getFirstSync<{balance: number}>('SELECT COALESCE(SUM(amount),0) AS balance FROM reward_state')?.balance ?? 0,
        movements: db.getAllSync<{id:number;reward_key:string;delta:number;label:string;date:string|null;created_at:string}>('SELECT * FROM local_coin_ledger ORDER BY id DESC LIMIT 50')
          .map(row => ({ id: row.id, key: row.reward_key, delta: row.delta, label: row.label, date: row.date, createdAt: row.created_at })),
      };
    },
    recordingEpoch() { const value = db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='recording-epoch'")?.value; return value ? Number(value) : null; },
    beginRecording(epoch) {
      if (!Number.isSafeInteger(epoch) || epoch <= 0) throw new Error('Inicio del contador no válido.');
      db.withTransactionSync(() => {
        const old = db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='recording-epoch'")?.value;
        if (old === String(epoch)) return;
        db.runSync("DELETE FROM sync_meta WHERE key LIKE 'recording-total:%'");
        db.runSync("INSERT INTO sync_meta(key,value) VALUES('recording-epoch',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(epoch));
      });
    },
    recordRecording(date, total, goal, epoch) {
      if (!validDayKey(date) || !validTotal(total) || !validGoal(goal)) throw new Error('Lectura de Recording API no válida.');
      db.withTransactionSync(() => {
        if (db.getFirstSync<{value:string}>("SELECT value FROM sync_meta WHERE key='recording-epoch'")?.value !== String(epoch)) return;
        const key = `recording-total:${date}`;
        const previous = Number(db.getFirstSync<{value:string}>('SELECT value FROM sync_meta WHERE key=?', key)?.value ?? 0);
        // Fixed query interval + persisted high-water mark: refresh/restart never replays steps.
        // Temporary smaller totals (latency/retention) neither subtract nor recredit activity.
        if (total <= previous) return;
        writeSensor(date, total - previous, goal, false);
        db.runSync('INSERT INTO sync_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(total));
      });
    },
    recordSensor(date, delta, goal, anomaly) { db.withTransactionSync(() => writeSensor(date, delta, goal, anomaly)); },
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
        db.runSync('INSERT INTO sync_days(date,revision) SELECT date,revision FROM activity_days WHERE date=? ON CONFLICT(date) DO UPDATE SET revision=excluded.revision', date);
        reconcileRewards(date, old?.source === 'sensor' && old.steps >= old.goal);
      });
    },
  };
}
