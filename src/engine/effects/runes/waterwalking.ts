import { addAdaptiveForce, byLevel } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Sorcery/Waterwalking: MovementSpeed 10, MinAdaptive 13, MaxAdaptive 30 (by level).
const MOVE_SPEED = 10;
const ADAPTIVE_L1 = 13;
const ADAPTIVE_L18 = 30;

/** In the river, gain 10 move speed and 13–30 adaptive force by level. */
export const waterwalking: Effect = {
  id: '8232',
  name: 'Waterwalking',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'river', label: 'In the river', kind: 'toggle', default: true }],
  modifyStats: (stats, state) =>
    state.river
      ? { ...addAdaptiveForce(stats, byLevel(ADAPTIVE_L1, ADAPTIVE_L18, stats.level)), moveSpeed: stats.moveSpeed + MOVE_SPEED }
      : stats,
};
