import type { TargetState } from './damage';
import type { ActiveEffect, HitContext } from './effects/types';
import { mitigate } from './mitigation';
import type { DamageInstance, MitigatedDamage, ResistReduction, ResolvedStats } from './types';

export interface HitInput {
  /** Attacker stats, already resolved with the same effects (so `modifyStats` has run). */
  attacker: ResolvedStats;
  target: TargetState;
  /** The attacker's item/rune effects. */
  effects?: ActiveEffect[];
  /** Reductions from outside the effect list (e.g. an ability's own shred). */
  armorReduction?: ResistReduction;
  mrReduction?: ResistReduction;
  targetDamageReduction?: number;
}

export interface HitResult {
  /** The hit itself first, then any on-hit/on-ability procs it triggered. */
  hits: MitigatedDamage[];
  total: number;
}

/** Combine reductions: flat adds, percent stacks multiplicatively (like % penetration). */
export function combineReductions(...rs: Array<ResistReduction | undefined>): ResistReduction {
  let flat = 0;
  let keep = 1;
  for (const r of rs) {
    flat += r?.flat ?? 0;
    keep *= 1 - (r?.pct ?? 0);
  }
  return { flat, pct: 1 - keep };
}

/**
 * Resolve one hit through the effect pipeline:
 *   1. procs: `onHit` for auto attacks, `onAbilityHit` for abilities (procs don't proc again)
 *   2. `preMitigation` on every instance
 *   3. resistances, with shred from every effect's `targetResist`
 */
export function computeHit(hit: DamageInstance, input: HitInput): HitResult {
  const effects = input.effects ?? [];
  const ctx = (a: ActiveEffect): HitContext => ({ attacker: input.attacker, target: input.target, state: a.state });

  const isAuto = hit.tags?.includes('auto') ?? false;
  const isAbility = hit.tags?.includes('ability') ?? false;
  const procs = effects.flatMap((a) => [
    ...(isAuto ? a.effect.onHit?.(ctx(a)) ?? [] : []),
    ...(isAbility ? a.effect.onAbilityHit?.(ctx(a)) ?? [] : []),
  ]);

  const shred = effects.map((a) => a.effect.targetResist?.(ctx(a)) ?? {});
  const armorReduction = combineReductions(input.armorReduction, ...shred.map((s) => s.armor));
  const mrReduction = combineReductions(input.mrReduction, ...shred.map((s) => s.mr));

  const hits = [hit, ...procs].map((instance) => {
    const amped = effects.reduce(
      (h, a) => a.effect.preMitigation?.(h, ctx(a)) ?? h,
      instance,
    );
    return mitigate(amped, {
      attacker: input.attacker,
      target: input.target.stats,
      armorReduction,
      mrReduction,
      targetDamageReduction: input.targetDamageReduction,
    });
  });

  return { hits, total: hits.reduce((sum, h) => sum + h.final, 0) };
}
