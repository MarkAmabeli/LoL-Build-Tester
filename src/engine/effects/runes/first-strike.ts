import { amplify } from '../amplify';
import type { Effect } from '../types';

// CommunityDragon perks Inspiration/FirstStrike: DamageAmp 0.07.
const DAMAGE_AMP = 0.07;

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
  // Duration 3; cooldown 25–15 by level (TooltipOnlyCooldownStart/EndAmount). It also needs 10s out
  // of combat (OOCTimer) to trigger again, which isn't modeled.
  cycles: [{ kind: 'proc', field: 'active', counts: 'hit', hits: 1, lasts: 3, cooldown: { from: 25, to: 15 } }],
  preMitigation: (hit, { state }) => (state.active ? amplify(hit, DAMAGE_AMP) : hit),
};
