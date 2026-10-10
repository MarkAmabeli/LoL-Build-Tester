import type { ItemLimitGroup } from './types';

export interface ItemLimitViolation {
  group: ItemLimitGroup;
  /** The build's items in this group, in build order (duplicates included). */
  items: string[];
}

/**
 * Shop limits a build breaks, e.g. two Spellblade items or two Rabadon's.
 * The game won't sell an item past its limit, so a build with violations can't exist.
 */
export function checkItemLimits(itemIds: string[], groups: ItemLimitGroup[]): ItemLimitViolation[] {
  return groups.flatMap((group) => {
    const inGroup = itemIds.filter((id) => group.items.includes(id));
    return inGroup.length > group.max ? [{ group, items: inGroup }] : [];
  });
}
