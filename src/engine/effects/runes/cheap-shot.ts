import { byLevel } from '../../stats';
import type { Effect, HitContext } from '../types';

// CommunityDragon perks Domination/CheapShot: DamageIncMin 10, DamageIncMax 45, Cooldown 4.
const DAMAGE_L1 = 10;
const DAMAGE_L18 = 45;

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
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: 4, requires: 'targetImpaired' }],
  onHit: proc,
  onAbilityHit: proc,
};
