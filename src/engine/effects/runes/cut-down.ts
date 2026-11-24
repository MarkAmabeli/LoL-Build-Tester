import { targetHpPct } from '../../damage';
import { amplify } from '../amplify';
import type { Effect } from '../types';
import { notApplied, perk, sourced } from '../../hand';

const THRESHOLD = sourced('cutDown.threshold', perk('8017', 'EnemyHealthPercentageThreshold', 0.6));
const DAMAGE_AMP = sourced('cutDown.amp', perk('8017', 'BonusPercentDamage', 0.08));
notApplied('cutDown.minBonusDamage', perk('8017', 'MinBonusDamagePercent', 0.05), 'Old by-health-difference value; the in-game description is a flat 8%');
notApplied('cutDown.maxBonusDamage', perk('8017', 'MaxBonusDamagePercent', 0.15), 'Old by-health-difference value; the in-game description is a flat 8%');

/** Deal 8% more damage to champions above 60% health. */
export const cutDown: Effect = {
  id: '8017',
  name: 'Cut Down',
  kind: 'rune',
  verifiedPatch: '16.20',
  preMitigation: (hit, { target }) => (targetHpPct(target) > THRESHOLD ? amplify(hit, DAMAGE_AMP) : hit),
};
