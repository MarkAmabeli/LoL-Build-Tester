import type { Effect } from '../types';

// CommunityDragon Items/6610, tooltip: "Crits for 150%", Cooldown 10 per target. The bin's
// CritModifier 0.8 isn't explained by the tooltip and isn't applied; nor is crit damage
// from other items.
const CRIT_MULTIPLIER = 1.5;

/** Lightshield Strike: the first attack against a champion crits for 150%. The healing isn't modeled. */
export const sunderedSky: Effect = {
  id: '6610',
  name: 'Sundered Sky',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Lightshield Strike ready (proc)', kind: 'toggle', default: true }],
  modifyHit: (hit, { attacker, state }) =>
    state.proc && hit.tags?.includes('auto')
      ? {
          ...hit,
          raw: attacker.ad.total * CRIT_MULTIPLIER,
          tags: [...hit.tags.filter((t) => t !== 'crit'), 'crit'],
        }
      : hit,
};
