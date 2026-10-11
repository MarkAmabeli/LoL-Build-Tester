import type { Effect } from '../types';
import { item, sourced } from '../../hand';

const SHRED_PER_STACK = sourced('blackCleaver.shredPerStack', item('3071', 'ShredPerStack', 0.06));
const MAX_STACKS = sourced('blackCleaver.maxStacks', item('3071', 'MaxStacks', 5));
const STACK_SECONDS = sourced('blackCleaver.stackSeconds', item('3071', 'DebuffDuration', 6));

/** Carve: physical damage shreds 6% armor per stack, up to 5 stacks. Fervor (move speed) isn't modeled. */
export const blackCleaver: Effect = {
  id: '3071',
  name: 'Black Cleaver',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [
    { key: 'stacks', label: 'Carve stacks on target', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS },
  ],
  cycles: [{ kind: 'stacks', field: 'stacks', counts: 'physicalHit', max: MAX_STACKS, expiresAfter: STACK_SECONDS }],
  targetResist: ({ state }) => ({
    armor: { pct: SHRED_PER_STACK * Math.min(MAX_STACKS, Number(state.stacks)) },
  }),
};
