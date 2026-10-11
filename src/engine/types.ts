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
  /**
   * Which stat adaptive force grants when bonus AD and AP are tied (e.g. both 0).
   * Not in Data Dragon; defaults to 'ad'.
   */
  adaptiveType?: 'ad' | 'ap';
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
  /** Extra crit damage on top of the base 200%, as a fraction (0.3 = +30%, e.g. Infinity Edge). */
  critDamageBonus?: number;
  abilityHaste?: number;
  /** Ability haste for basic abilities only, on top of `abilityHaste` (e.g. Legend: Haste). */
  basicHaste?: number;
  /** Ability haste for the ultimate only, on top of `abilityHaste` (e.g. Malignance). */
  ultimateHaste?: number;
  /** Flat armor penetration (lethality is flat armor pen in the current game). */
  lethality?: number;
  /** Percent armor penetration, 0-1. */
  armorPenPct?: number;
  magicPenFlat?: number;
  /** Percent magic penetration, 0-1. */
  magicPenPct?: number;
  moveSpeed?: number;
  /** Percent move speed, as a fraction (0.025 = +2.5%). */
  moveSpeedPct?: number;
  /** Adaptive force: becomes AD or AP depending on which bonus is higher (see `adaptiveSplit`). */
  adaptiveForce?: number;
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
  /** Extra haste for basic abilities only; see `hasteFor`. */
  basicHaste: number;
  /** Extra haste for the ultimate only; see `hasteFor`. */
  ultimateHaste: number;
  lethality: number;
  armorPenPct: number;
  magicPenFlat: number;
  magicPenPct: number;
  moveSpeed: number;
  attackRange: number;
  /** Base attack speed and ratio, kept so effects can add bonus attack speed later. */
  attackSpeedBase: number;
  attackSpeedRatio: number;
  /** Bonus attack speed %, including level growth (as the game counts it). */
  bonusAttackSpeedPct: number;
  /** The champion's adaptive tie-break (see `ChampionBaseStats.adaptiveType`). */
  adaptiveTieBreak: 'ad' | 'ap';
  /** Current health as a fraction of max (1 = full), for effects like Last Stand. */
  currentHpPct: number;
}

/** A stat an ability can scale with. Target-based stats read from the target. */
export type ScalingStat =
  | 'totalAD'
  | 'bonusAD'
  | 'baseAD'
  | 'AP'
  | 'maxHP'
  | 'baseHP'
  | 'bonusHP'
  | 'totalArmor'
  | 'bonusArmor'
  | 'totalMR'
  | 'bonusMR'
  | 'maxMana'
  | 'bonusMana'
  | 'attackSpeed'
  /** Bonus attack speed as a fraction (0.4 = +40%). */
  | 'bonusAttackSpeed'
  | 'critChance'
  | 'lethality'
  | 'moveSpeed'
  /** A stack count the caller supplies (e.g. Nasus's Siphoning Strike stacks). */
  | 'stacks'
  | 'targetMaxHP'
  | 'targetBonusHP'
  | 'targetCurrentHP'
  | 'targetMissingHP';

export interface Ratio {
  stat: ScalingStat;
  /** Ratio value as a fraction (0.6 = 60%). Either one value or one per rank. */
  value: number | number[];
  /** Ratio by champion level (index 0 = level 1); used instead of `value` when set. */
  valueByLevel?: number[];
}

/**
 * A damage (or other) formula: base per rank, plus an optional base by level, plus ratios.
 * The data pipeline translates CommunityDragon SpellCalculations into this shape.
 */
export interface Formula {
  /** Base value per rank. A single value applies to all ranks. */
  base: number | number[];
  /** Added to `base`, by champion level (index 0 = level 1). */
  baseByLevel?: number[];
  ratios?: Ratio[];
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
  tags?: Array<'ability' | 'ultimate' | 'onhit' | 'dot' | 'crit' | 'aoe' | 'auto' | 'proc' | 'summoner'>;
}

export interface MitigatedDamage extends DamageInstance {
  /** Damage after resistances. */
  final: number;
  /** Effective resistance used for the calculation (after reduction and penetration). */
  effectiveResist: number;
}

/** A stat that grows linearly from `from` at level 1 to `to` at level 18 (e.g. the 10–180 health shard). */
export interface LevelScaledStat {
  stat: keyof StatBonuses;
  from: number;
  to: number;
}

/** One stat shard, as written by the data pipeline to `shards.json`. */
export interface StatShard {
  id: number;
  name: string;
  /** Description text with markup removed, e.g. "+9 Adaptive Force". */
  description: string;
  icon: string;
  /** Flat bonuses. */
  stats: StatBonuses;
  scaling?: LevelScaledStat[];
  /** Effects the engine doesn't model (e.g. tenacity), kept for display. */
  unmodeled?: string[];
}

export interface ShardRow {
  label: string;
  /** Shard IDs selectable in this row. */
  options: number[];
}

/** `shards.json` */
export interface ShardData {
  rows: ShardRow[];
  shards: Record<number, StatShard>;
}

/** A shop limit: a build may hold at most `max` items from `items` (`item-groups.json`). */
export interface ItemLimitGroup {
  /** CommunityDragon bin key of the group. */
  id: string;
  /** Readable name, e.g. "Spellblade", "LastWhisper", or the item's name for one-copy groups. */
  name: string;
  max: number;
  /** Item IDs in the group. */
  items: string[];
}
