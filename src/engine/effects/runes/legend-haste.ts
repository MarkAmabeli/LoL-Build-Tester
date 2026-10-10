import type { Effect } from '../types';

// CommunityDragon perks Precision/LegendHaste: HastePerStack 1.5, HasteBase 0, MaxLegendStacks 10.
const PER_STACK = 1.5;
const MAX_STACKS = 10;

/** Gain 1.5 basic ability haste per Legend stack (up to 10). Counted as general ability haste, which also speeds up the ultimate. */
export const legendHaste: Effect = {
  id: '9105',
  name: 'Legend: Haste',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Legend stacks', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
  modifyStats: (stats, state) => ({
    ...stats,
    abilityHaste: stats.abilityHaste + PER_STACK * Math.min(MAX_STACKS, Number(state.stacks)),
  }),
};
