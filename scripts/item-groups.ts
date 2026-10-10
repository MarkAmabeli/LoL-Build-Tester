import type { ItemLimitGroup } from '../src/engine/types.ts';

// ---- CommunityDragon items.cdtb.bin shapes (only the fields we use) ----
export interface BinItemGroup {
  __type: 'ItemGroup';
  mItemGroupID: string;
  mMaxGroupOwnable?: number;
}
export interface BinItemData {
  __type: 'ItemData';
  itemID: number;
  mItemGroups?: string[];
}
export type ItemsBin = Record<string, BinItemGroup | BinItemData | { __type?: string }>;

/**
 * Groups whose bin key and group ID are both hashes, named after their shared passive.
 * Other groups use their readable key ("Items/ItemGroups/LastWhisper") or ID ("HuntersTalismanGroup").
 */
const HASHED_GROUP_NAMES: Record<string, string> = {
  '{8b55a7b3}': 'Spellblade',
  '{3fcdbdac}': 'SpellShield',
  '{87f1e822}': 'Thorns',
  '{3541a6d4}': 'HydraItems',
};

/** Above this, a "limit" is really "unlimited" (e.g. 99 for Arena items). */
const MAX_REAL_LIMIT = 10;

/**
 * Shop limits for the given store items: every group with a max-owned count that
 * contains at least one of them. Single-item groups encode "one copy only" (most
 * legendaries); multi-item groups are shared families like Spellblade or Last Whisper.
 */
export function buildItemGroups(bin: ItemsBin, items: Array<{ id: string; name: string }>): ItemLimitGroup[] {
  const names = new Map(items.map((i) => [i.id, i.name]));
  const members = new Map<string, string[]>();
  for (const entry of Object.values(bin)) {
    if (entry.__type !== 'ItemData') continue;
    const { itemID, mItemGroups = [] } = entry as BinItemData;
    const id = String(itemID);
    if (!names.has(id)) continue;
    for (const key of mItemGroups) {
      const list = members.get(key) ?? [];
      if (!list.includes(id)) list.push(id);
      members.set(key, list);
    }
  }

  const groups: ItemLimitGroup[] = [];
  for (const [key, ids] of members) {
    const group = bin[key] as BinItemGroup | undefined;
    const max = group?.mMaxGroupOwnable;
    if (group?.__type !== 'ItemGroup' || max === undefined || max < 1 || max > MAX_REAL_LIMIT) continue;
    groups.push({ id: key, name: groupName(key, group.mItemGroupID, ids, names), max, items: ids.sort() });
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function groupName(key: string, groupId: string, ids: string[], names: Map<string, string>): string {
  const readable = /^Items\/ItemGroups\/(.+)$/.exec(key)?.[1];
  if (readable) return readable;
  if (HASHED_GROUP_NAMES[key]) return HASHED_GROUP_NAMES[key];
  // Hashes look like "{1a2b3c4d}"; item-ID groups ("3089") are named after the item below.
  if (!/^\{[0-9a-f]+\}$|^\d+$/.test(groupId)) return groupId;
  // Unnamed groups of one item (or its mode variants) mean "own only one copy".
  const distinct = [...new Set(ids.map((id) => names.get(id)))];
  return distinct.length === 1 ? distinct[0]! : key;
}
