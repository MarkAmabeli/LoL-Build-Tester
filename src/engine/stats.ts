import type { ActiveEffect } from './effects/types';
import type { ChampionBaseStats, ResolvedStats, SplitStat, StatBonuses } from './types';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 18;
export const BASE_CRIT_MULTIPLIER = 1.75;
export const ATTACK_SPEED_CAP = 2.5;
/** Champions with a longer attack range than this count as ranged (melee tops out around 250). */
export const MELEE_RANGE_MAX = 250;
/** One point of adaptive force is worth 0.6 AD or 1 AP. */
export const ADAPTIVE_AD_PER_POINT = 0.6;
export const ADAPTIVE_AP_PER_POINT = 1;

/**
 * Total growth gained by `level`, using Riot's non-linear growth curve:
 *   growth × (n − 1) × (0.7025 + 0.0175 × (n − 1))
 * At level 1 this is 0; at level 18 it is exactly growth × 17.
 */
export function growthAtLevel(growth: number, level: number): number {
  const n = clampLevel(level) - 1;
  return growth * n * (0.7025 + 0.0175 * n);
}

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
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

/** Merge any number of bonus blocks (items, runes, buffs) into one. */
export function sumBonuses(...blocks: StatBonuses[]): StatBonuses {
  const out: Record<string, number> = {};
  for (const block of blocks) {
    for (const [key, value] of Object.entries(block)) {
      if (typeof value !== 'number') continue;
      if (key === 'armorPenPct' || key === 'magicPenPct') {
        // Percent penetration from separate sources stacks multiplicatively.
        out[key] = 1 - (1 - (out[key] ?? 0)) * (1 - value);
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
export function attackSpeedAt(champ: ChampionBaseStats, level: number, bonusPct = 0): number {
  const ratio = champ.attackspeedratio ?? champ.attackspeed;
  const growthPct = growthAtLevel(champ.attackspeedperlevel, level);
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
): ResolvedStats {
  const lvl = clampLevel(level);
  const at = (base: number, growth: number) => base + growthAtLevel(growth, lvl);
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
    attackSpeed: attackSpeedAt(champ, lvl, bonuses.attackSpeedPct),
    critChance: Math.min(1, bonuses.critChance ?? 0),
    critMultiplier: BASE_CRIT_MULTIPLIER + (bonuses.critDamageBonus ?? 0),
    abilityHaste: bonuses.abilityHaste ?? 0,
    lethality: bonuses.lethality ?? 0,
    armorPenPct: bonuses.armorPenPct ?? 0,
    magicPenFlat: bonuses.magicPenFlat ?? 0,
    magicPenPct: bonuses.magicPenPct ?? 0,
    moveSpeed: (champ.movespeed + (bonuses.moveSpeed ?? 0)) * (1 + (bonuses.moveSpeedPct ?? 0)),
    attackRange: champ.attackrange,
    attackSpeedBase: champ.attackspeed,
    attackSpeedRatio: asRatio,
    bonusAttackSpeedPct: growthAtLevel(champ.attackspeedperlevel, lvl) + (bonuses.attackSpeedPct ?? 0),
    adaptiveTieBreak: champ.adaptiveType ?? 'ad',
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

/** Cooldown after ability haste: cd × 100 / (100 + AH). */
export function cooldownWithHaste(cooldown: number, abilityHaste: number): number {
  return (cooldown * 100) / (100 + abilityHaste);
}
