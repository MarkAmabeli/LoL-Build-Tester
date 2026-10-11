import { addBonus } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Resolve/Conditioning: ArmorBase 8, MRBase 8, ExtraResist 0.03, MinutesRequired 12.
const FLAT = 8;
const RESIST_AMP = 0.03;

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
    const amp = (s: typeof stats.armor) => addBonus(s, FLAT + (s.total + FLAT) * RESIST_AMP);
    return { ...stats, armor: amp(stats.armor), mr: amp(stats.mr) };
  },
};
