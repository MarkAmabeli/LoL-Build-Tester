import type { Effect, HitContext } from '../types';

// CommunityDragon Items/4646: BaseDamage 125, APRatio 0.1, DamageThreshold 0.25, WindowDuration 2.5.
const BASE = 125;
const AP_RATIO = 0.1;

const squall = ({ attacker, state }: HitContext) =>
  state.proc ? [{ type: 'magic' as const, raw: BASE + AP_RATIO * attacker.ap, source: 'Squall', tags: ['proc' as const] }] : [];

/** Stormraider: dealing 25% of a champion's max health within 2.5s calls a Squall for 125 (+10% AP) magic damage. */
export const stormsurge: Effect = {
  id: '4646',
  name: 'Stormsurge',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Squall (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // Cooldown 30. The damage threshold (DamageThreshold 0.25 in WindowDuration 2.5) is reported by
  // the combo simulator; the Squall lands after DelayDuration 2, which isn't modeled.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: 30, requires: 'damageThreshold' }],
  onHit: squall,
  onAbilityHit: squall,
};
