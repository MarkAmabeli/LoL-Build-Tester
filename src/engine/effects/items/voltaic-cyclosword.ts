import { isRanged } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/6699: PercentCurrentHPMelee 9, PercentCurrentHPRanged 7;
// LethalityBonusModMelee 15, LethalityBonusModRanged 12, LethalityBonusDuration 4.
const CURRENT_HP_RATIO = { melee: 0.09, ranged: 0.07 };
const BONUS_LETHALITY = { melee: 15, ranged: 12 };

/**
 * Firmament: the Energized attack deals 9% (ranged 7%) of the target's current health
 * as bonus physical damage, then grants 15 (ranged 12) lethality for 4s.
 */
export const voltaicCyclosword: Effect = {
  id: '6699',
  name: 'Voltaic Cyclosword',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [
    { key: 'proc', label: 'Energized attack (proc)', kind: 'toggle', default: true },
    { key: 'lethality', label: 'Firmament lethality active', kind: 'toggle', default: false },
  ],
  modifyStats: (stats, state) =>
    state.lethality
      ? { ...stats, lethality: stats.lethality + (isRanged(stats) ? BONUS_LETHALITY.ranged : BONUS_LETHALITY.melee) }
      : stats,
  onHit: ({ attacker, target, state }) => {
    if (!state.proc) return [];
    const ratio = isRanged(attacker) ? CURRENT_HP_RATIO.ranged : CURRENT_HP_RATIO.melee;
    const current = target.currentHp ?? target.stats.hp.total;
    return [{ type: 'physical', raw: ratio * current, source: 'Voltaic Cyclosword', tags: ['onhit'] }];
  },
};
