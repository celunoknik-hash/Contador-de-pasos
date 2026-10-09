import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityDay } from '../src/domain/activity';
import { challengesFor, hasThreeDayStreak } from '../src/domain/rewards';
const day = (date: string, steps = 5000, source: ActivityDay['source'] = 'sensor'): ActivityDay => ({ date, steps, goal: 5000, source, partial: source === 'sensor', timezone: 'America/Santiago', updatedAt: `${date}T12:00:00Z`, revision: 1, anomalies: 0 });

test('challenge progress preserves yesterday streak while today is in progress and resets after a gap', () => {
  const days = [day('2026-09-05'), day('2026-09-06'), day('2026-09-07', 100)];
  const streak = challengesFor(days, '2026-09-07', 5000).find(c => c.id === 'three-days');
  assert.equal(streak?.progress, 2);
  assert.equal(streak?.completed, false);
  assert.equal(challengesFor(days, '2026-09-09', 5000).find(c => c.id === 'three-days')?.progress, 0);
  assert.equal(hasThreeDayStreak([day('2026-09-05'), day('2026-09-06'), day('2026-09-07')], '2026-09-07'), true);
});
test('Health Connect can show statistical progress without presenting an earned challenge', () => {
  const challenges = challengesFor([day('2026-09-07', 20000, 'health-connect')], '2026-09-07', 5000);
  for (const challenge of challenges.filter(c => c.id !== 'three-days')) {
    assert.equal(challenge.progress, challenge.target);
    assert.equal(challenge.completed, false);
    assert.equal(challenge.eligible, false);
  }
});
test('a future day cannot complete a streak and a recorded goal controls the current challenge', () => {
  assert.equal(hasThreeDayStreak([day('2026-09-05'), day('2026-09-06'), day('2026-09-07')], '2026-09-06'), false);
  const goal = challengesFor([day('2026-09-07', 500)], '2026-09-07', 500).find(c => c.id === 'daily-goal');
  assert.equal(goal?.target, 5000);
  assert.equal(goal?.completed, false);
});
