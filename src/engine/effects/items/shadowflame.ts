import { targetHpPct } from '../../damage';
import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon Items/4645: HealthThreshold 0.4, SpellItemDamageAmp 0.2, DamageOverTimeAmp 0.2.
const THRESHOLD = 0.4;
const DAMAGE_AMP = 0.2;

/** Cinderbloom: magic and true damage deal 20% more to enemies below 40% health. */
export const shadowflame: Effect = {
  id: '4645',
  name: 'Shadowflame',
  kind: 'item',
  verifiedPatch: '16.20',
  preMitigation: (hit, { target }) =>
    hit.type !== 'physical' && targetHpPct(target) < THRESHOLD ? amplify(hit, DAMAGE_AMP) : hit,
};
