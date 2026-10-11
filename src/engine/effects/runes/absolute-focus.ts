import { addAdaptiveForce, byLevel } from '../../stats';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const HEALTH_THRESHOLD = sourced('absoluteFocus.healthThreshold', perk('8233', 'HealthPercent', 0.7));
const ADAPTIVE_L1 = sourced('absoluteFocus.adaptiveL1', perk('8233', 'MinAdaptive', 3));
const ADAPTIVE_L18 = sourced('absoluteFocus.adaptiveL18', perk('8233', 'MaxAdaptive', 30));

/** While above 70% health (the attacker's current health), gain 3–30 adaptive force by level. */
export const absoluteFocus: Effect = {
  id: '8233',
  name: 'Absolute Focus',
  kind: 'rune',
  verifiedPatch: '16.20',
  modifyStats: (stats) =>
    stats.currentHpPct > HEALTH_THRESHOLD
      ? addAdaptiveForce(stats, byLevel(ADAPTIVE_L1, ADAPTIVE_L18, stats.level))
      : stats,
};
