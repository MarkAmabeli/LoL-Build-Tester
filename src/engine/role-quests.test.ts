import { describe, expect, it } from 'vitest';
import { activate, getEffect } from './effects/registry';
import { computeHit } from './hit';
import { playerLoadout, resolveLoadout, targetDummyLoadout, type ItemRecord, type Loadout, type LoadoutData, type RuneTree } from './loadout';
import { applyRoleQuest, DEFAULT_PLAYER_ROLE, TARGET_DUMMY_ROLE, type RoleQuestItems } from './role-quests';
import { summonerHit, type SummonerSpellRecord } from './summoners';
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
const idOf = (name: string) => data.items.find((i) => i.name === name)!.id;

// Same synthetic champion as engine.test.ts (60 AD, 600 health at level 1, +100 health per level).
const dummy: ChampionBaseStats = {
  hp: 600, hpperlevel: 100,
  mp: 300, mpperlevel: 50,
  armor: 30, armorperlevel: 4,
  spellblock: 30, spellblockperlevel: 2,
  attackdamage: 60, attackdamageperlevel: 3,
  attackspeed: 0.625, attackspeedperlevel: 2,
  movespeed: 330, attackrange: 550,
};
// Player builds default to the bot lane role.
const at = (level: number, more: Partial<Loadout> = {}): Loadout => ({ ...playerLoadout(dummy, level), ...more, role: more.role ?? DEFAULT_PLAYER_ROLE });
const resolve = (l: Loadout) => resolveLoadout(l, data);
const kinds = (l: Loadout) => resolve(l).warnings.map((w) => w.kind);

describe('mid lane quest', () => {
  it('grants +8% bonus AD and +8% AP when completed', () => {
    const items = [idOf('B. F. Sword'), idOf('Needlessly Large Rod')];
    const done = resolve(at(1, { role: 'mid', roleQuestCompleted: true, items })).stats;
    expect(done.ad.base).toBe(60);
    expect(done.ad.bonus).toBeCloseTo(40 * 1.08);
    const rodAp = data.items.find((i) => i.name === 'Needlessly Large Rod')!.stats.ap!;
    expect(done.ap).toBeCloseTo(rodAp * 1.08);
    expect(resolve(at(1, { role: 'mid', items })).stats.ap).toBe(rodAp);
  });

  it("stacks multiplicatively with Rabadon's Deathcap", () => {
    const stats = resolve(at(1, { role: 'mid', roleQuestCompleted: true, items: [idOf("Rabadon's Deathcap")] })).stats;
    expect(stats.ap).toBeCloseTo(130 * 1.3 * 1.08);
  });

  it('upgrades tier 2 boots to tier 3 when completed, and back when not', () => {
    const items = [idOf("Berserker's Greaves"), idOf('B. F. Sword')];
    const upgraded = applyRoleQuest(items, 'mid', true, data.roleQuests);
    expect(upgraded).toEqual([idOf('Gunmetal Greaves'), idOf('B. F. Sword')]);
    expect(applyRoleQuest(upgraded, 'mid', false, data.roleQuests)).toEqual(items);
    expect(applyRoleQuest(items, 'top', true, data.roleQuests)).toEqual(items);
  });

  it('allows tier 3 boots only for a completed mid quest', () => {
    const swiftmarch = [idOf('Swiftmarch')];
    expect(kinds(at(1, { role: 'mid', roleQuestCompleted: true, items: swiftmarch }))).toEqual([]);
    expect(resolve(at(1, { role: 'mid', items: swiftmarch })).warnings).toEqual([
      { kind: 'roleItem', id: idOf('Swiftmarch'), name: 'Swiftmarch', needs: 'mid' },
    ]);
    expect(kinds(at(1, { role: 'top', roleQuestCompleted: true, items: swiftmarch }))).toEqual(['roleItem']);
  });
});

describe('support quest', () => {
  const atlas = idOf('World Atlas');
  const compass = idOf('Runic Compass');
  const bounty = idOf('Bounty of Worlds');
  const bloodsong = idOf('Bloodsong');
  const sword = idOf('Long Sword');

  it("allows Bounty of Worlds' upgrades only for a completed support quest", () => {
    expect(kinds(at(1, { role: 'support', roleQuestCompleted: true, items: [bloodsong] }))).toEqual([]);
    expect(resolve(at(1, { role: 'support', items: [bloodsong] })).warnings).toEqual([
      { kind: 'roleItem', id: bloodsong, name: 'Bloodsong', needs: 'support' },
    ]);
  });

  it('needs the support item, in any of its forms', () => {
    expect(resolve(at(1, { role: 'support', items: [sword] })).warnings).toEqual([
      { kind: 'supportItem', message: 'A support needs the support item (World Atlas or what it becomes)' },
    ]);
    for (const id of [atlas, compass, bounty]) expect(kinds(at(1, { role: 'support', items: [id] }))).toEqual([]);
    expect(kinds(at(1, { role: 'mid', items: [sword] }))).toEqual([]);
  });

  it('is bound to the support role: other player roles warn, the target dummy may hold it', () => {
    for (const id of [atlas, compass, bounty]) {
      expect(resolve(at(1, { role: 'top', items: [id] })).warnings).toEqual([
        { kind: 'roleItem', id, name: data.items.find((i) => i.id === id)!.name, needs: 'support' },
      ]);
    }
    expect(kinds(at(1, { role: TARGET_DUMMY_ROLE, items: [atlas] }))).toEqual([]);
  });

  it("counts every stage at World Atlas's price and adds their health", () => {
    for (const id of [compass, bounty]) expect(resolve(at(1, { role: 'support', items: [id] })).gold.total).toBe(400);
    expect(resolve(at(1, { role: 'support', items: [compass] })).bonuses.hp).toBe(60);
    expect(resolve(at(1, { role: 'support', items: [bounty] })).bonuses.hp).toBe(200);
  });

  it('puts World Atlas in the first slot when the role becomes support', () => {
    expect(applyRoleQuest([sword], 'support', false, data.roleQuests)).toEqual([atlas, sword]);
    expect(applyRoleQuest([sword, compass], 'support', false, data.roleQuests)).toEqual([sword, compass]);
    // A full inventory still gets it, with a warning rather than a dropped item.
    const full = applyRoleQuest(Array(6).fill(sword), 'support', false, data.roleQuests);
    expect(full[0]).toBe(atlas);
    expect(kinds(at(1, { role: 'support', items: full }))).toEqual(['tooManyItems']);
  });

  it('removes every form of the support item when the role changes away from support', () => {
    for (const id of [atlas, compass, bounty, bloodsong]) expect(applyRoleQuest([id, sword], 'bot', false, data.roleQuests)).toEqual([sword]);
    expect(applyRoleQuest([atlas, sword], TARGET_DUMMY_ROLE, false, data.roleQuests)).toEqual([atlas, sword]);
  });

  it('upgrades World Atlas to Bounty of Worlds when completed, and upgrades back when not', () => {
    for (const id of [atlas, compass]) expect(applyRoleQuest([id], 'support', true, data.roleQuests)).toEqual([bounty]);
    expect(applyRoleQuest([sword], 'support', true, data.roleQuests)).toEqual([bounty, sword]);
    expect(applyRoleQuest([bloodsong], 'support', true, data.roleQuests)).toEqual([bloodsong]);
    expect(applyRoleQuest([bloodsong], 'support', false, data.roleQuests)).toEqual([bounty]);
    // Checking or unchecking never leaves an invalid support item.
    for (const done of [true, false]) {
      for (const id of [atlas, compass, bounty, bloodsong]) {
        expect(kinds(at(1, { role: 'support', roleQuestCompleted: done, items: applyRoleQuest([id], 'support', done, data.roleQuests) }))).toEqual([]);
      }
    }
  });
});

describe('bot lane quest', () => {
  const six = Array(6).fill(idOf('Long Sword'));
  it('moves boots to their own slot when completed', () => {
    expect(kinds(at(1, { role: 'bot', roleQuestCompleted: true, items: [...six, idOf('Boots')] }))).toEqual([]);
    expect(kinds(at(1, { role: 'bot', items: [...six, idOf('Boots')] }))).toEqual(['tooManyItems']);
    expect(resolve(at(1, { role: 'bot', roleQuestCompleted: true, items: [...six, idOf('Long Sword')] })).warnings)
      .toEqual([{ kind: 'tooManyItems', count: 7, max: 6 }]);
  });
});

describe('top lane quest', () => {
  it('raises the level cap to 20, with stats growing past 18', () => {
    const r = resolve(at(20, { role: 'top', roleQuestCompleted: true }));
    expect(r.warnings).toEqual([]);
    expect(r.levelCap).toBe(20);
    expect(r.stats.level).toBe(20);
    // 600 + 100 × 19 × (0.7025 + 0.0175 × 19)
    expect(r.stats.hp.total).toBeCloseTo(600 + 100 * 19.665);
  });

  it('keeps level-scaled effects at their level 18 value', () => {
    const effects = [activate(getEffect('8112')!, { proc: true })];
    const r = resolve(at(20, { role: 'top', roleQuestCompleted: true }));
    const target = { stats: resolve(at(1, { stats: { ...dummy, armor: 0, spellblock: 0, armorperlevel: 0, spellblockperlevel: 0 } })).stats };
    const hit = computeHit({ type: 'physical', raw: 0, source: 'x', tags: ['ability'] }, { attacker: r.stats, target, effects });
    expect(hit.hits[1].raw).toBeCloseTo(240);
  });

  it('warns above level 18 without the completed top quest, and clamps', () => {
    const r = resolve(at(20, { role: 'mid', roleQuestCompleted: true }));
    expect(r.warnings).toEqual([{ kind: 'level', message: 'Level 20 is above the level cap 18' }]);
    expect(r.stats.level).toBe(18);
  });
});

describe('jungle quest', () => {
  const smite = data.summoners.find((s) => s.id === 'SummonerSmite')!;
  const target = { stats: resolve(at(18)).stats };

  it('makes Smite Primal Smite: 40 true damage to champions', () => {
    const r = resolve(at(9, { role: 'jungle', roleQuestCompleted: true, items: [idOf('Scorchclaw Pup')], summoners: ['SummonerSmite'] }));
    expect(r.warnings).toEqual([]);
    expect(r.smite).toBe('primal');
    expect(summonerHit(smite, { attacker: r.stats, target, smite: r.smite }).total).toBe(40);
  });

  it("deals no champion damage before the quest, and the quest needs a pet", () => {
    const r = resolve(at(9, { role: 'jungle', summoners: ['SummonerSmite'] }));
    expect(summonerHit(smite, { attacker: r.stats, target, smite: r.smite }).total).toBe(0);
    expect(resolve(at(9, { role: 'jungle', roleQuestCompleted: true })).warnings)
      .toEqual([{ kind: 'roleQuest', message: 'The jungle quest needs a jungle pet' }]);
  });
});

it('lets every role mark its quest completed', () => {
  for (const role of ['top', 'mid', 'bot', 'support'] as const) {
    const items = applyRoleQuest([], role, true, data.roleQuests);
    expect(kinds(at(9, { role, roleQuestCompleted: true, items }))).toEqual([]);
  }
});

describe('roles', () => {
  it('defaults player builds to bot lane, quest not completed', () => {
    const l = playerLoadout(dummy, 1);
    expect(l.role).toBe('bot');
    expect(l.roleQuestCompleted).toBeUndefined();
    expect(at(1).role).toBe('bot');
  });

  it('gives target dummy builds the target dummy role, which counts as completed for items only', () => {
    const l = targetDummyLoadout(dummy, 18);
    expect(l.role).toBe('targetDummy');
    const upgraded = [idOf('Swiftmarch'), idOf('Bloodsong'), idOf('Long Sword')];
    for (const done of [undefined, true, false]) {
      const r = resolve({ ...l, roleQuestCompleted: done, items: upgraded });
      expect(r.warnings).toEqual([]);
      expect(r.levelCap).toBe(18);
      expect(r.effects.filter((e) => e.effect.kind === 'roleQuest')).toEqual([]);
      expect(r.smite).toBe('basic');
    }
    expect(kinds({ ...l, items: [idOf('World Atlas')] })).toEqual([]);
  });

  it('never changes a target dummy\'s items', () => {
    const items = [idOf("Berserker's Greaves"), idOf('Gunmetal Greaves'), idOf('World Atlas'), idOf('Bloodsong')];
    for (const done of [true, false]) expect(applyRoleQuest(items, TARGET_DUMMY_ROLE, done, data.roleQuests)).toEqual(items);
  });
});
