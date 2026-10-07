import type { ActiveEffect } from './effects/types';
import type { ChampionBaseStats, ResolvedStats, SplitStat, StatBonuses } from './types';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 18;
export const BASE_CRIT_MULTIPLIER = 1.75;
export const ATTACK_SPEED_CAP = 2.5;
/** Champions with a longer attack range than this count as ranged (melee tops out around 250). */
export const MELEE_RANGE_MAX = 250;

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
  const as = champ.attackspeed + ratio * ((growthPct + bonusPct) / 100);
  return Math.min(ATTACK_SPEED_CAP, as);
}

/**
 * Resolve a champion's stats at a level with the given bonuses.
 * Effects' `modifyStats` hooks run afterwards, in order, on the summed stats
 * (e.g. Rabadon's multiplies total AP, so it must see every flat AP source first).
 */
export function resolveStats(
  champ: ChampionBaseStats,
  level: number,
  bonuses: StatBonuses = {},
  effects: ActiveEffect[] = [],
): ResolvedStats {
  const lvl = clampLevel(level);
  const at = (base: number, growth: number) => base + growthAtLevel(growth, lvl);

  const stats: ResolvedStats = {
    level: lvl,
    hp: split(at(champ.hp, champ.hpperlevel), bonuses.hp),
    mana: split(at(champ.mp, champ.mpperlevel), bonuses.mana),
    ad: split(at(champ.attackdamage, champ.attackdamageperlevel), bonuses.ad),
    ap: bonuses.ap ?? 0,
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
    moveSpeed: champ.movespeed + (bonuses.moveSpeed ?? 0),
    attackRange: champ.attackrange,
  };
  return effects.reduce(
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
