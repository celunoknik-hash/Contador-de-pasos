// No billing integration. Essential walking features always stay free.
export type Feature='steps'|'daily-progress'|'exploration'|'challenges'|'history'|'future-pro-customization';
export interface Entitlements { plan:'free'|'pro'; enabledExtras: ReadonlySet<Feature> }
export const freeEntitlements:Entitlements={plan:'free',enabledExtras:new Set()};
export function canUse(feature:Feature,rights:Entitlements=freeEntitlements) {
  return feature!=='future-pro-customization' || rights.plan==='pro' || rights.enabledExtras.has(feature);
}
