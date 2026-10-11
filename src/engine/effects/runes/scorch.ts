import { byLevel } from '../../stats';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const DAMAGE_L1 = sourced('scorch.damageL1', perk('8237', 'Damage', 20));
const DAMAGE_L18 = sourced('scorch.damageL18', perk('8237', 'DamageMax', 40));
const COOLDOWN = sourced('scorch.cooldown', perk('8237', 'BurnlockoutDuration', 10));

/** The next damaging ability hit burns champions for 20–40 bonus magic damage by level after 1s (10s cooldown). */
export const scorch: Effect = {
  id: '8237',
  name: 'Scorch',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Burn (proc)', scope: 'combat', kind: 'toggle', default: true }],
  cycles: [{ kind: 'proc', field: 'proc', counts: 'ability', hits: 1, cooldown: COOLDOWN }],
  onAbilityHit: ({ attacker, state }) =>
    state.proc
      ? [{ type: 'magic', raw: byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), source: 'Scorch', tags: ['proc', 'dot'] }]
      : [],
};
