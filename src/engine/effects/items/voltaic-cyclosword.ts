import { isRanged } from '../../stats';
import type { Effect } from '../types';
import { ENERGIZED_CYCLE } from './energized';
import { hand, item, sourced } from '../../hand';
const LETHALITY_SECONDS = sourced('voltaic.lethalitySeconds', item('6699', 'LethalityBonusDuration', 4));

const CURRENT_HP_RATIO = {
  melee: hand('voltaic.currentHpRatio.melee', 0.09, item('6699', 'PercentCurrentHPMelee', 9), 'percent'),
  ranged: hand('voltaic.currentHpRatio.ranged', 0.07, item('6699', 'PercentCurrentHPRanged', 7), 'percent'),
};
const BONUS_LETHALITY = {
  melee: sourced('voltaic.lethality.melee', item('6699', 'LethalityBonusModMelee', 15)),
  ranged: sourced('voltaic.lethality.ranged', item('6699', 'LethalityBonusModRanged', 12)),
};

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
    { key: 'proc', label: 'Energized attack (proc)', scope: 'combat', kind: 'toggle', default: true },
    { key: 'lethality', label: 'Firmament lethality active', scope: 'combat', kind: 'toggle', default: false },
  ],
  // Energized, starting charged (see energized.ts); lethality for LETHALITY_SECONDS after the proc.
  cycles: [
    ENERGIZED_CYCLE,
    { kind: 'buff', field: 'lethality', startedBy: 'proc', lasts: LETHALITY_SECONDS },
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
