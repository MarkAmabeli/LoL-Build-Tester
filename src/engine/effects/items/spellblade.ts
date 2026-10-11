import { isRanged } from '../../stats';
import { amplify } from '../amplify';
import type { ResolvedStats } from '../../types';
import type { Cycle } from '../cycles';
import type { Effect, StateField } from '../types';
import { item, notApplied, sourced } from '../../hand';

// Spellblade: after using an ability, the next attack deals bonus damage on-hit (1.5s cooldown).
// The items share a shop limit group, so only one is ever built (see item-groups.json).
const READY: StateField = { key: 'proc', label: 'Spellblade (proc)', scope: 'combat', kind: 'toggle', default: false };
// Casting an ability arms it (10s, per the in-game description); the next attack procs.
// Every Spellblade item has the same SpellbladeCooldown.
const ARMED_SECONDS = sourced('spellblade.armedSeconds', item('3100', 'SpellBladeDuration', 10));
const COOLDOWN = sourced('spellblade.cooldown', item('3057', 'SpellbladeCooldown', 1.5));
const SPELLBLADE_CYCLE: Cycle = { kind: 'proc', field: 'proc', counts: 'cast', hits: 1, consumedBy: 'attack', armedFor: ARMED_SECONDS, cooldown: COOLDOWN };

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
    cycles: [SPELLBLADE_CYCLE],
    onHit: ({ attacker, state }) =>
      state.proc ? [{ type, raw: damage(attacker), source: name, tags: ['onhit'] }] : [],
  };
}

/** Spellblade: 100% base AD bonus physical damage. */
const SHEEN_RATIO = sourced('sheen.baseAdRatio', item('3057', 'calc:SpellbladeDamage.0.mCoefficient', 1));
export const sheen: Effect = spellblade('3057', 'Sheen', 'physical', (a) => SHEEN_RATIO * a.ad.base);

/** Spellblade: 200% base AD bonus physical damage. Quicken (move speed) isn't modeled. */
const TRINITY_RATIO = sourced('trinityForce.baseAdRatio', item('3078', 'SpellbladeMultiplier', 2));
export const trinityForce: Effect = spellblade('3078', 'Trinity Force', 'physical', (a) => TRINITY_RATIO * a.ad.base);

/** Spellblade: 150% base AD bonus physical damage. The slowing frost field isn't modeled. */
const ICEBORN_RATIO = sourced('iceborn.baseAdRatio', item('6662', 'SpellbladeMultiplier', 1.5));
export const icebornGauntlet: Effect = spellblade('6662', 'Iceborn Gauntlet', 'physical', (a) => ICEBORN_RATIO * a.ad.base);

/** Spellblade: 75% base AD + 45% AP bonus magic damage. */
const LICH_AD_RATIO = sourced('lichBane.baseAdRatio', item('3100', 'SpellbladeADRatio', 0.75));
const LICH_AP_RATIO = sourced('lichBane.apRatio', item('3100', 'LichBaneAPValue', 0.45));
notApplied('lichBane.sheenAttackSpeed', item('3100', 'SheenASBuff', 0.5), 'Not in the in-game description');
export const lichBane: Effect = spellblade('3100', 'Lich Bane', 'magic', (a) => LICH_AD_RATIO * a.ad.base + LICH_AP_RATIO * a.ap);

// The crit chance ratio applies to crit chance read as 0-1 (so +12.5 at 25% crit). The mana refund isn't modeled.
/** Spellblade: 125% base AD (+50 per 100% crit chance) bonus physical damage. */
const REAVER_AD_RATIO = sourced('essenceReaver.baseAdRatio', item('3508', 'BaseADRatio', 1.25));
const REAVER_CRIT_RATIO = sourced('essenceReaver.critChanceRatio', item('3508', 'CritChanceMultiplier', 50));
export const essenceReaver: Effect = spellblade(
  '3508', 'Essence Reaver', 'physical', (a) => REAVER_AD_RATIO * a.ad.base + REAVER_CRIT_RATIO * a.critChance,
);

/**
 * Spellblade: 75% base AD + 10% AP bonus magic damage. Applying on-hit effects an extra
 * time and the healing aren't modeled.
 */
const DUSK_AD_RATIO = sourced('duskAndDawn.baseAdRatio', item('2510', 'calc:SpellbladeDamage.0.mCoefficient', 0.75));
const DUSK_AP_RATIO = sourced('duskAndDawn.apRatio', item('2510', 'calc:SpellbladeDamage.1.mCoefficient', 0.1));
export const duskAndDawn: Effect = spellblade('2510', 'Dusk and Dawn', 'magic', (a) => DUSK_AD_RATIO * a.ad.base + DUSK_AP_RATIO * a.ap);

const BLOODSONG_RATIO = sourced('bloodsong.baseAdRatio', item('3877', 'SheenMult', 1));
const MAIM_SECONDS = sourced('bloodsong.maimSeconds', item('3877', 'DebuffDuration', 4));
const MAIM_AMP = {
  melee: sourced('bloodsong.maimAmp.melee', item('3877', 'MeleeDamageAmp', 0.08)),
  ranged: sourced('bloodsong.maimAmp.ranged', item('3877', 'RangedDamageAmp', 0.05)),
};

/**
 * Spellblade: 100% base AD bonus physical damage, and Maim: the champion takes 8%
 * (ranged 5%) more damage for 4s. Maim's siphon damage and healing aren't modeled.
 */
export const bloodsong: Effect = {
  ...spellblade('3877', 'Bloodsong', 'physical', (a) => BLOODSONG_RATIO * a.ad.base),
  state: [READY, { key: 'maim', label: 'Target Maimed', scope: 'combat', kind: 'toggle', default: false }],
  cycles: [SPELLBLADE_CYCLE, { kind: 'buff', field: 'maim', startedBy: 'proc', lasts: MAIM_SECONDS }],
  preMitigation: (hit, { attacker, state }) =>
    state.maim ? amplify(hit, isRanged(attacker) ? MAIM_AMP.ranged : MAIM_AMP.melee) : hit,
};
