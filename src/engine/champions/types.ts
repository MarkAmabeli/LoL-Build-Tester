import type { FormulaContext, TargetState } from '../damage';
import type { Cycle } from '../effects/cycles';
import type { Effect, EffectState, StateField } from '../effects/types';
import type { DamageInstance, Formula, ResolvedStats } from '../types';

export type Slot = 'P' | 'Q' | 'W' | 'E' | 'R';

/** One spell as written by the data pipeline to spells/<Champion>.json (the fields used here). */
export interface SpellRecord {
  slot?: Slot;
  maxRank: number;
  /** Per rank (index 0 = rank 1), before ability haste. Missing when the data has no usable cooldown. */
  cooldown?: number[];
  /** Per rank, in the champion's resource (champions.json `resource`). Missing when free. */
  cost?: number[];
  /** Per rank, in game units. Missing when the data only has a placeholder (self-cast, global). */
  range?: number[];
  dataValues: Record<string, number[]>;
  formulas: Record<string, Formula>;
  unsupported: Record<string, string>;
}

/** A champion's spells/<Champion>.json, keyed by spell script name. */
export type ChampionSpells = Record<string, SpellRecord>;

/** Skill ranks; 0 or missing means not learned. */
export type Ranks = Partial<Record<Slot, number>>;

export interface AbilityContext {
  attacker: ResolvedStats;
  target: TargetState;
  /** Rank of the ability's slot. */
  rank: number;
  /** The ability's own state (defaults filled in). */
  state: EffectState;
  /** How attacks in this ability crit, as for `autoAttack`. */
  crit: boolean | 'expected';
  /** A translated formula of one of the champion's spells, evaluated at this rank. */
  formula(spell: string, name: string, context?: FormulaContext): number;
  /** A raw data value of one of the champion's spells at this rank. */
  value(spell: string, name: string): number;
}

export interface AbilityDefinition {
  /** Key for `abilityHit`, e.g. "Q", or "RW" for Yunara's empowered W. */
  id: string;
  name: string;
  /** Slot whose rank the ability uses. Abilities using the R rank deal ultimate damage. */
  slot: Slot;
  /** Spell record for cooldown, cost and range; defaults to the record tagged with `slot`. */
  spell?: string;
  state?: StateField[];
  /** How the ability's 'combat' state fields change over a fight (see cycles.ts). */
  cycles?: Cycle[];
  /**
   * The hits one use deals, before items and runes. The first one triggers procs: on-hit
   * if tagged `auto`, on-ability if tagged `ability` (empowered attacks are both).
   */
  hits(ctx: AbilityContext): DamageInstance[];
}

export interface ChampionDefinition {
  /** Data Dragon ID, also the spells/<id>.json file name. */
  id: string;
  /** Patch the definition was last checked against, e.g. "16.20". Wiki sources: wiki-sources.json. */
  verifiedPatch: string;
  abilities: AbilityDefinition[];
  /** Passives and self-buffs as effects (kind 'champion'), for the learned ranks. */
  effects?(spells: ChampionSpells, ranks: Ranks): Effect[];
}
