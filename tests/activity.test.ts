import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSensor, dayKey, dayWindow, estimates, recentDays, validGoal } from '../src/domain/activity';

test('the initial Android counter event becomes a baseline and cannot grant a phantom step', () => {
  const result = consumeSensor({ cumulative: null, at: 1000, day: '2026-10-09' }, 1, 2000, '2026-10-09');
  assert.equal(result.delta, 0);
  assert.equal(consumeSensor(result.session, 11, 12000, '2026-10-09').delta, 10);
});
test('replayed cumulative reading and a fresh subscription cannot duplicate steps', () => {
  const a = consumeSensor({ cumulative: 1, at: 1000, day: '2026-10-09' }, 101, 61000, '2026-10-09');
  assert.equal(a.delta, 100);
  assert.equal(consumeSensor(a.session, 101, 62000, '2026-10-09').delta, 0);
  assert.equal(consumeSensor({ cumulative: null, at: 63000, day: '2026-10-09' }, 1, 64000, '2026-10-09').delta, 0);
});
test('midnight discards an ambiguous batch and rebases the next event', () => {
  const a = consumeSensor({ cumulative: 100, at: 1000, day: '2026-10-08' }, 110, 11000, '2026-10-09');
  assert.equal(a.delta, 0); assert.equal(a.boundary, true);
  assert.equal(consumeSensor(a.session, 120, 21000, '2026-10-09').delta, 10);
});
test('implausible bursts, reversed counters and negative steps are rejected', () => {
  const session = { cumulative: 10, at: 1000, day: '2026-10-09' };
  for (const value of [50000, -1, 9, NaN, 10.5]) {
    const result = consumeSensor(session, value, 2000, session.day);
    assert.equal(result.delta, 0); assert.equal(result.anomaly, true);
  }
});
test('goals and approximate distance are bounded and correctly calculated', () => {
  assert.equal(validGoal(5000), true); assert.equal(validGoal(5000.5), false);
  assert.equal(validGoal(0), false); assert.equal(validGoal(50001), false);
  assert.deepEqual(estimates(1000, 0.7, 70), { kilometers: 0.7, calories: 25 });
});
test('daily windows use local calendar boundaries including DST', () => {
  const now = new Date(2026, 9, 9, 12);
  assert.equal(dayKey(now), '2026-10-09');
  assert.deepEqual(recentDays(3, now), ['2026-10-07', '2026-10-08', '2026-10-09']);
  assert.equal(dayWindow('2026-10-09', now).end.getTime(), now.getTime());
  assert.equal(dayWindow('2026-09-06', now).end.getTime() - dayWindow('2026-09-06', now).start.getTime(), 23 * 60 * 60 * 1000);
});
