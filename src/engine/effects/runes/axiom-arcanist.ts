import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon perks Sorcery/NullifyingOrb (reused for Axiom Arcanist): DamageAmp 0.12, AOEAmp 0.08.
const DAMAGE_AMP = 0.12;
const AOE_AMP = 0.08;

/** Ultimate damage is increased by 12%, or 8% for area-of-effect damage. The takedown cooldown refund isn't modeled. */
export const axiomArcanist: Effect = {
  id: '8224',
  name: 'Axiom Arcanist',
  kind: 'rune',
  verifiedPatch: '16.20',
  preMitigation: (hit) => {
    if (!hit.tags?.includes('ultimate')) return hit;
    return amplify(hit, hit.tags.includes('aoe') ? AOE_AMP : DAMAGE_AMP);
  },
};
