import type { Effect } from '../types';

// CommunityDragon Items/3089: APAmp 0.3
const AP_AMP = 0.3;

/** Magical Opus: increases total AP by 30%. */
export const rabadonsDeathcap: Effect = {
  id: '3089',
  name: "Rabadon's Deathcap",
  kind: 'item',
  verifiedPatch: '16.20',
  statPhase: 'multiply',
  modifyStats: (stats) => ({ ...stats, ap: stats.ap * (1 + AP_AMP) }),
};
