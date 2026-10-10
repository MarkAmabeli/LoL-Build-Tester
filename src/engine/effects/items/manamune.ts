import { addBonus, isRanged } from '../../stats';
import type { Effect, HitContext } from '../types';

// CommunityDragon Items/3004 and 3042 BonusADFromMana: 0.02 × max mana.
const MANA_TO_AD = 0.02;
// Items/3042: OnHitDamage 0.012 × max mana; ability damage 0.04 (melee) / 0.03 (ranged) × max mana.
const ON_HIT_MANA_RATIO = 0.012;
const ABILITY_MANA_RATIO = { melee: 0.04, ranged: 0.03 };

const awe = (stats: Parameters<NonNullable<Effect['modifyStats']>>[0]) => ({
  ...stats,
  ad: addBonus(stats.ad, MANA_TO_AD * stats.mana.total),
});

/** Awe: bonus AD equal to 2% of max mana. Manaflow stacking isn't modeled: set mana directly. */
export const manamune: Effect = {
  id: '3004',
  name: 'Manamune',
  kind: 'item',
  verifiedPatch: '16.20',
  modifyStats: awe,
};

const shock = (source: string, ratio: (ctx: HitContext) => number) => (ctx: HitContext) => [{
  type: 'physical' as const,
  raw: ratio(ctx) * ctx.attacker.mana.total,
  source,
  tags: ['proc' as const],
}];

/**
 * Muramana (Manamune transformed): Awe as above, plus Shock: attacks deal 1.2% max
 * mana and abilities 4% (ranged 3%) max mana as bonus physical damage. The 6.5s
 * per-cast lockout isn't modeled.
 */
export const muramana: Effect = {
  id: '3042',
  name: 'Muramana',
  kind: 'item',
  verifiedPatch: '16.20',
  modifyStats: awe,
  onHit: shock('Muramana', () => ON_HIT_MANA_RATIO),
  onAbilityHit: shock('Muramana', ({ attacker }) =>
    isRanged(attacker) ? ABILITY_MANA_RATIO.ranged : ABILITY_MANA_RATIO.melee),
};
