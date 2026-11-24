import { byLevel } from '../../stats';
import type { Effect, HitContext } from '../types';
import { perk, sourced } from '../../hand';

const DAMAGE_L1 = sourced('suddenImpact.damageL1', perk('8143', 'MinDamageTooltip', 20));
const DAMAGE_L18 = sourced('suddenImpact.damageL18', perk('8143', 'MaxDamageTooltip', 80));
const ARMED_SECONDS = sourced('suddenImpact.armedSeconds', perk('8143', 'ArmedDuration', 4));
const COOLDOWN = sourced('suddenImpact.cooldown', perk('8143', 'Cooldown', 10));

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
  // A dash arms it for ARMED_SECONDS; the next hit procs.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'dash', hits: 1, consumedBy: 'hit', armedFor: ARMED_SECONDS, cooldown: COOLDOWN }],
  onHit: proc,
  onAbilityHit: proc,
};
