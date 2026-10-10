import { targetHpPct } from '../../damage';
import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon perks Precision/CoupDeGrace: EnemyHealthPercentageThreshold 0.4, BonusPercentDamage 0.08.
const THRESHOLD = 0.4;
const DAMAGE_AMP = 0.08;

/** Deal 8% more damage to champions below 40% health. */
export const coupDeGrace: Effect = {
  id: '8014',
  name: 'Coup de Grace',
  kind: 'rune',
  verifiedPatch: '16.20',
  preMitigation: (hit, { target }) => (targetHpPct(target) < THRESHOLD ? amplify(hit, DAMAGE_AMP) : hit),
};
