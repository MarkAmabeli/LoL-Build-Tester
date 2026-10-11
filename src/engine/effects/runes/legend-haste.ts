import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const PER_STACK = sourced('legendHaste.perStack', perk('9105', 'HastePerStack', 1.5));
const MAX_STACKS = sourced('legendHaste.maxStacks', perk('9105', 'MaxLegendStacks', 10));

/** Gain 1.5 basic ability haste per Legend stack (up to 10). */
export const legendHaste: Effect = {
  id: '9105',
  name: 'Legend: Haste',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Legend stacks', scope: 'setup', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
  modifyStats: (stats, state) => ({
    ...stats,
    basicHaste: stats.basicHaste + PER_STACK * Math.min(MAX_STACKS, Number(state.stacks)),
  }),
};
