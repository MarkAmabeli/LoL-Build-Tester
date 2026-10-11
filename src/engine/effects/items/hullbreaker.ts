import { isRanged } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/3181 MaxStackDamage: 1.2 × base AD + 0.05 × max health, ranged × 0.7.
const BASE_AD_RATIO = 1.2;
const HP_RATIO = 0.05;
const RANGED_MULT = 0.7;

/** Skipper: every fifth attack against champions deals bonus physical damage. */
export const hullbreaker: Effect = {
  id: '3181',
  name: 'Hullbreaker',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Fifth attack (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // Five stacks (wiki: "the fifth stack consumes them all"; not in the bin), SkipperStackDuration 10.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'attack', hits: 5, window: { seconds: 10, from: 'last' } }],
  onHit: ({ attacker, state }) => {
    if (!state.proc) return [];
    const raw = (BASE_AD_RATIO * attacker.ad.base + HP_RATIO * attacker.hp.total) * (isRanged(attacker) ? RANGED_MULT : 1);
    return [{ type: 'physical', raw, source: 'Hullbreaker', tags: ['onhit'] }];
  },
};
