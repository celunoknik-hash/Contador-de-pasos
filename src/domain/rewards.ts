import { ActivityDay, dayKey, recentDays } from './activity';

export interface RewardTarget { key: string; amount: number; label: string; date: string | null }
export interface Challenge { id: string; title: string; description: string; progress: number; target: number; reward: number; completed: boolean; eligible: boolean }
export interface CoinMovement { id: number; key: string; delta: number; label: string; date: string | null; createdAt: string }
export interface Wallet { balance: number; movements: CoinMovement[] }
export const dailyChallenges = [
  { id: 'steps-3000', title: 'Un buen comienzo', description: 'Camina 3.000 pasos hoy.', target: 3000, reward: 5 },
  { id: 'steps-5000', title: 'Sigue explorando', description: 'Camina 5.000 pasos hoy.', target: 5000, reward: 10 },
  { id: 'daily-goal', title: 'A tu propio ritmo', description: 'Cumple el objetivo guardado para hoy.', target: 0, reward: 10 },
] as const;
// Aggregate Health Connect totals do not yet distinguish manually entered activity.
// Local rewards accept only the foreground sensor with the domain's cadence checks.
export const eligibleSteps = (day: ActivityDay) => day.source === 'sensor' ? day.steps : 0;
function qualifies(day: ActivityDay) { return eligibleSteps(day) >= day.goal; }
function previousDate(key: string) { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1)); }
export function hasThreeDayStreak(days: ActivityDay[], today: string) {
  const qualified = new Set(days.filter(d => d.date <= today && qualifies(d)).map(d => d.date));
  return [...qualified].some(date => qualified.has(previousDate(date)) && qualified.has(previousDate(previousDate(date))));
}
export function challengesFor(days: ActivityDay[], today: string, goal: number): Challenge[] {
  const day = days.find(d => d.date === today);
  const eligible = !day || day.source === 'sensor';
  const challenges: Challenge[] = dailyChallenges.map(def => {
    const target = def.target || day?.goal || goal;
    const progress = Math.min(day?.steps ?? 0, target);
    return { ...def, target, progress, eligible, completed: eligible && progress >= target };
  });
  let streak = 0;
  const todayDate = new Date(`${today}T12:00:00`);
  // A day in progress does not erase yesterday's streak.
  const dates = recentDays(3, (day && qualifies(day)) ? todayDate : new Date(`${previousDate(today)}T12:00:00`)).reverse();
  for (const date of dates) { const d = days.find(d => d.date === date); if (!d || !qualifies(d)) break; streak++; }
  const completed = hasThreeDayStreak(days, today);
  challenges.push({ id: 'three-days', title: 'Pequeños hábitos', description: 'Cumple tu objetivo tres días consecutivos. Recompensa única.', progress: completed ? 3 : streak, target: 3, reward: 25, completed, eligible: true });
  return challenges;
}
export function rewardTargets(days: ActivityDay[], today: string, includeStreak = true): RewardTarget[] {
  const targets: RewardTarget[] = [];
  for (const day of days.filter(d => d.date <= today)) {
    const steps = eligibleSteps(day);
    targets.push({ key: `steps:${day.date}`, amount: Math.floor(Math.min(steps, 20000) / 100), label: 'Pasos del día', date: day.date });
    for (const def of dailyChallenges) {
      const target = def.target || day.goal;
      targets.push({ key: `${def.id}:${day.date}`, amount: steps >= target ? def.reward : 0, label: def.title, date: day.date });
    }
  }
  if (includeStreak) targets.push({ key: 'three-days:v1', amount: hasThreeDayStreak(days, today) ? 25 : 0, label: 'Pequeños hábitos', date: null });
  return targets;
}
