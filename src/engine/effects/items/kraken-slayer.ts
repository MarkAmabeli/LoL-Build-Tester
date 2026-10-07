import { isRanged } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/6672: 150 at level 1, +5 per level from level 9;
// RangedDamageMultiplier 0.8; MaxAmpNumber 1.75.
const BASE = 150;
const BREAKPOINT_LEVEL = 9;
const PER_LEVEL_AFTER = 5;
const RANGED_MULT = 0.8;
const MAX_AMP = 1.75;

export function krakenBaseDamage(level: number): number {
  return BASE + PER_LEVEL_AFTER * Math.max(0, level - BREAKPOINT_LEVEL + 1);
}

/**
 * Bring It Down: every third attack deals bonus physical damage on-hit, increased
 * by the target's missing health up to ×1.75.
 * Assumes the increase is linear in missing-health %; the bin data only gives the cap.
 * Confirm against Practice Tool numbers (ROADMAP step 7).
 */
export const krakenSlayer: Effect = {
  id: '6672',
  name: 'Kraken Slayer',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Third attack (proc)', kind: 'toggle', default: true }],
  onHit: ({ attacker, target, state }) => {
    if (!state.proc) return [];
    const maxHp = target.stats.hp.total;
    const missingPct = maxHp > 0 ? 1 - (target.currentHp ?? maxHp) / maxHp : 0;
    const amp = 1 + (MAX_AMP - 1) * Math.min(1, Math.max(0, missingPct));
    const rangedMult = isRanged(attacker) ? RANGED_MULT : 1;
    return [{
      type: 'physical',
      raw: krakenBaseDamage(attacker.level) * rangedMult * amp,
      source: 'Kraken Slayer',
      tags: ['onhit'],
    }];
  },
};
