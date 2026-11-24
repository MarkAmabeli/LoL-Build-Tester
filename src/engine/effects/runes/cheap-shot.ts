import { byLevel } from '../../stats';
import type { Effect, HitContext } from '../types';
import { perk, sourced } from '../../hand';

const DAMAGE_L1 = sourced('cheapShot.damageL1', perk('8126', 'DamageIncMin', 10));
const DAMAGE_L18 = sourced('cheapShot.damageL18', perk('8126', 'DamageIncMax', 45));
const COOLDOWN = sourced('cheapShot.cooldown', perk('8126', 'Cooldown', 4));

const proc = ({ attacker, state }: HitContext) =>
  state.proc
    ? [{ type: 'true' as const, raw: byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), source: 'Cheap Shot', tags: ['proc' as const] }]
    : [];

/** Damaging a champion with impaired movement or actions deals 10–45 bonus true damage by level (4s cooldown). */
export const cheapShot: Effect = {
  id: '8126',
  name: 'Cheap Shot',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Target impaired (proc)', scope: 'combat', kind: 'toggle', default: false }],
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: COOLDOWN, requires: 'targetImpaired' }],
  onHit: proc,
  onAbilityHit: proc,
};
