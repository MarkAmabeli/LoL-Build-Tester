import { isRanged } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/3153: MeleeValue 0.09, RangedValue 0.06 (of the target's current health, physical).
const MELEE_RATIO = 0.09;
const RANGED_RATIO = 0.06;

/** Mist's Edge: attacks deal 9% (ranged 6%) of the target's current health as bonus physical damage on-hit. */
export const bladeOfTheRuinedKing: Effect = {
  id: '3153',
  name: 'Blade of The Ruined King',
  kind: 'item',
  verifiedPatch: '16.20',
  onHit: ({ attacker, target }) => {
    const ratio = isRanged(attacker) ? RANGED_RATIO : MELEE_RATIO;
    const current = target.currentHp ?? target.stats.hp.total;
    return [{ type: 'physical', raw: ratio * current, source: 'Blade of The Ruined King', tags: ['onhit'] }];
  },
};
