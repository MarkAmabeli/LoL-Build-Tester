import { describe, expect, it } from 'vitest';
import { getChampion } from './champions';
import type { ChampionSpells } from './champions/types';
import { checkRunePage, checkSkillRanks, resolveLoadout, type ItemRecord, type Loadout, type LoadoutData, type RuneTree } from './loadout';
import type { ChampionBaseStats, ItemLimitGroup, ShardData } from './types';

// The committed data for the latest patch (no Node APIs in src, so via Vite).
const files = import.meta.glob<unknown>(
  ['/public/data/manifest.json', '/public/data/*/{items,item-groups,runes,shards}.json', '/public/data/*/spells/Vayne.json'],
  { eager: true, import: 'default' },
);
const { latest } = files['/public/data/manifest.json'] as { latest: string };
const file = <T,>(name: string) => {
  const f = files[`/public/data/${latest}/${name}`];
  if (!f) throw new Error(`no ${name} for ${latest}`);
  return f as T;
};
const data: LoadoutData = {
  items: file<ItemRecord[]>('items.json'),
  itemGroups: file<ItemLimitGroup[]>('item-groups.json'),
  runes: file<RuneTree[]>('runes.json'),
  shards: file<ShardData>('shards.json'),
};
const vayneSpells = file<ChampionSpells>('spells/Vayne.json');

// Same synthetic champion as engine.test.ts (60 AD, 600 health at level 1).
const dummy: ChampionBaseStats = {
  hp: 600, hpperlevel: 100,
  mp: 300, mpperlevel: 50,
  armor: 30, armorperlevel: 4,
  spellblock: 30, spellblockperlevel: 2,
  attackdamage: 60, attackdamageperlevel: 3,
  attackspeed: 0.625, attackspeedperlevel: 2,
  movespeed: 330, attackrange: 550,
};
const at = (level: number, more: Partial<Loadout> = {}): Loadout => ({ stats: dummy, level, ...more });
const idOf = (name: string) => {
  const item = data.items.find((i) => i.name === name);
  if (!item) throw new Error(`no item ${name}`);
  return item.id;
};

/** A valid page: the tree's keystone and one rune per row, plus two runes from rows 1 and 2 of another tree. */
function page(primaryName: string, keystone: string, secondaryName: string): number[] {
  const tree = (name: string) => data.runes.find((t) => t.name === name)!;
  const primary = tree(primaryName);
  const secondary = tree(secondaryName);
  const key = primary.slots[0].runes.find((r) => r.name === keystone)!.id;
  return [key, ...[1, 2, 3].map((row) => primary.slots[row].runes[0].id), secondary.slots[1].runes[0].id, secondary.slots[2].runes[0].id];
}
const kinds = (l: Loadout) => resolveLoadout(l, data).warnings.map((w) => w.kind);

describe('resolveLoadout', () => {
  it('sums item and shard stats and resolves them', () => {
    const r = resolveLoadout(at(1, { items: [idOf('Infinity Edge'), idOf('Long Sword'), idOf('Long Sword')], shards: [5008, 5008, 5011] }), data);
    expect(r.warnings).toEqual([]);
    expect(r.bonuses).toMatchObject({ ad: 95, critChance: 0.25, critDamageBonus: 0.3, adaptiveForce: 18, hp: 65 });
    expect(r.stats.ad.bonus).toBeCloseTo(95 + 18 * 0.6);
    expect(r.stats.critMultiplier).toBeCloseTo(2.3);
    expect(r.stats.hp.total).toBe(665);
  });

  it('activates item, rune and champion effects, each once, with state overrides', () => {
    const runes = page('Domination', 'Electrocute', 'Sorcery');
    const r = resolveLoadout(at(9, {
      items: [idOf('Kraken Slayer'), idOf('Kraken Slayer')],
      runes,
      champion: { def: getChampion('Vayne')!, spells: vayneSpells },
      ranks: { Q: 1, W: 1, E: 1, R: 1 },
      state: { '8112': { proc: true }, 'Vayne:R': { active: true } },
    }), data);
    const names = r.effects.map((a) => a.effect.name);
    expect(names.filter((n) => n === 'Kraken Slayer')).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(['Electrocute', 'Silver Bolts', 'Final Hour']));
    expect(r.effects.find((a) => a.effect.id === '8112')?.state.proc).toBe(true);
    expect(r.stats.ad.bonus).toBeGreaterThanOrEqual(35); // Final Hour active
    expect(r.warnings.map((w) => w.kind)).toEqual(['itemLimit']); // two Kraken Slayers
  });

  it('warns about more than 6 items and skips trinkets, consumables and unknown IDs', () => {
    const sword = idOf('Long Sword');
    expect(kinds(at(1, { items: Array(7).fill(sword) }))).toEqual(['tooManyItems']);
    const r = resolveLoadout(at(1, { items: [idOf('Stealth Ward'), idOf('Health Potion'), '999999', sword] }), data);
    expect(r.warnings).toEqual([
      { kind: 'excludedItem', id: idOf('Stealth Ward'), name: 'Stealth Ward', reason: 'Trinket' },
      { kind: 'excludedItem', id: idOf('Health Potion'), name: 'Health Potion', reason: 'Consumable' },
      { kind: 'unknownItem', id: '999999' },
    ]);
    expect(r.bonuses).toEqual({ ad: 10 });
  });

  it('warns about shop limits (one Spellblade item)', () => {
    const w = resolveLoadout(at(1, { items: [idOf('Trinity Force'), idOf('Lich Bane')] }), data).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: 'itemLimit', group: { name: 'Spellblade' } });
  });

  it('warns about shards that are not options in their row, and skips them', () => {
    const r = resolveLoadout(at(1, { shards: [5011, 5008, 5005] }), data);
    expect(r.warnings.map((w) => w.kind)).toEqual(['shard', 'shard']);
    expect(r.bonuses).toEqual({ adaptiveForce: 9 });
  });
});

describe('checkRunePage', () => {
  const valid = page('Domination', 'Electrocute', 'Sorcery');

  it('accepts a full page and an empty one', () => {
    expect(checkRunePage(data.runes, valid)).toEqual([]);
    expect(checkRunePage(data.runes, [])).toEqual([]);
  });

  it('needs exactly one keystone', () => {
    const twoKeystones = [...valid, data.runes.find((t) => t.name === 'Precision')!.slots[0].runes[0].id];
    expect(checkRunePage(data.runes, twoKeystones)).toEqual(['2 keystones; a page has exactly one']);
  });

  it('needs one primary rune per row', () => {
    const [key, r1, , r3, s1, s2] = valid;
    expect(checkRunePage(data.runes, [key, r1, r3, s1, s2])).toEqual(['0 Domination runes in row 2; the primary tree needs one per row']);
  });

  it('needs two secondary runes from one other tree, in different rows', () => {
    const sorcery = data.runes.find((t) => t.name === 'Sorcery')!;
    const precision = data.runes.find((t) => t.name === 'Precision')!;
    const base = valid.slice(0, 4);
    expect(checkRunePage(data.runes, [...base, sorcery.slots[1].runes[0].id])).toEqual(['1 secondary runes; a page has two']);
    expect(checkRunePage(data.runes, [...base, sorcery.slots[1].runes[0].id, precision.slots[2].runes[0].id]))
      .toEqual(['Secondary runes come from Sorcery and Precision; they must share one tree']);
    expect(checkRunePage(data.runes, [...base, sorcery.slots[1].runes[0].id, sorcery.slots[1].runes[1].id]))
      .toEqual(['Two secondary runes share a row']);
  });
});

describe('checkSkillRanks', () => {
  it('accepts a legal level 6 spread', () => {
    expect(checkSkillRanks({ Q: 3, W: 1, E: 1, R: 1 }, 6)).toEqual([]);
  });

  it('flags ranks the level does not allow', () => {
    expect(checkSkillRanks({ Q: 3 }, 5)).toEqual([]);
    expect(checkSkillRanks({ Q: 3 }, 4)).toEqual(['Q rank 3 needs level 5']);
    expect(checkSkillRanks({ Q: 2, W: 2 }, 3)).toEqual(['4 skill points spent at level 3']);
    expect(checkSkillRanks({ R: 1 }, 5)).toEqual(['R rank 1 needs level 6']);
    expect(checkSkillRanks({ R: 3 }, 15)).toEqual(['R rank 3 needs level 16']);
    expect(checkSkillRanks({ Q: 5, W: 5, E: 5, R: 3 }, 17)).toEqual(['18 skill points spent at level 17']);
  });

  it("uses the champion's max ranks from the spell data", () => {
    expect(checkSkillRanks({ Q: 6 }, 18, vayneSpells)).toEqual(['Q rank 6 is above its max rank 5']);
    expect(checkSkillRanks({ R: 4 }, 18, vayneSpells)).toEqual(['R rank 4 is above its max rank 3']);
  });
});
