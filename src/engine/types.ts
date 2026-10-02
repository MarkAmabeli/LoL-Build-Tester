/** Damage types used by League of Legends. */
export type DamageType = 'physical' | 'magic' | 'true';

/**
 * Per-level champion stats, shaped like Data Dragon's `champion.json` `stats` block.
 * Growth values are applied with the non-linear level formula (see `stats.ts`).
 */
export interface ChampionBaseStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  /** Base attack speed (attacks per second at level 1). */
  attackspeed: number;
  /** Attack speed growth, as a percentage (e.g. 3 = +3% per level, before the level formula). */
  attackspeedperlevel: number;
  /**
   * Attack speed ratio: bonus AS% is multiplied by this, not by base AS.
   * Not in Data Dragon; defaults to `attackspeed` when missing, which is correct for most champions.
   */
  attackspeedratio?: number;
  movespeed: number;
  attackrange: number;
}

/** Flat stat bonuses contributed by items, runes and buffs. All optional. */
export interface StatBonuses {
  hp?: number;
  mana?: number;
  ad?: number;
  ap?: number;
  armor?: number;
  mr?: number;
  /** Bonus attack speed as a percentage (40 = +40%). */
  attackSpeedPct?: number;
  /** Crit chance, 0-1. */
  critChance?: number;
  /** Extra crit damage on top of the base 175%, as a fraction (0.4 = +40%). */
  critDamageBonus?: number;
  abilityHaste?: number;
  /** Flat armor penetration (lethality is flat armor pen in the current game). */
  lethality?: number;
  /** Percent armor penetration, 0-1. */
  armorPenPct?: number;
  magicPenFlat?: number;
  /** Percent magic penetration, 0-1. */
  magicPenPct?: number;
  moveSpeed?: number;
}

/** A stat, split into its base (level-derived) and bonus (items, runes, buffs) parts. */
export interface SplitStat {
  base: number;
  bonus: number;
  total: number;
}

/** Fully resolved stats for a champion at a given level with a given loadout. */
export interface ResolvedStats {
  level: number;
  hp: SplitStat;
  mana: SplitStat;
  ad: SplitStat;
  ap: number;
  armor: SplitStat;
  mr: SplitStat;
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  abilityHaste: number;
  lethality: number;
  armorPenPct: number;
  magicPenFlat: number;
  magicPenPct: number;
  moveSpeed: number;
}

/** Resistance reduction applied to a target (e.g. Black Cleaver shred). Applied before penetration. */
export interface ResistReduction {
  flat?: number;
  /** 0-1 */
  pct?: number;
}

/** A single hit of damage, before mitigation. */
export interface DamageInstance {
  type: DamageType;
  raw: number;
  /** Human-readable origin, e.g. "Q", "Auto attack", "Liandry's burn". */
  source: string;
  tags?: Array<'ability' | 'onhit' | 'dot' | 'crit' | 'aoe' | 'auto'>;
}

export interface MitigatedDamage extends DamageInstance {
  /** Damage after resistances. */
  final: number;
  /** Effective resistance used for the calculation (after reduction and penetration). */
  effectiveResist: number;
}
