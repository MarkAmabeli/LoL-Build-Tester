import type { ItemLimitGroup } from '../src/engine/types.ts';

/**
 * Item structure for role quest rewards (role-quests.json), derived from Data Dragon's
 * full recipes (before items.json drops links to unlisted items) and the shop limit groups:
 *   - boots:           the "Boots" group (the bot lane reward gives these their own slot)
 *   - bootsUpgrades:   tier 2 boots → the tier 3 boots built from exactly that item (mid lane reward);
 *                      a tier 2 has a recipe of its own, unlike basic Boots
 *   - supportUpgrades: items built from Bounty of Worlds, which only the support reward unlocks
 *   - junglePets:      the jungle pet group (the jungle quest feeds a pet)
 */
export interface RoleQuestItems {
  boots: string[];
  bootsUpgrades: Record<string, string>;
  supportUpgrades: string[];
  junglePets: string[];
}

/** The support item the support quest upgrades into; not in the store, so only its recipes point at it. */
export const BOUNTY_OF_WORLDS = '3867';
const BOOTS_GROUP = 'Boots';
const JUNGLE_PET_GROUP = 'HuntersTalismanGroup';

export function buildRoleQuestItems(
  listed: Array<{ id: string }>,
  recipes: Record<string, string[] | undefined>,
  groups: ItemLimitGroup[],
): RoleQuestItems {
  const ids = new Set(listed.map((i) => i.id));
  const group = (name: string) => {
    const g = groups.find((x) => x.name === name);
    if (!g) throw new Error(`No "${name}" shop group`);
    return g.items.filter((id) => ids.has(id)).sort();
  };
  const boots = group(BOOTS_GROUP);
  const bootSet = new Set(boots);
  const builtFrom = (id: string) => recipes[id] ?? [];

  const bootsUpgrades: Record<string, string> = {};
  for (const id of boots) {
    const from = builtFrom(id);
    // A tier 2 is itself built from something (basic Boots isn't), so Sorcerer's Shoes (from Boots) isn't a tier 3.
    if (from.length === 1 && bootSet.has(from[0]) && builtFrom(from[0]).length > 0) bootsUpgrades[from[0]] = id;
  }
  const supportUpgrades = [...ids].filter((id) => builtFrom(id).includes(BOUNTY_OF_WORLDS)).sort();
  return { boots, bootsUpgrades, supportUpgrades, junglePets: group(JUNGLE_PET_GROUP) };
}
