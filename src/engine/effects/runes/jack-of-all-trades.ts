import { addAdaptiveForce } from '../../stats';
import type { Effect } from '../types';
import { hand, perk, runeText, sourced } from '../../hand';

// The adaptive force values are unnamed in the bin. The data gives no stack cap.
const HASTE_PER_STACK = sourced('jackOfAllTrades.hastePerStack', perk('8316', 'HastePerStack', 1));
const ADAPTIVE_STEPS = [
  { stacks: hand('jackOfAllTrades.stacks2', 10, runeText(8316, 'at 5 and 10 stacks')), force: sourced('jackOfAllTrades.force2', perk('8316', '{55d14eea}', 20)) },
  { stacks: hand('jackOfAllTrades.stacks1', 5, runeText(8316, 'at 5 and 10 stacks')), force: sourced('jackOfAllTrades.force1', perk('8316', '{1b48f5ea}', 8)) },
];

/** One stack per different stat from items; each grants 1 ability haste, and 5 / 10 stacks grant 8 / 20 adaptive force. */
export const jackOfAllTrades: Effect = {
  id: '8316',
  name: 'Jack of All Trades',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Different item stats', scope: 'setup', kind: 'number', default: 0, min: 0, max: 20 }],
  modifyStats: (stats, state) => {
    const stacks = Number(state.stacks);
    const force = ADAPTIVE_STEPS.find((s) => stacks >= s.stacks)?.force ?? 0;
    return { ...addAdaptiveForce(stats, force), abilityHaste: stats.abilityHaste + HASTE_PER_STACK * stacks };
  },
};
