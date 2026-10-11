import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon Items/4633: HealthToAPConversionPercent 0.02 (of bonus health);
// EternityDamageIncreasePerSecond 0.02, EternityDamageIncreaseMax 0.08. (MaxAPMultiplier 0.05
// isn't described in game and isn't applied.)
const HP_TO_AP = 0.02;
const AMP_PER_SECOND = 0.02;
const MAX_SECONDS = 4;

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
  // BuffCounterDuration 4 out of combat resets it.
  cycles: [{ kind: 'stacks', field: 'seconds', counts: 'second', max: MAX_SECONDS, expiresAfter: 4 }],
  modifyStats: (stats) => ({ ...stats, ap: stats.ap + HP_TO_AP * stats.hp.bonus }),
  preMitigation: (hit, { state }) => {
    const amp = AMP_PER_SECOND * Math.min(MAX_SECONDS, Number(state.seconds));
    return amp > 0 ? amplify(hit, amp) : hit;
  },
};
