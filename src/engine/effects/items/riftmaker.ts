import { amplify } from '../amplify';
import type { Effect } from '../types';
import { item, notApplied, sourced } from '../../hand';

// Health to AP converts bonus health.
const HP_TO_AP = sourced('riftmaker.hpToAp', item('4633', 'HealthToAPConversionPercent', 0.02));
const AMP_PER_SECOND = sourced('riftmaker.ampPerSecond', item('4633', 'EternityDamageIncreasePerSecond', 0.02));
const MAX_SECONDS = sourced('riftmaker.maxSeconds', item('4633', 'SecondsInCombat', 4));
const COMBAT_RESET_SECONDS = sourced('riftmaker.combatResetSeconds', item('4633', 'BuffCounterDuration', 4));
notApplied('riftmaker.maxApMultiplier', item('4633', 'MaxAPMultiplier', 0.05), "Not described in game");

/**
 * Void Infusion: gain 2% of bonus health as AP. Void Corruption: 2% more damage per
 * second in combat, up to 8%. The omnivamp at max isn't modeled.
 */
export const riftmaker: Effect = {
  id: '4633',
  name: 'Riftmaker',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'seconds', label: 'Seconds in combat', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_SECONDS }],
  // Time out of combat resets it.
  cycles: [{ kind: 'stacks', field: 'seconds', counts: 'second', max: MAX_SECONDS, expiresAfter: COMBAT_RESET_SECONDS }],
  modifyStats: (stats) => ({ ...stats, ap: stats.ap + HP_TO_AP * stats.hp.bonus }),
  preMitigation: (hit, { state }) => {
    const amp = AMP_PER_SECOND * Math.min(MAX_SECONDS, Number(state.seconds));
    return amp > 0 ? amplify(hit, amp) : hit;
  },
};
