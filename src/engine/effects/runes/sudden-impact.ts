import { byLevel } from '../../stats';
import type { Effect, HitContext } from '../types';

// CommunityDragon perks Domination/SuddenImpact: 20–80 by level, ArmedDuration 4, Cooldown 10.
const DAMAGE_L1 = 20;
const DAMAGE_L18 = 80;

const proc = ({ attacker, state }: HitContext) =>
  state.proc
    ? [{ type: 'true' as const, raw: byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), source: 'Sudden Impact', tags: ['proc' as const] }]
    : [];

/** After a dash, leap, blink, teleport or leaving stealth, the next attack or ability deals 20–80 bonus true damage by level. */
export const suddenImpact: Effect = {
  id: '8143',
  name: 'Sudden Impact',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'After dash or stealth (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // A dash arms it for ArmedDuration 4; the next hit procs; Cooldown 10.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'dash', hits: 1, consumedBy: 'hit', armedFor: 4, cooldown: 10 }],
  onHit: proc,
  onAbilityHit: proc,
};
