import { targetHpPct } from '../../damage';
import { amplify } from '../amplify';
import type { Effect } from '../types';
import { item, sourced } from '../../hand';

const THRESHOLD = sourced('shadowflame.threshold', item('4645', 'HealthThreshold', 0.4));
const DAMAGE_AMP = sourced('shadowflame.amp', item('4645', 'SpellItemDamageAmp', 0.2));

/** Cinderbloom: magic and true damage deal 20% more to enemies below 40% health. */
export const shadowflame: Effect = {
  id: '4645',
  name: 'Shadowflame',
  kind: 'item',
  verifiedPatch: '16.20',
  preMitigation: (hit, { target }) =>
    hit.type !== 'physical' && targetHpPct(target) < THRESHOLD ? amplify(hit, DAMAGE_AMP) : hit,
};
