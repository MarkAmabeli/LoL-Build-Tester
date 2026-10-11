import { amplify } from '../amplify';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

// The perk's bin entry is Sorcery/NullifyingOrb, reused for Axiom Arcanist.
const DAMAGE_AMP = sourced('axiomArcanist.amp', perk('8224', 'DamageAmp', 0.12));
const AOE_AMP = sourced('axiomArcanist.aoeAmp', perk('8224', 'AOEAmp', 0.08));

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
