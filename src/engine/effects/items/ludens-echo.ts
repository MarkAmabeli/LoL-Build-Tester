import type { Effect } from '../types';

// CommunityDragon Items/6655: BaseDamage 75, APRatio 0.05, MaxCharges 6, RepeatDamageReduction 0.2;
// SingleTargetMax = 2 × Damage.
const BASE = 75;
const AP_RATIO = 0.05;
/** One full Echo, then the other 5 at 20% each, when only the target is hit. */
const SINGLE_TARGET_MULT = 2;

/** Echo: a damaging ability fires 6 Echoes; on a lone target that's 2 × (75 + 5% AP) magic damage (12s cooldown). */
export const ludensEcho: Effect = {
  id: '6655',
  name: "Luden's Echo",
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Echo (proc)', scope: 'combat', kind: 'toggle', default: true }],
  // Items/6655 Cooldown 12.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'ability', hits: 1, cooldown: 12 }],
  onAbilityHit: ({ attacker, state }) =>
    state.proc
      ? [{ type: 'magic', raw: SINGLE_TARGET_MULT * (BASE + AP_RATIO * attacker.ap), source: "Luden's Echo", tags: ['proc'] }]
      : [],
};
