import type { Effect } from '../types';

// CommunityDragon Items/3091: OnHitDamage 45 (magic).
const DAMAGE = 45;

/** Fray: attacks deal 45 bonus magic damage on-hit. */
export const witsEnd: Effect = {
  id: '3091',
  name: "Wit's End",
  kind: 'item',
  verifiedPatch: '16.20',
  onHit: () => [{ type: 'magic', raw: DAMAGE, source: "Wit's End", tags: ['onhit'] }],
};
