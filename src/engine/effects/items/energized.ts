import type { Effect, StateField } from '../types';

// Energized: moving and attacking charges an Energized attack. Energized items don't share
// a shop limit, so each built item adds its own effect to the same attack.
const ENERGIZED: StateField = { key: 'proc', label: 'Energized attack (proc)', kind: 'toggle', default: true };

// CommunityDragon Items/3087: ChainDamage 60 (magic), BounceCount 4–8 by level.
const SHIV_DAMAGE = 60;

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
  onHit: ({ state }) => (state.proc ? [{ type: 'magic', raw: SHIV_DAMAGE, source: 'Statikk Shiv', tags: ['onhit'] }] : []),
};

// Items/3094: BonusDamage 40 (magic), RangePercentIncrease 0.35, MaxRangeIncrease 150.
const RFC_DAMAGE = 40;

/** Sharpshooter: the Energized attack deals 40 bonus magic damage. The bonus range isn't modeled. */
export const rapidFirecannon: Effect = {
  id: '3094',
  name: 'Rapid Firecannon',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [ENERGIZED],
  onHit: ({ state }) => (state.proc ? [{ type: 'magic', raw: RFC_DAMAGE, source: 'Rapid Firecannon', tags: ['onhit'] }] : []),
};
