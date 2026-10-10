import { addBonusAttackSpeed, isRanged } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/3073: UltimateHaste 30; BonusASMelee 50, BonusASRanged 25, BonusMSMelee 20, BonusMSRanged 10 (%), HasteDuration 8.
const BONUS_AS_PCT = { melee: 50, ranged: 25 };
const BONUS_MS_PCT = { melee: 0.2, ranged: 0.1 };
const ULTIMATE_HASTE = 30;

/**
 * Hexcharged: 30 ultimate haste. Overdrive: after casting your ultimate, gain 50%
 * (ranged 25%) attack speed and 20% (ranged 10%) move speed for 8s.
 */
export const experimentalHexplate: Effect = {
  id: '3073',
  name: 'Experimental Hexplate',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'overdrive', label: 'Overdrive active', kind: 'toggle', default: true }],
  modifyStats: (base, state) => {
    const stats = { ...base, ultimateHaste: base.ultimateHaste + ULTIMATE_HASTE };
    if (!state.overdrive) return stats;
    const ranged = isRanged(stats);
    const sped = addBonusAttackSpeed(stats, ranged ? BONUS_AS_PCT.ranged : BONUS_AS_PCT.melee);
    return { ...sped, moveSpeed: sped.moveSpeed * (1 + (ranged ? BONUS_MS_PCT.ranged : BONUS_MS_PCT.melee)) };
  },
};
