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
  state: [{ key: 'active', label: 'First Strike active', kind: 'toggle', default: true }],
  preMitigation: (hit, { state }) => (state.active ? { ...hit, raw: hit.raw * (1 + DAMAGE_AMP) } : hit),
};
