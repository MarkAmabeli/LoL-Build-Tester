import type { DamageInstance } from '../types';

/** A hit with its raw damage increased by `pct` (0.08 = +8%), for `preMitigation` hooks. */
export function amplify(hit: DamageInstance, pct: number): DamageInstance {
  return { ...hit, raw: hit.raw * (1 + pct) };
}
