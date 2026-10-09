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
