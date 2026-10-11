import { addBonusAttackSpeed, isRanged } from '../../stats';
import type { Effect } from '../types';
import { hand, item, sourced } from '../../hand';

const BONUS_AS_PCT = {
  melee: sourced('hexplate.attackSpeed.melee', item('3073', 'BonusASMelee', 50)),
  ranged: sourced('hexplate.attackSpeed.ranged', item('3073', 'BonusASRanged', 25)),
};
const BONUS_MS_PCT = {
  melee: hand('hexplate.moveSpeed.melee', 0.2, item('3073', 'BonusMSMelee', 20), 'percent'),
  ranged: hand('hexplate.moveSpeed.ranged', 0.1, item('3073', 'BonusMSRanged', 10), 'percent'),
};
const ULTIMATE_HASTE = sourced('hexplate.ultimateHaste', item('3073', 'UltimateHaste', 30));
const OVERDRIVE_SECONDS = sourced('hexplate.overdriveSeconds', item('3073', 'HasteDuration', 8));
const COOLDOWN = sourced('hexplate.cooldown', item('3073', 'Cooldown', 30));

/**
 * Hexcharged: 30 ultimate haste. Overdrive: after casting your ultimate, gain 50%
 * (ranged 25%) attack speed and 20% (ranged 10%) move speed for 8s.
 */
export const experimentalHexplate: Effect = {
  id: '3073',
  name: 'Experimental Hexplate',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'overdrive', label: 'Overdrive active', scope: 'combat', kind: 'toggle', default: false }],
  cycles: [{ kind: 'proc', field: 'overdrive', counts: 'ultimateCast', hits: 1, lasts: OVERDRIVE_SECONDS, cooldown: COOLDOWN }],
  modifyStats: (base, state) => {
    const stats = { ...base, ultimateHaste: base.ultimateHaste + ULTIMATE_HASTE };
    if (!state.overdrive) return stats;
    const ranged = isRanged(stats);
    const sped = addBonusAttackSpeed(stats, ranged ? BONUS_AS_PCT.ranged : BONUS_AS_PCT.melee);
    return { ...sped, moveSpeed: sped.moveSpeed * (1 + (ranged ? BONUS_MS_PCT.ranged : BONUS_MS_PCT.melee)) };
  },
};
