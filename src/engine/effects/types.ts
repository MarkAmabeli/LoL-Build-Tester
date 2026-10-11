import type { TargetState } from '../damage';
import type { DamageInstance, ResistReduction, ResolvedStats } from '../types';
import type { Cycle } from './cycles';

/**
 * Per-effect state the static calculator can't derive on its own: stack counts,
 * "is this the empowered attack", souls collected and so on. Each field has a scope
 * (see `StateScope`): 'combat' fields start at their start-of-combat value and are
 * driven by the effect's cycles (cycles.ts), which the combo simulator (ROADMAP
 * section 5) will run hit by hit; the user can still override any field.
 */
export type EffectState = Record<string, number | boolean>;

/**
 * Who sets a state field:
 *   - 'setup': the user, before the fight (Legend stacks, souls, game time, in the river).
 *   - 'combat': a cycle (see cycles.ts); the default is the value at the start of combat.
 *   - 'action': the combo's own actions or parameters (own buffs like Final Hour while
 *     active, seconds the target stays in a zone).
 */
export type StateScope = 'setup' | 'combat' | 'action';

/** Describes one user-settable state field, so the UI can render an input for it. */
export type StateField =
  | { key: string; label: string; scope: StateScope; kind: 'number'; default: number; min: number; max: number }
  | { key: string; label: string; scope: StateScope; kind: 'toggle'; default: boolean };

export interface HitContext {
  attacker: ResolvedStats;
  target: TargetState;
  /** This effect's own state (defaults filled in). */
  state: EffectState;
  /** The attack or ability that triggered `onHit` / `onAbilityHit` (unset in other hooks). */
  hit?: DamageInstance;
}

/** Shred an effect applies to the target, combined with any other reductions. */
export interface TargetResistChange {
  armor?: ResistReduction;
  mr?: ResistReduction;
}

/**
 * An item passive or rune. Every hook is optional and pure; an effect implements
 * only the ones it needs. Numbers are hand-entered from CommunityDragon item/perk
 * data and re-checked each patch (see `verifiedPatch`).
 */
export interface Effect {
  /** Riot item or rune ID, matching `items.json` / `runes.json`; "<Champion>:<ability>" for champion effects. */
  id: string;
  name: string;
  kind: 'item' | 'rune' | 'champion' | 'roleQuest';
  /** Patch the numbers were last checked against, e.g. "16.20". */
  verifiedPatch: string;
  state?: StateField[];
  /** How the 'combat' state fields change over a fight (see cycles.ts). */
  cycles?: Cycle[];
  /**
   * When `modifyStats` runs: 'add' (default) for flat additions, 'multiply' for
   * percent-of-total effects, which must see every addition first.
   */
  statPhase?: 'add' | 'multiply';

  /** Runs on fully summed stats; returns the changed stats. */
  modifyStats?(stats: ResolvedStats, state: EffectState): ResolvedStats;
  /**
   * Changes the attack or ability itself before procs run (e.g. Sundered Sky's guaranteed
   * crit). Only the triggering hit goes through this, not procs.
   */
  modifyHit?(hit: DamageInstance, ctx: HitContext): DamageInstance;
  /** Extra damage when an auto attack hits. */
  onHit?(ctx: HitContext): DamageInstance[];
  /** Extra damage when an ability hits. */
  onAbilityHit?(ctx: HitContext): DamageInstance[];
  /** Adjusts a hit's raw damage before resistances (damage amps). */
  preMitigation?(hit: DamageInstance, ctx: HitContext): DamageInstance;
  /** Armor/MR reduction this effect has applied to the target. */
  targetResist?(ctx: HitContext): TargetResistChange;
  /** Health fraction (0.05 = 5%) below which a hit's damage executes the target (e.g. The Collector). */
  executeThreshold?(ctx: HitContext): number;
}

/** An effect in a loadout, with its state resolved. */
export interface ActiveEffect {
  effect: Effect;
  state: EffectState;
}
