import { describe, expect, it } from 'vitest';
import { goldValue, referenceProblems, statGoldValues, type StatGoldValues } from './gold-efficiency';
import { resolveLoadout, type ItemRecord, type LoadoutData, type RuneTree } from './loadout';
import type { RoleQuestItems } from './role-quests';
import type { SummonerSpellRecord } from './summoners';
import type { ChampionBaseStats, ItemLimitGroup, ShardData } from './types';

const files = import.meta.glob<unknown>(
  ['/public/data/manifest.json', '/public/data/*/{items,item-groups,runes,shards,summoners,role-quests}.json'],
  { eager: true, import: 'default' },
);
const { latest } = files['/public/data/manifest.json'] as { latest: string };
const file = <T,>(name: string) => files[`/public/data/${latest}/${name}`] as T;
const data: LoadoutData = {
  items: file<ItemRecord[]>('items.json'),
  itemGroups: file<ItemLimitGroup[]>('item-groups.json'),
  runes: file<RuneTree[]>('runes.json'),
  shards: file<ShardData>('shards.json'),
  summoners: file<SummonerSpellRecord[]>('summoners.json'),
  roleQuests: file<RoleQuestItems>('role-quests.json'),
};
const byName = (name: string) => data.items.find((i) => i.name === name)!;
const values = statGoldValues(data.items);
const efficiencyOf = (name: string) => {
  const i = byName(name);
  return goldValue(i.stats, i.gold, values);
};

describe('stat gold values', () => {
  it('have reference items that still fit (after a data refresh)', () => {
    expect(referenceProblems(data.items)).toEqual([]);
  });

  // Module:Gold value/data (wiki-sources.json), per point as the wiki shows it (percent stats per 1%).
  it("match the wiki's gold per point", () => {
    const perPct = (v: number | undefined) => v! / 100;
    const expected: Array<[keyof StatGoldValues, number, number]> = [
      ['ad', values.ad!, 35], ['abilityHaste', values.abilityHaste!, 50], ['ap', values.ap!, 20],
      ['armor', values.armor!, 20], ['mr', values.mr!, 20], ['hp', values.hp!, 2.666667], ['mana', values.mana!, 1],
      ['baseHpRegenPct', perPct(values.baseHpRegenPct), 3], ['baseManaRegenPct', perPct(values.baseManaRegenPct), 4],
      ['critChance', perPct(values.critChance), 40], ['attackSpeedPct', values.attackSpeedPct!, 25], ['moveSpeed', values.moveSpeed!, 12],
      ['moveSpeedPct', perPct(values.moveSpeedPct), 65.105], ['armorPenPct', perPct(values.armorPenPct), 41.666667],
      ['healShieldPower', perPct(values.healShieldPower), 50], ['lethality', values.lethality!, 30],
      ['magicPenFlat', values.magicPenFlat!, 46.666667], ['magicPenPct', perPct(values.magicPenPct), 46.15],
      ['omnivamp', perPct(values.omnivamp), 46], ['tenacity', perPct(values.tenacity), 10.333334],
    ];
    for (const [stat, actual, wiki] of expected) expect([stat, actual]).toEqual([stat, expect.closeTo(wiki, 2)]);
    // The wiki's 53.55 is older; Vampiric Scepter now gives (900 − 15 × 35) / 7.
    expect(perPct(values.lifeSteal)).toBeCloseTo(375 / 7);
  });
});

describe('item gold efficiency', () => {
  it("matches the wiki's item pages", () => {
    expect(efficiencyOf('Long Sword').efficiency).toBeCloseTo(1);
    const ie = efficiencyOf('Infinity Edge');
    expect(ie.value).toBeCloseTo(3625);
    expect(ie.efficiency).toBeCloseTo(1.0357, 4);
    expect(ie.notValued).toEqual(['critDamageBonus']);
    expect(efficiencyOf('Zeal').value).toBeCloseTo(1235.42, 1);
    expect(efficiencyOf('Zeal').efficiency).toBeCloseTo(1.0295, 4);
    expect(efficiencyOf('Heartsteel').efficiency).toBeCloseTo(0.9);
  });

  it('values stats only and lists those with no gold value', () => {
    const bloodsong = efficiencyOf('Bloodsong');
    expect(bloodsong.value).toBeCloseTo(1058.33, 1);
    expect(bloodsong.notValued).toEqual(['goldPer10']);
    expect(bloodsong.byStat.hp).toBeCloseTo(533.33, 1);
  });

  it('is undefined for a free item', () => {
    expect(goldValue({ ad: 10 }, 0, values).efficiency).toBeUndefined();
  });
});

describe('build gold efficiency', () => {
  const dummy: ChampionBaseStats = {
    hp: 600, hpperlevel: 100, mp: 300, mpperlevel: 50, armor: 30, armorperlevel: 4, spellblock: 30, spellblockperlevel: 2,
    attackdamage: 60, attackdamageperlevel: 3, attackspeed: 0.625, attackspeedperlevel: 2, movespeed: 330, attackrange: 550,
  };

  it('compares the inventory gold value with its cost', () => {
    const items = ['Infinity Edge', 'Long Sword'].map((n) => byName(n).id);
    const { gold } = resolveLoadout({ stats: dummy, level: 1, role: 'bot', items }, data);
    expect(gold.total).toBe(3850);
    expect(gold.value).toBeCloseTo(3625 + 350);
    expect(gold.efficiency).toBeCloseTo((3625 + 350) / 3850);
    expect(gold.items.map((i) => i.efficiency)).toEqual([expect.closeTo(1.0357, 4), expect.closeTo(1)]);
  });

  it('uses build cost, so a free role quest upgrade shows its value', () => {
    const t2 = byName("Berserker's Greaves");
    const t3 = byName('Gunmetal Greaves');
    const { gold } = resolveLoadout({ stats: dummy, level: 1, role: 'mid', roleQuestCompleted: true, items: [t3.id] }, data);
    expect(gold.items[0].cost).toBe(t2.gold);
    expect(gold.items[0].efficiency).toBeCloseTo(goldValue(t3.stats, 1, values).value / t2.gold);
  });

  it('is undefined for an empty inventory', () => {
    expect(resolveLoadout({ stats: dummy, level: 1, role: 'bot' }, data).gold.efficiency).toBeUndefined();
  });
});
