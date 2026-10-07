import { adaptiveDamageType } from '../../stats';
import type { DamageInstance, ResolvedStats } from '../../types';

/** A rune proc dealing adaptive damage: physical or magic by the attacker's current bonus AD vs AP. */
export function adaptiveProc(attacker: ResolvedStats, raw: number, source: string): DamageInstance {
  return { type: adaptiveDamageType(attacker), raw, source, tags: ['proc'] };
}
