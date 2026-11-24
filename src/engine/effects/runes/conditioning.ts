import { addBonus } from '../../stats';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const FLAT_ARMOR = sourced('conditioning.flatArmor', perk('8429', 'ArmorBase', 8));
const RESIST_AMP = sourced('conditioning.amp', perk('8429', 'ExtraResist', 0.03));
const FLAT_MR = sourced('conditioning.flatMr', perk('8429', 'MRBase', 8));

/**
 * After 12 minutes, gain 8 armor and 8 MR, then increase armor and MR by 3%.
 * A defensive rune: put it on the target's loadout. Runs in the multiply phase
 * so the 3% sees every flat addition.
 */
export const conditioning: Effect = {
  id: '8429',
  name: 'Conditioning',
  kind: 'rune',
  verifiedPatch: '16.20',
  statPhase: 'multiply',
  state: [{ key: 'active', label: 'Past 12 minutes', scope: 'setup', kind: 'toggle', default: true }],
  modifyStats: (stats, state) => {
    if (!state.active) return stats;
    const amp = (s: typeof stats.armor, flat: number) => addBonus(s, flat + (s.total + flat) * RESIST_AMP);
    return { ...stats, armor: amp(stats.armor, FLAT_ARMOR), mr: amp(stats.mr, FLAT_MR) };
  },
};
