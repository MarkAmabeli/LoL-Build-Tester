import type {
  DamageInstance,
  MitigatedDamage,
  ResistReduction,
  ResolvedStats,
} from './types';

/**
 * Damage multiplier for a given (effective) resistance.
 *   R ≥ 0: 100 / (100 + R)
 *   R < 0: 2 − 100 / (100 − R)
 */
export function resistMultiplier(resist: number): number {
  return resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist);
}

export interface Penetration {
  flat?: number;
  /** 0-1 */
  pct?: number;
}

/**
 * Effective resistance after reduction and penetration, applied in Riot's order:
 *   1. flat reduction (can take resistance below 0)
 *   2. percent reduction
 *   3. percent penetration
 *   4. flat penetration (cannot take resistance below 0)
 * Percent reduction and penetration do nothing to resistance that is already ≤ 0.
 */
export function effectiveResist(
  resist: number,
  pen: Penetration = {},
  reduction: ResistReduction = {},
): number {
  let r = resist - (reduction.flat ?? 0);
  if (r <= 0) return r;
  r *= 1 - (reduction.pct ?? 0);
  r *= 1 - (pen.pct ?? 0);
  return Math.max(0, r - (pen.flat ?? 0));
}

export interface MitigationContext {
  attacker: ResolvedStats;
  target: ResolvedStats;
  armorReduction?: ResistReduction;
  mrReduction?: ResistReduction;
  /** Generic % damage reduction on the target (e.g. a defensive ability), 0-1. */
  targetDamageReduction?: number;
}

/** Apply the target's resistances (and attacker penetration) to a damage instance. */
export function mitigate(hit: DamageInstance, ctx: MitigationContext): MitigatedDamage {
  const { attacker, target } = ctx;
  let effective = 0;
  let multiplier = 1;

  if (hit.type === 'physical') {
    effective = effectiveResist(
      target.armor.total,
      { flat: attacker.lethality, pct: attacker.armorPenPct },
      ctx.armorReduction,
    );
    multiplier = resistMultiplier(effective);
  } else if (hit.type === 'magic') {
    effective = effectiveResist(
      target.mr.total,
      { flat: attacker.magicPenFlat, pct: attacker.magicPenPct },
      ctx.mrReduction,
    );
    multiplier = resistMultiplier(effective);
  }

  const final = hit.raw * multiplier * (1 - (ctx.targetDamageReduction ?? 0));
  return { ...hit, final, effectiveResist: effective };
}

/** Effective HP against one damage type: HP / multiplier. */
export function effectiveHp(hp: number, resist: number): number {
  return hp / resistMultiplier(resist);
}
