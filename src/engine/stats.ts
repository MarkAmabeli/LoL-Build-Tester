import type { ActiveEffect } from './effects/types';
import { assumed, champion, hand, sourced, wiki } from './hand';
import type { ChampionBaseStats, ResolvedStats, SplitStat, StatBonuses } from './types';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = hand('engine.maxLevel', 18, assumed('The standard champion level cap'));
/** Crits deal 200% (it was 175% from V10.23 until V26.01); every champion bin checked has 2. */
export const BASE_CRIT_MULTIPLIER = sourced('engine.critMultiplier', champion('Vayne', 'critDamageMultiplier', 2));
/** One attack per 0.333s. */
export const ATTACK_SPEED_CAP = hand('engine.attackSpeedCap', 1 / 0.333, wiki('Attack speed', 'precisely 1/0.333'));
/** Champions with a longer attack range than this count as ranged (melee tops out around 250). */
export const MELEE_RANGE_MAX = hand('engine.meleeRangeMax', 250, assumed('Melee ranges top out around 250; ranged start at 300+'));
/** One point of adaptive force is worth 0.6 AD or 1 AP. */
export const ADAPTIVE_AD_PER_POINT = hand('engine.adaptiveAd', 0.6, wiki('Adaptive force', '1 point of Adaptive Force provides 0.6 bonus AD or 1 AP'));
export const ADAPTIVE_AP_PER_POINT = hand('engine.adaptiveAp', 1, wiki('Adaptive force', '1 point of Adaptive Force provides 0.6 bonus AD or 1 AP'));
const GROWTH_BASE = hand('engine.growthBase', 0.7025, wiki('Champion statistic', 'g × (n − 1) × (0.7025 + 0.0175 × (n − 1))'));
const GROWTH_PER_LEVEL = hand('engine.growthPerLevel', 0.0175, wiki('Champion statistic', 'g × (n − 1) × (0.7025 + 0.0175 × (n − 1))'));

/**
 * Total growth gained by `level`, using Riot's non-linear growth curve:
 *   growth × (n − 1) × (0.7025 + 0.0175 × (n − 1))
 * At level 1 this is 0; at level 18 it is exactly growth × 17. Growth continues past 18
 * when the level cap is raised (top lane role quest).
 */
export function growthAtLevel(growth: number, level: number, cap = MAX_LEVEL): number {
  const n = clampLevel(level, cap) - 1;
  return growth * n * (GROWTH_BASE + GROWTH_PER_LEVEL * n);
}

export function clampLevel(level: number, cap = MAX_LEVEL): number {
  return Math.min(cap, Math.max(MIN_LEVEL, Math.round(level)));
}

/**
 * A value that grows linearly from `start` at level 1 to `end` at level 18
 * (Riot's ByCharLevelInterpolation, used by runes and shards).
 */
export function byLevel(start: number, end: number, level: number): number {
  return start + ((end - start) * (clampLevel(level) - MIN_LEVEL)) / (MAX_LEVEL - MIN_LEVEL);
}

function split(base: number, bonus = 0): SplitStat {
  return { base, bonus, total: base + bonus };
}

/** Combine two percentages (0-1) that stack multiplicatively, like percent penetration. */
export function stackPct(a: number, b: number): number {
  return 1 - (1 - a) * (1 - b);
}

/** Merge any number of bonus blocks (items, runes, buffs) into one. */
export function sumBonuses(...blocks: StatBonuses[]): StatBonuses {
  const out: Record<string, number> = {};
  for (const block of blocks) {
    for (const [key, value] of Object.entries(block)) {
      if (typeof value !== 'number') continue;
      if (key === 'armorPenPct' || key === 'magicPenPct') {
        out[key] = stackPct(out[key] ?? 0, value);
      } else {
        out[key] = (out[key] ?? 0) + value;
      }
    }
  }
  return out as StatBonuses;
}

/**
 * Attack speed = base AS + ratio × (level growth% + bonus AS%) / 100, capped.
 * Level growth uses the same curve as other stats.
 */
export function attackSpeedAt(champ: ChampionBaseStats, level: number, bonusPct = 0, cap = MAX_LEVEL): number {
  const ratio = champ.attackspeedratio ?? champ.attackspeed;
  const growthPct = growthAtLevel(champ.attackspeedperlevel, level, cap);
  return cappedAttackSpeed(champ.attackspeed, ratio, growthPct + bonusPct);
}

function cappedAttackSpeed(base: number, ratio: number, bonusPct: number): number {
  return Math.min(ATTACK_SPEED_CAP, base + ratio * (bonusPct / 100));
}

/** Add bonus attack speed % to resolved stats (for effects), recomputing attack speed. */
export function addBonusAttackSpeed(stats: ResolvedStats, pct: number): ResolvedStats {
  const bonusAttackSpeedPct = stats.bonusAttackSpeedPct + pct;
  return {
    ...stats,
    bonusAttackSpeedPct,
    attackSpeed: cappedAttackSpeed(stats.attackSpeedBase, stats.attackSpeedRatio, bonusAttackSpeedPct),
  };
}

/** A split stat with `amount` more bonus (for effects). */
export function addBonus(stat: SplitStat, amount: number): SplitStat {
  return split(stat.base, stat.bonus + amount);
}

/**
 * Convert adaptive force into AD or AP: whichever bonus is higher wins,
 * and `tieBreak` decides when they're equal.
 */
export function adaptiveSplit(
  amount: number,
  bonusAd: number,
  bonusAp: number,
  tieBreak: 'ad' | 'ap' = 'ad',
): { ad: number; ap: number } {
  const useAp = bonusAp > bonusAd || (bonusAp === bonusAd && tieBreak === 'ap');
  return useAp
    ? { ad: 0, ap: amount * ADAPTIVE_AP_PER_POINT }
    : { ad: amount * ADAPTIVE_AD_PER_POINT, ap: 0 };
}

/** Add adaptive force to resolved stats (for effects like Conqueror), based on current bonus AD/AP. */
export function addAdaptiveForce(stats: ResolvedStats, amount: number): ResolvedStats {
  const { ad, ap } = adaptiveSplit(amount, stats.ad.bonus, stats.ap, stats.adaptiveTieBreak);
  return { ...stats, ad: split(stats.ad.base, stats.ad.bonus + ad), ap: stats.ap + ap };
}

/** Damage type of "adaptive damage": magic if bonus AP is higher than bonus AD, else physical. */
export function adaptiveDamageType(stats: ResolvedStats): 'physical' | 'magic' {
  const { ap } = adaptiveSplit(1, stats.ad.bonus, stats.ap, stats.adaptiveTieBreak);
  return ap > 0 ? 'magic' : 'physical';
}

/**
 * Resolve a champion's stats at a level with the given bonuses.
 * Adaptive force is converted first, using the flat bonus AD and AP.
 * Effects' `modifyStats` hooks run afterwards on the summed stats: every 'add'
 * effect (e.g. Conqueror) before every 'multiply' effect (e.g. Rabadon's), each
 * group in list order.
 */
export function resolveStats(
  champ: ChampionBaseStats,
  level: number,
  bonuses: StatBonuses = {},
  effects: ActiveEffect[] = [],
  situation: { currentHpPct?: number; levelCap?: number } = {},
): ResolvedStats {
  // Stats grow up to the level cap (20 with the top lane role quest). Level-scaled effect
  // values (`byLevel`, spell formulas) stay at their level 18 value.
  const cap = situation.levelCap ?? MAX_LEVEL;
  const lvl = clampLevel(level, cap);
  const at = (base: number, growth: number) => base + growthAtLevel(growth, lvl, cap);
  const asRatio = champ.attackspeedratio ?? champ.attackspeed;
  const adaptive = adaptiveSplit(
    bonuses.adaptiveForce ?? 0,
    bonuses.ad ?? 0,
    bonuses.ap ?? 0,
    champ.adaptiveType,
  );

  const stats: ResolvedStats = {
    level: lvl,
    hp: split(at(champ.hp, champ.hpperlevel), bonuses.hp),
    mana: split(at(champ.mp, champ.mpperlevel), bonuses.mana),
    ad: split(at(champ.attackdamage, champ.attackdamageperlevel), (bonuses.ad ?? 0) + adaptive.ad),
    ap: (bonuses.ap ?? 0) + adaptive.ap,
    armor: split(at(champ.armor, champ.armorperlevel), bonuses.armor),
    mr: split(at(champ.spellblock, champ.spellblockperlevel), bonuses.mr),
    attackSpeed: attackSpeedAt(champ, lvl, bonuses.attackSpeedPct, cap),
    critChance: Math.min(1, bonuses.critChance ?? 0),
    critMultiplier: BASE_CRIT_MULTIPLIER + (bonuses.critDamageBonus ?? 0),
    abilityHaste: bonuses.abilityHaste ?? 0,
    basicHaste: bonuses.basicHaste ?? 0,
    ultimateHaste: bonuses.ultimateHaste ?? 0,
    lethality: bonuses.lethality ?? 0,
    armorPenPct: bonuses.armorPenPct ?? 0,
    magicPenFlat: bonuses.magicPenFlat ?? 0,
    magicPenPct: bonuses.magicPenPct ?? 0,
    moveSpeed: (champ.movespeed + (bonuses.moveSpeed ?? 0)) * (1 + (bonuses.moveSpeedPct ?? 0)),
    attackRange: champ.attackrange,
    attackSpeedBase: champ.attackspeed,
    attackSpeedRatio: asRatio,
    bonusAttackSpeedPct: growthAtLevel(champ.attackspeedperlevel, lvl, cap) + (bonuses.attackSpeedPct ?? 0),
    adaptiveTieBreak: champ.adaptiveType ?? 'ad',
    currentHpPct: Math.min(1, Math.max(0, situation.currentHpPct ?? 1)),
  };
  const ordered = [
    ...effects.filter((a) => (a.effect.statPhase ?? 'add') === 'add'),
    ...effects.filter((a) => a.effect.statPhase === 'multiply'),
  ];
  return ordered.reduce(
    (s, { effect, state }) => effect.modifyStats?.(s, state) ?? s,
    stats,
  );
}

export function isRanged(stats: ResolvedStats): boolean {
  return stats.attackRange > MELEE_RANGE_MAX;
}

/** Total ability haste for a slot: ability haste plus that slot's own basic or ultimate haste. */
export function hasteFor(stats: ResolvedStats, slot: 'basic' | 'ultimate'): number {
  return stats.abilityHaste + (slot === 'ultimate' ? stats.ultimateHaste : stats.basicHaste);
}

/** Cooldown after ability haste: cd × 100 / (100 + AH). */
export function cooldownWithHaste(cooldown: number, abilityHaste: number): number {
  return (cooldown * 100) / (100 + abilityHaste);
}
