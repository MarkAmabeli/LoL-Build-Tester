import type { Effect } from '../types';

// CommunityDragon Items/6610: CritModifier 0.8, Cooldown 10 per target. The crit deals 80% of
// normal crit damage and is affected by crit damage modifiers like Infinity Edge (wiki,
// V26.01: "Critical damage ratio reduced to 80% from 100%"), so 160% at the 200% base.
const CRIT_MODIFIER = 0.8;

/**
 * Lightshield Strike: the first attack against a champion crits for 80% of the attacker's
 * crit damage (160% base). The healing isn't modeled.
 */
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
          raw: attacker.ad.total * CRIT_MODIFIER * attacker.critMultiplier,
          tags: [...hit.tags.filter((t) => t !== 'crit'), 'crit'],
        }
      : hit,
};
