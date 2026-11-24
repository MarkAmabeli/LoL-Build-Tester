import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Checks the committed role-quests.json for the latest patch against the wiki's lists ("Role Quests").
describe('committed role quest items', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const rq = JSON.parse(readFileSync(`public/data/${latest}/role-quests.json`, 'utf8')) as {
    bootsUpgrades: Record<string, string>;
    supportUpgrades: string[];
    junglePets: string[];
    supportStages: string[];
  };
  const items = JSON.parse(readFileSync(`public/data/${latest}/items.json`, 'utf8')) as Array<{ id: string; name: string }>;
  const name = (id: string) => items.find((i) => i.id === id)?.name;

  it('upgrades the seven tier 2 boots to their tier 3 versions', () => {
    expect(Object.fromEntries(Object.entries(rq.bootsUpgrades).map(([a, b]) => [name(a), name(b)]))).toEqual({
      "Berserker's Greaves": 'Gunmetal Greaves',
      'Boots of Swiftness': 'Swiftmarch',
      'Gluttonous Greaves': 'Immortal Path',
      'Ionian Boots of Lucidity': 'Crimson Lucidity',
      "Mercury's Treads": 'Chainlaced Crushers',
      'Plated Steelcaps': 'Armored Advance',
      "Sorcerer's Shoes": "Spellslinger's Shoes",
    });
  });

  it("lists Bounty of Worlds' five upgrades and the jungle pets", () => {
    expect(rq.supportUpgrades.map(name).sort()).toEqual(['Bloodsong', 'Celestial Opposition', 'Dream Maker', 'Solstice Sleigh', "Zaz'Zak's Realmspike"]);
    expect(rq.junglePets.map(name).sort()).toEqual(['Gustwalker Hatchling', 'Mosstomper Seedling', 'Scorchclaw Pup']);
  });

  it("lists the support item's stages in order, the upgrades built from the last", () => {
    expect(rq.supportStages.map(name)).toEqual(['World Atlas', 'Runic Compass', 'Bounty of Worlds']);
    const bounty = items.find((i) => i.id === rq.supportStages[2]) as { into?: string[] } | undefined;
    expect([...(bounty?.into ?? [])].sort()).toEqual([...rq.supportUpgrades].sort());
  });
});
