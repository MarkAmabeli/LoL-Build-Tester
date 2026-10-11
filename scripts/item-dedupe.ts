/**
 * Data Dragon lists some Summoner's Rift items more than once under the same name: the
 * standard shop item plus variants like `323110` (Frozen Heart) or `663146` (Hextech
 * Gunblade), and alternate jungle pets (`1105`–`1107`). The variants are only on
 * Summoner's Rift, have no plaintext and often different gold or stats. What unlocks
 * them isn't confirmed, so this keeps one entry per name by assumption, pending a
 * manual review of the item list:
 *   1. the entry available on the most maps (the standard item is also on ARAM etc.)
 *   2. then the lowest numeric ID
 * Item effects are registered under the standard IDs, so the variants' passives
 * wouldn't be modeled anyway.
 */

export interface DedupeCandidate {
  id: string;
  name: string;
  maps?: Record<string, boolean>;
}

export interface DroppedDuplicate {
  name: string;
  kept: string;
  dropped: string[];
}

function mapCount(item: DedupeCandidate): number {
  return Object.values(item.maps ?? {}).filter(Boolean).length;
}

/** One item per name, chosen as described above, plus what was dropped for the build log. */
export function dedupeItemsByName<T extends DedupeCandidate>(items: T[]): { items: T[]; dropped: DroppedDuplicate[] } {
  const byName = new Map<string, T[]>();
  for (const item of items) byName.set(item.name, [...(byName.get(item.name) ?? []), item]);

  const keep = new Set<string>();
  const dropped: DroppedDuplicate[] = [];
  for (const [name, group] of byName) {
    const [best, ...rest] = [...group].sort((a, b) => mapCount(b) - mapCount(a) || Number(a.id) - Number(b.id));
    keep.add(best.id);
    if (rest.length > 0) dropped.push({ name, kept: best.id, dropped: rest.map((i) => i.id) });
  }
  return {
    items: items.filter((i) => keep.has(i.id)),
    dropped: dropped.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
