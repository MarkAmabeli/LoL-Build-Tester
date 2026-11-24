import { amplify } from '../amplify';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const MIN_AMP = sourced('lastStand.minAmp', perk('8299', 'MinBonusDamagePercent', 0.05));
const MAX_AMP = sourced('lastStand.maxAmp', perk('8299', 'MaxBonusDamagePercent', 0.11));
const START = sourced('lastStand.start', perk('8299', 'HealthThresholdStart', 0.6));
const END = sourced('lastStand.end', perk('8299', 'HealthThresholdEnd', 0.3));

/**
 * Damage increase from your own health: none at 60% or more, 5% just below 60%,
 * rising to 11% at 30% health and below. Assumes it rises linearly in between;
 * the data only gives the endpoints.
 */
export function lastStandAmp(hpPct: number): number {
  if (hpPct >= START) return 0;
  const t = Math.min(1, (START - hpPct) / (START - END));
  return MIN_AMP + (MAX_AMP - MIN_AMP) * t;
}

/** Deal 5–11% more damage to champions while below 60% health (uses the attacker's current health). */
export const lastStand: Effect = {
  id: '8299',
  name: 'Last Stand',
  kind: 'rune',
  verifiedPatch: '16.20',
  preMitigation: (hit, { attacker }) => {
    const amp = lastStandAmp(attacker.currentHpPct);
    return amp > 0 ? amplify(hit, amp) : hit;
  },
};
