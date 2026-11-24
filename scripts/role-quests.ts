import type { ItemLimitGroup } from '../src/engine/types.ts';

/**
 * Item structure for role quest rewards (role-quests.json), derived from Data Dragon's
 * full recipes (before items.json drops links to unlisted items) and the shop limit groups:
 *   - boots:           the "Boots" group (the bot lane reward gives these their own slot)
 *   - bootsUpgrades:   tier 2 boots → the tier 3 boots built from exactly that item (mid lane reward);
 *                      a tier 2 has a recipe of its own, unlike basic Boots
 *   - supportUpgrades: items built from Bounty of Worlds, which only the support reward unlocks
 *   - junglePets:      the jungle pet group (the jungle quest feeds a pet)
 *   - supportStarter:  the support starting item; its upgrades replace it and count at its price
 *   - supportStages:   the support item's stages before the quest (World Atlas → Runic Compass → Bounty of
 *                      Worlds, by its own gold quest); the last is the one the support reward upgrades
 */
export interface RoleQuestItems {
  boots: string[];
  bootsUpgrades: Record<string, string>;
  supportUpgrades: string[];
  junglePets: string[];
  supportStarter: string;
  supportStages: string[];
}

/** The support item the support quest upgrades into; not in the store, so only its recipes point at it. */
export const BOUNTY_OF_WORLDS = '3867';
/** World Atlas: the support starting item. It upgrades through items outside the store, so no recipe links it to Bounty of Worlds. */
export const WORLD_ATLAS = '3865';
/** World Atlas's second stage, between it and Bounty of Worlds; not in the store either. */
export const RUNIC_COMPASS = '3866';
/**
 * The support item's stages in order (wiki: World Atlas, Runic Compass). Runic Compass and Bounty
 * of Worlds aren't purchasable, so the import keeps them in items.json by these IDs.
 */
export const SUPPORT_STAGES = [WORLD_ATLAS, RUNIC_COMPASS, BOUNTY_OF_WORLDS] as const;
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
  for (const id of SUPPORT_STAGES) if (!ids.has(id)) throw new Error(`Support item stage ${id} isn't in the item list`);
  return {
    boots,
    bootsUpgrades,
    supportUpgrades,
    junglePets: group(JUNGLE_PET_GROUP),
    supportStarter: WORLD_ATLAS,
    supportStages: [...SUPPORT_STAGES],
  };
}
