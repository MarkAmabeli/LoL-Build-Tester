import type { Effect, HitContext } from '../types';
import { item, sourced } from '../../hand';

const BASE = sourced('stormsurge.base', item('4646', 'BaseDamage', 125));
const AP_RATIO = sourced('stormsurge.apRatio', item('4646', 'APRatio', 0.1));
const COOLDOWN = sourced('stormsurge.cooldown', item('4646', 'Cooldown', 30));

const squall = ({ attacker, state }: HitContext) =>
  state.proc ? [{ type: 'magic' as const, raw: BASE + AP_RATIO * attacker.ap, source: 'Squall', tags: ['proc' as const] }] : [];

/** Stormraider: dealing 25% of a champion's max health within 2.5s calls a Squall for 125 (+10% AP) magic damage. */
export const stormsurge: Effect = {
  id: '4646',
  name: 'Stormsurge',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Squall (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // The damage threshold (DamageThreshold in WindowDuration) is reported by the combo
  // simulator; the Squall's delay (DelayDuration) isn't modeled.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: COOLDOWN, requires: 'damageThreshold' }],
  onHit: squall,
  onAbilityHit: squall,
};
