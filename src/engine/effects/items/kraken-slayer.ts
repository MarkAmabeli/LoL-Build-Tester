import { targetHpPct } from '../../damage';
import { isRanged } from '../../stats';
import type { Effect } from '../types';
import { item, sourced } from '../../hand';

// Base damage at level 1, plus a bonus per level from the breakpoint level.
const BASE = sourced('kraken.base', item('6672', 'calc:DamageAmount.0.mLevel1Value', 150));
const BREAKPOINT_LEVEL = sourced('kraken.breakpointLevel', item('6672', 'calc:DamageAmount.0.mBreakpoints.0.mLevel', 9));
const PER_LEVEL_AFTER = sourced('kraken.perLevelAfter', item('6672', 'calc:DamageAmount.0.mBreakpoints.0.mBonusPerLevelAtAndAfter', 5));
const RANGED_MULT = sourced('kraken.rangedMult', item('6672', 'RangedDamageMultiplier', 0.8));
const MAX_AMP = sourced('kraken.maxAmp', item('6672', 'MaxAmpNumber', 1.75));
const ATTACKS = sourced('kraken.attacks', item('6672', 'AttackCount', 3));
const COUNT_SECONDS = sourced('kraken.countSeconds', item('6672', 'BuffDuration', 4));

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
  state: [{ key: 'proc', label: 'Third attack (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // The count lasts COUNT_SECONDS after each attack.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'attack', hits: ATTACKS, window: { seconds: COUNT_SECONDS, from: 'last' } }],
  onHit: ({ attacker, target, state }) => {
    if (!state.proc) return [];
    const missingPct = 1 - targetHpPct(target);
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
