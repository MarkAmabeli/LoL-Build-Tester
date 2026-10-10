import { isRanged } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/3748: PrimaryTargetHPRatio 0.01 (of max health, physical), RangedEffectiveness 0.5.
const HP_RATIO = 0.01;
const RANGED_MULT = 0.5;

/**
 * Cleave: attacks deal 1% of your max health as bonus physical damage on-hit (ranged
 * 50%). The splash behind the target and the Titanic Crescent active aren't modeled.
 */
export const titanicHydra: Effect = {
  id: '3748',
  name: 'Titanic Hydra',
  kind: 'item',
  verifiedPatch: '16.20',
  onHit: ({ attacker }) => [{
    type: 'physical',
    raw: HP_RATIO * attacker.hp.total * (isRanged(attacker) ? RANGED_MULT : 1),
    source: 'Titanic Hydra',
    tags: ['onhit'],
  }],
};
