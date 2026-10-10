import { isRanged } from '../../stats';
import { amplify } from '../amplify';
import type { ResolvedStats } from '../../types';
import type { Effect, StateField } from '../types';

// Spellblade: after using an ability, the next attack deals bonus damage on-hit (1.5s cooldown).
// The items share a shop limit group, so only one is ever built (see item-groups.json).
const READY: StateField = { key: 'proc', label: 'Spellblade ready (proc)', kind: 'toggle', default: true };

function spellblade(
  id: string,
  name: string,
  type: 'physical' | 'magic',
  damage: (attacker: ResolvedStats) => number,
): Effect {
  return {
    id,
    name,
    kind: 'item',
    verifiedPatch: '16.20',
    state: [READY],
    onHit: ({ attacker, state }) =>
      state.proc ? [{ type, raw: damage(attacker), source: name, tags: ['onhit'] }] : [],
  };
}

// CommunityDragon Items/3057 SpellbladeDamage: 1.0 × base AD.
/** Spellblade: 100% base AD bonus physical damage. */
export const sheen: Effect = spellblade('3057', 'Sheen', 'physical', (a) => a.ad.base);

// Items/3078: SpellbladeMultiplier 2.0 × base AD.
/** Spellblade: 200% base AD bonus physical damage. Quicken (move speed) isn't modeled. */
export const trinityForce: Effect = spellblade('3078', 'Trinity Force', 'physical', (a) => 2 * a.ad.base);

// Items/6662: SpellbladeMultiplier 1.5 × base AD.
/** Spellblade: 150% base AD bonus physical damage. The slowing frost field isn't modeled. */
export const icebornGauntlet: Effect = spellblade('6662', 'Iceborn Gauntlet', 'physical', (a) => 1.5 * a.ad.base);

// Items/3100: SpellbladeADRatio 0.75 × base AD + LichBaneAPValue 0.45 × AP. (SheenASBuff 0.5
// isn't in the in-game description and isn't applied.)
/** Spellblade: 75% base AD + 45% AP bonus magic damage. */
export const lichBane: Effect = spellblade('3100', 'Lich Bane', 'magic', (a) => 0.75 * a.ad.base + 0.45 * a.ap);

// Items/3508: BaseADRatio 1.25 × base AD + CritChanceMultiplier 50 × crit chance (read as 0-1,
// so +12.5 at 25% crit). The mana refund isn't modeled.
/** Spellblade: 125% base AD (+50 per 100% crit chance) bonus physical damage. */
export const essenceReaver: Effect = spellblade(
  '3508', 'Essence Reaver', 'physical', (a) => 1.25 * a.ad.base + 50 * a.critChance,
);

// Items/2510: 0.75 × base AD + 0.1 × AP.
/**
 * Spellblade: 75% base AD + 10% AP bonus magic damage. Applying on-hit effects an extra
 * time and the healing aren't modeled.
 */
export const duskAndDawn: Effect = spellblade('2510', 'Dusk and Dawn', 'magic', (a) => 0.75 * a.ad.base + 0.1 * a.ap);

// Items/3877: SheenMult 1.0 × base AD; MeleeDamageAmp 0.08, RangedDamageAmp 0.05, DebuffDuration 4.
const MAIM_AMP = { melee: 0.08, ranged: 0.05 };

/**
 * Spellblade: 100% base AD bonus physical damage, and Maim: the champion takes 8%
 * (ranged 5%) more damage for 4s. Maim's siphon damage and healing aren't modeled.
 */
export const bloodsong: Effect = {
  ...spellblade('3877', 'Bloodsong', 'physical', (a) => a.ad.base),
  state: [READY, { key: 'maim', label: 'Target Maimed', kind: 'toggle', default: true }],
  preMitigation: (hit, { attacker, state }) =>
    state.maim ? amplify(hit, isRanged(attacker) ? MAIM_AMP.ranged : MAIM_AMP.melee) : hit,
};
