import { isRanged } from '../../stats';
import type { Effect } from '../types';
import { hand, item, itemText, sourced } from '../../hand';

const BASE_AD_RATIO = sourced('hullbreaker.baseAdRatio', item('3181', 'SkipperADRatio', 1.2));
const HP_RATIO = sourced('hullbreaker.hpRatio', item('3181', 'MaxStackDamageHPRatio', 0.05));
const RANGED_MULT = hand('hullbreaker.rangedMult', 0.7, item('3181', 'RangedSkipperADRatio', 0.7), 'Ranged is 70% as effective: applies to both the base AD and max health parts (84% base AD + 3.5% max health)');
const ATTACKS = hand('hullbreaker.attacks', 5, itemText('3181', 'Every fifth Attack'));
const STACK_SECONDS = sourced('hullbreaker.stackSeconds', item('3181', 'SkipperStackDuration', 10));

/** Skipper: every fifth attack against champions deals bonus physical damage. */
export const hullbreaker: Effect = {
  id: '3181',
  name: 'Hullbreaker',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Fifth attack (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // The stack count isn't in the bin; the in-game description says "Every fifth Attack".
  cycles: [{ kind: 'proc', field: 'proc', counts: 'attack', hits: ATTACKS, window: { seconds: STACK_SECONDS, from: 'last' } }],
  onHit: ({ attacker, state }) => {
    if (!state.proc) return [];
    const raw = (BASE_AD_RATIO * attacker.ad.base + HP_RATIO * attacker.hp.total) * (isRanged(attacker) ? RANGED_MULT : 1);
    return [{ type: 'physical', raw, source: 'Hullbreaker', tags: ['onhit'] }];
  },
};
