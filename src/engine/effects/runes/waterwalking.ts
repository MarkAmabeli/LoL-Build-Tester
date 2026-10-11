import { addAdaptiveForce, byLevel } from '../../stats';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const MOVE_SPEED = sourced('waterwalking.moveSpeed', perk('8232', 'MovementSpeed', 10));
const ADAPTIVE_L1 = sourced('waterwalking.adaptiveL1', perk('8232', 'MinAdaptive', 13));
const ADAPTIVE_L18 = sourced('waterwalking.adaptiveL18', perk('8232', 'MaxAdaptive', 30));

/** In the river, gain 10 move speed and 13–30 adaptive force by level. */
export const waterwalking: Effect = {
  id: '8232',
  name: 'Waterwalking',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'river', label: 'In the river', scope: 'setup', kind: 'toggle', default: true }],
  modifyStats: (stats, state) =>
    state.river
      ? { ...addAdaptiveForce(stats, byLevel(ADAPTIVE_L1, ADAPTIVE_L18, stats.level)), moveSpeed: stats.moveSpeed + MOVE_SPEED }
      : stats,
};
