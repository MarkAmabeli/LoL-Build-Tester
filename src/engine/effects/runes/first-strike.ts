import { amplify } from '../amplify';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const DAMAGE_AMP = sourced('firstStrike.amp', perk('8369', 'DamageAmp', 0.07));
const DURATION = sourced('firstStrike.duration', perk('8369', 'Duration', 3));
const COOLDOWN_L1 = sourced('firstStrike.cooldownL1', perk('8369', 'TooltipOnlyCooldownStartAmount', 25));
const COOLDOWN_L18 = sourced('firstStrike.cooldownL18', perk('8369', 'TooltipOnlyCooldownEndAmount', 15));

/**
 * While active, deal 7% extra damage to champions. The game shows the extra as a
 * separate number, but amplifying raw damage gives the same total after mitigation.
 * Gold generation isn't modeled.
 */
export const firstStrike: Effect = {
  id: '8369',
  name: 'First Strike',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'active', label: 'First Strike active', scope: 'combat', kind: 'toggle', default: true }],
  // It also needs time out of combat (OOCTimer) to trigger again, which isn't modeled.
  cycles: [{ kind: 'proc', field: 'active', counts: 'hit', hits: 1, lasts: DURATION, cooldown: { from: COOLDOWN_L1, to: COOLDOWN_L18 } }],
  preMitigation: (hit, { state }) => (state.active ? amplify(hit, DAMAGE_AMP) : hit),
};
