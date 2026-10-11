import type { Effect } from '../types';
import { item, sourced } from '../../hand';

const BASE = sourced('ludens.base', item('6655', 'BaseDamage', 75));
const AP_RATIO = sourced('ludens.apRatio', item('6655', 'APRatio', 0.05));
/** One full Echo, then the other 5 at 20% each, when only the target is hit. */
const SINGLE_TARGET_MULT = 1 + (sourced('ludens.charges', item('6655', 'MaxCharges', 6)) - 1) * sourced('ludens.repeatDamage', item('6655', 'RepeatDamageReduction', 0.2));
const COOLDOWN = sourced('ludens.cooldown', item('6655', 'Cooldown', 12));

/** Echo: a damaging ability fires 6 Echoes; on a lone target that's 2 × (75 + 5% AP) magic damage (12s cooldown). */
export const ludensEcho: Effect = {
  id: '6655',
  name: "Luden's Echo",
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Echo (proc)', scope: 'combat', kind: 'toggle', default: true }],
  cycles: [{ kind: 'proc', field: 'proc', counts: 'ability', hits: 1, cooldown: COOLDOWN }],
  onAbilityHit: ({ attacker, state }) =>
    state.proc
      ? [{ type: 'magic', raw: SINGLE_TARGET_MULT * (BASE + AP_RATIO * attacker.ap), source: "Luden's Echo", tags: ['proc'] }]
      : [],
};
