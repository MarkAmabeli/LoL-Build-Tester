import type { Effect } from '../types';

// CommunityDragon Items/2503: BurnFlatDamagePerSecond 20, APRatio 0.02, BurnDuration 3; APPerStack 0.04.
const BURN_PER_SECOND = 20;
const AP_RATIO_PER_SECOND = 0.02;
const BURN_SECONDS = 3;
const AP_AMP_PER_TARGET = 0.04;

/**
 * Baleful Blaze: damaging abilities burn for 20 (+2% AP) magic damage per second for 3s
 * (counted as one full burn). Blackfire: +4% AP per enemy champion or large monster burning.
 */
export const blackfireTorch: Effect = {
  id: '2503',
  name: 'Blackfire Torch',
  kind: 'item',
  verifiedPatch: '16.20',
  statPhase: 'multiply',
  state: [
    { key: 'burn', label: 'Baleful Blaze burn', kind: 'toggle', default: true },
    { key: 'burning', label: 'Enemies burning', kind: 'number', default: 1, min: 0, max: 10 },
  ],
  modifyStats: (stats, state) => ({ ...stats, ap: stats.ap * (1 + AP_AMP_PER_TARGET * Math.max(0, Number(state.burning))) }),
  onAbilityHit: ({ attacker, state }) =>
    state.burn
      ? [{
          type: 'magic',
          raw: (BURN_PER_SECOND + AP_RATIO_PER_SECOND * attacker.ap) * BURN_SECONDS,
          source: 'Blackfire Torch burn',
          tags: ['proc', 'dot'],
        }]
      : [],
};
