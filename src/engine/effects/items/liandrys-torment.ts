import { amplify } from '../amplify';
import type { Effect } from '../types';
import { item, notApplied, sourced } from '../../hand';

// The burn is a ratio of the target's max health per second.
const BURN_RATIO_PER_SECOND = sourced('liandrys.burnRatioPerSecond', item('6653', 'BurnPercentHealthDamage', 0.02));
const BURN_SECONDS = sourced('liandrys.burnSeconds', item('6653', 'BurnDuration', 3));
const AMP_PER_SECOND = sourced('liandrys.ampPerSecond', item('6653', 'DamageIncreasePerSecond', 0.02));
const MAX_SECONDS = sourced('liandrys.maxSeconds', item('6653', 'MaxStackNumber', 3));
const COMBAT_RESET_SECONDS = sourced('liandrys.combatResetSeconds', item('6653', 'BuffCounterDuration', 3));
notApplied('liandrys.maxDamageHpThreshold', item('6653', 'MaxDamageHPThreshold', 1250), 'Not described in game');

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
    { key: 'burn', label: 'Torment burn', scope: 'setup', kind: 'toggle', default: true },
    { key: 'seconds', label: 'Seconds in combat', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_SECONDS },
  ],
  cycles: [{ kind: 'stacks', field: 'seconds', counts: 'second', max: MAX_SECONDS, expiresAfter: COMBAT_RESET_SECONDS }],
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
