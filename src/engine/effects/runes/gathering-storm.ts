import { addAdaptiveForce } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Sorcery/GatheringStorm: UpdateAfterMinutes 10, AdaptiveAP 8.
// The bin's AdaptiveAD (6) doesn't match the in-game table (5/14/29/48 AD), which
// is 8 adaptive force × 0.6 per step, so adaptive force is used for both.
const INTERVAL_MINUTES = 10;
const ADAPTIVE_PER_STEP = 8;

/** Adaptive force after `minutes`: 8 × (1 + 2 + … + n) for n completed 10-minute steps. */
export function gatheringStormForce(minutes: number): number {
  const n = Math.floor(Math.max(0, minutes) / INTERVAL_MINUTES);
  return (ADAPTIVE_PER_STEP * n * (n + 1)) / 2;
}

/** Every 10 minutes, gain increasing adaptive force (8, 24, 48, 80… AP). */
export const gatheringStorm: Effect = {
  id: '8236',
  name: 'Gathering Storm',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'minutes', label: 'Game time (minutes)', scope: 'setup', kind: 'number', default: 0, min: 0, max: 90 }],
  modifyStats: (stats, state) => addAdaptiveForce(stats, gatheringStormForce(Number(state.minutes))),
};
