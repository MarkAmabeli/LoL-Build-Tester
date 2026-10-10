import { targetHpPct } from '../../damage';
import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon perks Precision/CutDown: EnemyHealthPercentageThreshold 0.6, BonusPercentDamage 0.08.
// The bin also still carries the old 5–15% by-health-difference values; the
// in-game description matches the flat 8%, so those are ignored.
const THRESHOLD = 0.6;
const DAMAGE_AMP = 0.08;

/** Deal 8% more damage to champions above 60% health. */
export const cutDown: Effect = {
  id: '8017',
  name: 'Cut Down',
  kind: 'rune',
  verifiedPatch: '16.20',
  preMitigation: (hit, { target }) => (targetHpPct(target) > THRESHOLD ? amplify(hit, DAMAGE_AMP) : hit),
};
