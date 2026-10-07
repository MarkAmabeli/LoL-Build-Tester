import type { Effect } from '../types';

// CommunityDragon Items/3115: NashorsBaseValue 15, NashorsAPValue 0.15
const BASE = 15;
const AP_RATIO = 0.15;

/** Icathian Bite: attacks deal 15 (+15% AP) bonus magic damage on-hit. */
export const nashorsTooth: Effect = {
  id: '3115',
  name: "Nashor's Tooth",
  kind: 'item',
  verifiedPatch: '16.20',
  onHit: ({ attacker }) => [
    { type: 'magic', raw: BASE + AP_RATIO * attacker.ap, source: "Nashor's Tooth", tags: ['onhit'] },
  ],
};
