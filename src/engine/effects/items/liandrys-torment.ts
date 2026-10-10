import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon Items/6653: BurnPercentHealthDamage 0.02 per second, BurnDuration 3;
// DamageIncreasePerSecond 0.02, DamageIncreaseMax 0.06. (MaxDamageHPThreshold 1250 isn't
// described in game and isn't applied.)
const BURN_RATIO_PER_SECOND = 0.02;
const BURN_SECONDS = 3;
const AMP_PER_SECOND = 0.02;
const MAX_SECONDS = 3;

/**
 * Torment: damaging abilities burn for 2% of the target's max health per second for 3s
 * (counted as one full burn). Suffering: 2% more damage per second in combat, up to 6%.
 */
export const liandrysTorment: Effect = {
  id: '6653',
  name: "Liandry's Torment",
  kind: 'item',
  verifiedPatch: '16.20',
  state: [
    { key: 'burn', label: 'Torment burn', kind: 'toggle', default: true },
    { key: 'seconds', label: 'Seconds in combat', kind: 'number', default: MAX_SECONDS, min: 0, max: MAX_SECONDS },
  ],
  onAbilityHit: ({ target, state }) =>
    state.burn
      ? [{
          type: 'magic',
          raw: BURN_RATIO_PER_SECOND * BURN_SECONDS * target.stats.hp.total,
          source: "Liandry's burn",
          tags: ['proc', 'dot'],
        }]
      : [],
  preMitigation: (hit, { state }) => {
    const amp = AMP_PER_SECOND * Math.min(MAX_SECONDS, Number(state.seconds));
    return amp > 0 ? amplify(hit, amp) : hit;
  },
};
