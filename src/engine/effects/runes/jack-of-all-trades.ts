import { addAdaptiveForce } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Inspiration/JackOfAllTrades: HastePerStack 1, plus two unnamed values 8 and 20
// (the adaptive force at 5 and 10 stacks). The data gives no stack cap.
const HASTE_PER_STACK = 1;
const ADAPTIVE_STEPS = [{ stacks: 10, force: 20 }, { stacks: 5, force: 8 }];

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
