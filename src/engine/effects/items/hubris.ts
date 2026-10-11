import { addBonus } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/6697: BaseADBonus 12, ADPerStatue 3, BuffDuration 90.
const BASE_AD = 12;
const AD_PER_STACK = 3;

/** Eminence: after a takedown, gain 12 AD plus 3 per stack (champions killed) for 90s. */
export const hubris: Effect = {
  id: '6697',
  name: 'Hubris',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [
    { key: 'active', label: 'Eminence active', scope: 'setup', kind: 'toggle', default: true },
    { key: 'stacks', label: 'Eminence stacks', scope: 'setup', kind: 'number', default: 0, min: 0, max: 50 },
  ],
  modifyStats: (stats, state) =>
    state.active
      ? { ...stats, ad: addBonus(stats.ad, BASE_AD + AD_PER_STACK * Math.max(0, Number(state.stacks))) }
      : stats,
};
