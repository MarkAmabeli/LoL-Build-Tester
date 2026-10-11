/**
 * Per-rank cooldown, cost and range from a spell's bin arrays. The arrays aren't indexed
 * alike (see sources.ts, "spell-ranks"):
 *   - cooldownTime and castRange: entry 0 is a placeholder, rank N is entry N
 *   - mana (cost): no placeholder, rank N is entry N − 1
 * Each result has one value per rank (index 0 = rank 1), or is undefined when the data
 * has nothing usable.
 */

/** Cast ranges the game uses as stand-ins (self-cast, global, unlimited), not distances. */
export function isPlaceholderRange(range: number): boolean {
  return range <= 1 || range >= 10000;
}

function ranks(values: number[] | undefined, first: number, maxRank: number): number[] | undefined {
  if (!values || values.length <= first) return undefined;
  return Array.from({ length: maxRank }, (_, i) => values[Math.min(first + i, values.length - 1)]);
}

/** Cooldown per rank; undefined if missing or all 0 (no usable cooldown in the data). */
export function cooldownByRank(values: number[] | undefined, maxRank: number): number[] | undefined {
  const r = ranks(values, 1, maxRank);
  return r && r.some((v) => v > 0) ? r : undefined;
}

/** Cost per rank; undefined if missing or all 0 (free). */
export function costByRank(values: number[] | undefined, maxRank: number): number[] | undefined {
  const r = ranks(values, 0, maxRank);
  return r && r.some((v) => v > 0) ? r : undefined;
}

/** Range per rank; undefined if missing or any rank is a placeholder value. */
export function rangeByRank(values: number[] | undefined, maxRank: number): number[] | undefined {
  const r = ranks(values, 1, maxRank);
  return r && !r.some(isPlaceholderRange) ? r : undefined;
}
