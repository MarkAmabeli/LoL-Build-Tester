import type { Effect } from '../types';

// CommunityDragon Items/3071: ShredPerStack 0.06, MaxStacks 5
const SHRED_PER_STACK = 0.06;
const MAX_STACKS = 5;

/** Carve: physical damage shreds 6% armor per stack, up to 5 stacks. Fervor (move speed) isn't modeled. */
export const blackCleaver: Effect = {
  id: '3071',
  name: 'Black Cleaver',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [
    { key: 'stacks', label: 'Carve stacks on target', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS },
  ],
  targetResist: ({ state }) => ({
    armor: { pct: SHRED_PER_STACK * Math.min(MAX_STACKS, Number(state.stacks)) },
  }),
};
