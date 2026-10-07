import type { TargetState } from '../damage';
import type { DamageInstance, ResistReduction, ResolvedStats } from '../types';

/**
 * Per-effect state the static calculator can't derive on its own: stack counts,
 * "is this the empowered attack", souls collected and so on. For now the user sets
 * it; the combo simulator (ROADMAP step 5) will drive the same fields hit by hit.
 */
export type EffectState = Record<string, number | boolean>;

/** Describes one user-settable state field, so the UI can render an input for it. */
export type StateField =
  | { key: string; label: string; kind: 'number'; default: number; min: number; max: number }
  | { key: string; label: string; kind: 'toggle'; default: boolean };

export interface HitContext {
  attacker: ResolvedStats;
  target: TargetState;
  /** This effect's own state (defaults filled in). */
  state: EffectState;
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
  /** Riot item or rune ID, matching `items.json` / `runes.json`. */
  id: string;
  name: string;
  kind: 'item' | 'rune';
  /** Patch the numbers were last checked against, e.g. "16.20". */
  verifiedPatch: string;
  state?: StateField[];
  /**
   * When `modifyStats` runs: 'add' (default) for flat additions, 'multiply' for
   * percent-of-total effects, which must see every addition first.
   */
  statPhase?: 'add' | 'multiply';

  /** Runs on fully summed stats; returns the changed stats. */
  modifyStats?(stats: ResolvedStats, state: EffectState): ResolvedStats;
  /** Extra damage when an auto attack hits. */
  onHit?(ctx: HitContext): DamageInstance[];
  /** Extra damage when an ability hits. */
  onAbilityHit?(ctx: HitContext): DamageInstance[];
  /** Adjusts a hit's raw damage before resistances (damage amps). */
  preMitigation?(hit: DamageInstance, ctx: HitContext): DamageInstance;
  /** Armor/MR reduction this effect has applied to the target. */
  targetResist?(ctx: HitContext): TargetResistChange;
}

/** An effect in a loadout, with its state resolved. */
export interface ActiveEffect {
  effect: Effect;
  state: EffectState;
}
