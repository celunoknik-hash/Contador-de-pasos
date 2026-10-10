import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createRepository } from '../src/data/repository';
import { defaults } from '../src/domain/activity';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  // Run production SQL against actual SQLite, rather than mocking persistence behavior.
  const db = {
    execSync: (sql: string) => sqlite.exec(sql),
    getFirstSync: (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).get(...params) ?? null,
    getAllSync: (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).all(...params),
    runSync: (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).run(...params),
    withTransactionSync: (body: () => void) => { sqlite.exec('BEGIN'); try { body(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  } as unknown as SQLiteDatabase;
  return { sqlite, db };
}
test('sensor totals and preferences survive reopening the repository', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  repo.savePreferences({ ...defaults, goal: 3000, name: 'Nicolás' });
  repo.recordSensor('2026-10-09', 100, 3000, false);
  repo.recordSensor('2026-10-09', 50, 3000, false);
  const reopened = createRepository(db);
  assert.equal(reopened.list()[0].steps, 150); assert.equal(reopened.list()[0].partial, true);
  assert.equal(reopened.preferences().goal, 3000); sqlite.close();
});
test('Health Connect snapshots replace the sensor, remain idempotent and accept corrections', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  repo.recordSensor('2026-10-09', 100, 5000, false);
  repo.reconcileHealth('2026-10-09', 4000, 5000);
  const revision = repo.list()[0].revision;
  repo.reconcileHealth('2026-10-09', 4000, 5000);
  assert.equal(repo.list().length, 1); assert.equal(repo.list()[0].steps, 4000);
  assert.equal(repo.list()[0].revision, revision);
  repo.recordSensor('2026-10-09', 50, 5000, false);
  assert.equal(repo.list()[0].steps, 4000);
  repo.reconcileHealth('2026-10-09', 3900, 5000);
  assert.equal(repo.list()[0].steps, 3900); sqlite.close();
});
test('invalid data cannot overwrite a valid day and anomalies never generate steps', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  repo.recordSensor('2026-10-09', 100, 5000, false);
  assert.throws(() => repo.reconcileHealth('2026-10-09', 300000, 5000));
  assert.throws(() => repo.recordSensor('2026-10-09', -1, 5000, false));
  repo.recordSensor('2026-10-09', 0, 5000, true);
  assert.equal(repo.list()[0].steps, 100); assert.equal(repo.list()[0].anomalies, 1); sqlite.close();
});

test('coins use complete hundreds, survive restart, and reset daily without replay', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  repo.recordSensor('2026-09-01', 99, 5000, false);
  assert.equal(repo.wallet().balance, 0);
  repo.recordSensor('2026-09-01', 1, 5000, false);
  assert.equal(repo.wallet().balance, 1);
  const reopened = createRepository(db);
  assert.equal(reopened.wallet().balance, 1);
  assert.equal(reopened.wallet().movements.length, 1);
  reopened.recordSensor('2026-09-01', 0, 5000, false);
  reopened.recordSensor('2026-09-02', 100, 5000, false);
  assert.equal(reopened.wallet().balance, 2);
  sqlite.close();
});
test('daily cap applies to base coins; challenge bonuses award once and goals remain frozen', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  repo.recordSensor('2026-09-01', 3000, 5000, false);
  assert.equal(repo.wallet().balance, 35); // 30 base + 5 challenge
  repo.recordSensor('2026-09-01', 100, 500, false);
  assert.equal(repo.list()[0].goal, 5000);
  assert.equal(repo.wallet().balance, 36); // Lowering the setting cannot grant today's goal.
  repo.recordSensor('2026-09-01', 1900, 500, false);
  assert.equal(repo.wallet().balance, 75); // 50 base + 5 + 10 + 10
  repo.recordSensor('2026-09-01', 16000, 500, false);
  assert.equal(repo.wallet().balance, 225); // 200 capped base + 25 bonuses
  const count = repo.wallet().movements.length;
  repo.recordSensor('2026-09-01', 500, 500, false);
  assert.equal(repo.wallet().balance, 225);
  assert.equal(repo.wallet().movements.length, count);
  sqlite.close();
});
test('three consecutive goals award once; replacing an eligible day reverses coins and streak', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  for (const date of ['2026-09-01', '2026-09-02', '2026-09-03']) repo.recordSensor(date, 5000, 5000, false);
  assert.equal(repo.wallet().balance, 250); // 3 * 75 + 25 streak
  repo.recordSensor('2026-09-04', 5000, 5000, false);
  assert.equal(repo.wallet().balance, 325); // No second streak bonus
  repo.reconcileHealth('2026-09-02', 6000, 5000);
  assert.equal(repo.wallet().balance, 225); // -75 day, -25 streak
  const count = repo.wallet().movements.length;
  repo.reconcileHealth('2026-09-02', 6000, 5000);
  assert.equal(repo.wallet().movements.length, count);
  assert.equal(repo.wallet().balance, 225);
  repo.reconcileHealth('2026-09-02', 10000, 5000);
  assert.equal(repo.wallet().balance, 225);
  repo.recordSensor('2026-09-05', 5000, 5000, false);
  assert.equal(repo.wallet().balance, 325); // New valid 3–5 streak restores the single entitlement.
  const reopened = createRepository(db);
  assert.equal(reopened.wallet().balance, 325);
  sqlite.close();
});
test('a failed ledger write rolls back the activity and retries do not duplicate rewards', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  sqlite.exec("CREATE TRIGGER fail_reward BEFORE INSERT ON local_coin_ledger BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;");
  assert.throws(() => repo.recordSensor('2026-09-01', 100, 5000, false));
  assert.equal(repo.list().length, 0);
  assert.equal(repo.wallet().balance, 0);
  sqlite.exec('DROP TRIGGER fail_reward');
  repo.recordSensor('2026-09-01', 100, 5000, false);
  assert.equal(repo.wallet().balance, 1);
  assert.equal(repo.wallet().movements.length, 1);
  sqlite.close();
});
test('version 1 migration credits existing real sensor records exactly once', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  repo.recordSensor('2026-09-01', 5000, 5000, false);
  repo.savePreferences({ ...defaults, name: 'Migración' });
  sqlite.exec('DROP TABLE reward_state; DROP TABLE local_coin_ledger; UPDATE schema_version SET version=1;');
  const upgraded = createRepository(db);
  assert.equal(upgraded.wallet().balance, 75);
  assert.equal(upgraded.preferences().name, 'Migración');
  assert.equal(upgraded.list()[0].steps, 5000);
  assert.equal(createRepository(db).wallet().balance, 75);
  sqlite.close();
});
test('anomalies, invalid goals/dates and future records cannot award coins', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  assert.throws(() => repo.recordSensor('2026-09-01', 100, 5000, true));
  assert.throws(() => repo.recordSensor('2026-09-01', 100, 0, false));
  assert.throws(() => repo.recordSensor('2026-02-30', 100, 5000, false));
  repo.recordSensor('2099-01-01', 5000, 5000, false);
  assert.equal(repo.wallet().balance, 0);
  repo.reconcileHealth('2026-09-01', 20000, 5000);
  assert.equal(repo.wallet().balance, 0);
  sqlite.close();
});
test('limited movement history never limits balance and the cached entitlements equal the ledger', () => {
  const { sqlite, db } = database(); const repo = createRepository(db);
  for (let i = 0; i < 60; i++) repo.recordSensor('2026-09-01', 100, 50000, false);
  const wallet = repo.wallet();
  assert.equal(wallet.balance, 75); // 60 base plus the 3k and 5k challenges.
  assert.equal(wallet.movements.length, 50);
  const ledger = sqlite.prepare('SELECT SUM(delta) AS balance FROM local_coin_ledger').get() as { balance: number };
  assert.equal(wallet.balance, ledger.balance);
  repo.reconcileHealth('2026-09-01', 5000, 50000);
  assert.equal(repo.wallet().balance, 0);
  assert.equal(repo.wallet().balance, (sqlite.prepare('SELECT SUM(delta) AS balance FROM local_coin_ledger').get() as { balance: number }).balance);
  sqlite.close();
});

test('first discovery and imported sectors award a single persistent entitlement',()=>{
 const {sqlite,db}=database(); const repo=createRepository(db);
 assert.equal(repo.discover('1:1'),true);assert.equal(repo.discover('1:1'),false);
 repo.discover('2:1');assert.equal(repo.wallet().balance,10);
 assert.equal(createRepository(db).wallet().balance,10);assert.equal(repo.cells().length,2);
 assert.throws(()=>repo.discover('999999:1'));assert.equal(repo.cells().length,2);sqlite.close();
});
test('acknowledging an older upload preserves newer steps and preference edits',()=>{
 const {sqlite,db}=database();const repo=createRepository(db);
 repo.recordSensor('2026-09-01',100,5000,false);repo.savePreferences({...defaults,name:'Primero'});repo.discover('1:1');
 const pending=repo.pending();repo.recordSensor('2026-09-01',100,5000,false);repo.savePreferences({...defaults,name:'Segundo'});
 repo.acknowledge(pending.days,pending.cells,pending.preferenceRevision);
 assert.equal(repo.pending().days[0].steps,200);assert.equal(repo.pending().cells.length,0);assert.equal(repo.pending().editPreferences,true);
 const next=repo.pending();repo.acknowledge(next.days,next.cells,next.preferenceRevision);assert.equal(repo.pending().days.length,0);assert.equal(repo.pending().editPreferences,false);sqlite.close();
});
test('remote snapshots never generate local steps or coins, and device identity persists',()=>{
 const {sqlite,db}=database();const repo=createRepository(db);const id=repo.deviceId(()=> 'test-device');
 repo.saveRemote({days:[{date:'2026-09-01',steps:5000,goal:5000,source:'sensor',partial:true,timezone:'America/Santiago',updatedAt:new Date().toISOString(),revision:1,anomalies:0}],balance:75,cells:['1:1']});
 assert.equal(repo.list().length,0);assert.equal(repo.wallet().balance,0);assert.equal(repo.remote()?.balance,75);assert.deepEqual(repo.cells(),['1:1']);assert.equal(createRepository(db).deviceId(()=> 'wrong'),id);sqlite.close();
});
test('separate repositories isolate guest and account history; import never sums days',()=>{
 const a=database(),b=database();const guest=createRepository(a.db),account=createRepository(b.db);
 guest.recordSensor('2026-09-01',5000,5000,false);assert.equal(account.list().length,0);
 account.importGuest(guest.exportGuest());account.importGuest(guest.exportGuest());assert.equal(account.list()[0].steps,5000);assert.equal(account.wallet().balance,75);assert.equal(account.pending().days.length,1);a.sqlite.close();b.sqlite.close();
});
