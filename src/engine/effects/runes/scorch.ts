import { byLevel } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Sorcery/Scorch: Damage 20, DamageMax 40 (by level), BurnlockoutDuration 10.
const DAMAGE_L1 = 20;
const DAMAGE_L18 = 40;

/** The next damaging ability hit burns champions for 20–40 bonus magic damage by level after 1s (10s cooldown). */
export const scorch: Effect = {
  id: '8237',
  name: 'Scorch',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Burn ready (proc)', kind: 'toggle', default: true }],
  onAbilityHit: ({ attacker, state }) =>
    state.proc
      ? [{ type: 'magic', raw: byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), source: 'Scorch', tags: ['proc', 'dot'] }]
      : [],
};
