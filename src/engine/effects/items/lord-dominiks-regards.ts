import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon Items/3036: MaxBonusDamagePercent 0.15, MaxBonusHealth 1500.
const MAX_AMP = 0.15;
const MAX_BONUS_HP = 1500;

/**
 * Giant Slayer: up to 15% more damage against champions by their bonus health, maxed at 1500.
 * Assumes it rises linearly; the data only gives the cap.
 */
export const lordDominiksRegards: Effect = {
  id: '3036',
  name: "Lord Dominik's Regards",
  kind: 'item',
  verifiedPatch: '16.20',
  preMitigation: (hit, { target }) => {
    const amp = MAX_AMP * Math.min(1, Math.max(0, target.stats.hp.bonus) / MAX_BONUS_HP);
    return amp > 0 ? amplify(hit, amp) : hit;
  },
};
