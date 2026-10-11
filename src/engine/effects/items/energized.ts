import type { Cycle } from '../cycles';
import type { Effect, StateField } from '../types';
import { item, sourced } from '../../hand';

// Energized: moving and attacking charges an Energized attack. Energized items don't share
// a shop limit, so each built item adds its own effect to the same attack.
const ENERGIZED: StateField = { key: 'proc', label: 'Energized attack (proc)', scope: 'combat', kind: 'toggle', default: true };
// Energized stacks come from moving and attacking, which the engine doesn't track: the combo
// simulator reports when they're full. Deliberate exception to "unstacked at the start of
// combat": the stacks build while walking into the fight, so the first attack is Energized.
export const ENERGIZED_CYCLE: Cycle = { kind: 'proc', field: 'proc', counts: 'attack', hits: 1, requires: 'energized', startsReady: true };

const SHIV_DAMAGE = sourced('statikk.damage', item('3087', 'ChainDamage', 60));

/**
 * Electrospark: the Energized attack fires chain lightning for 60 magic damage. Only the
 * primary target is counted; the bounces and Electroshock's extra stacks aren't modeled.
 */
export const statikkShiv: Effect = {
  id: '3087',
  name: 'Statikk Shiv',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [ENERGIZED],
  cycles: [ENERGIZED_CYCLE],
  onHit: ({ state }) => (state.proc ? [{ type: 'magic', raw: SHIV_DAMAGE, source: 'Statikk Shiv', tags: ['onhit'] }] : []),
};

const RFC_DAMAGE = sourced('rfc.damage', item('3094', 'BonusDamage', 40));

/** Sharpshooter: the Energized attack deals 40 bonus magic damage. The bonus range isn't modeled. */
export const rapidFirecannon: Effect = {
  id: '3094',
  name: 'Rapid Firecannon',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [ENERGIZED],
  cycles: [ENERGIZED_CYCLE],
  onHit: ({ state }) => (state.proc ? [{ type: 'magic', raw: RFC_DAMAGE, source: 'Rapid Firecannon', tags: ['onhit'] }] : []),
};
