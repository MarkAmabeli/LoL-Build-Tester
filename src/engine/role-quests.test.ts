import { describe, expect, it } from 'vitest';
import { activate, getEffect } from './effects/registry';
import { computeHit } from './hit';
import { playerLoadout, resolveLoadout, targetDummyLoadout, type ItemRecord, type Loadout, type LoadoutData, type RuneTree } from './loadout';
import { applyRoleQuest, DEFAULT_PLAYER_ROLE, TARGET_DUMMY_ROLE, type Role, type RoleQuestItems } from './role-quests';
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
/** The items after a role or quest change. */
const applyItems = (items: string[], role: Role, done: boolean | undefined) => applyRoleQuest({ role, roleQuestCompleted: done, items }, data.roleQuests).items!;

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
    const upgraded = applyItems(items, 'mid', true);
    expect(upgraded).toEqual([idOf('Gunmetal Greaves'), idOf('B. F. Sword')]);
    expect(applyItems(upgraded, 'mid', false)).toEqual(items);
    expect(applyItems(items, 'top', true)).toEqual(items);
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
    expect(applyItems([sword], 'support', false)).toEqual([atlas, sword]);
    expect(applyItems([sword, compass], 'support', false)).toEqual([sword, compass]);
    // A full inventory still gets it, with a warning rather than a dropped item.
    const full = applyItems(Array(6).fill(sword), 'support', false);
    expect(full[0]).toBe(atlas);
    expect(kinds(at(1, { role: 'support', items: full }))).toEqual(['tooManyItems']);
  });

  it('removes every form of the support item when the role changes away from support', () => {
    for (const id of [atlas, compass, bounty, bloodsong]) expect(applyItems([id, sword], 'bot', false)).toEqual([sword]);
    expect(applyItems([atlas, sword], TARGET_DUMMY_ROLE, false)).toEqual([atlas, sword]);
  });

  it('upgrades World Atlas to Bounty of Worlds when completed, and upgrades back when not', () => {
    for (const id of [atlas, compass]) expect(applyItems([id], 'support', true)).toEqual([bounty]);
    expect(applyItems([sword], 'support', true)).toEqual([bounty, sword]);
    expect(applyItems([bloodsong], 'support', true)).toEqual([bloodsong]);
    expect(applyItems([bloodsong], 'support', false)).toEqual([bounty]);
    // Checking or unchecking never leaves an invalid support item.
    for (const done of [true, false]) {
      for (const id of [atlas, compass, bounty, bloodsong]) {
        expect(kinds(at(1, { role: 'support', roleQuestCompleted: done, items: applyItems([id], 'support', done) }))).toEqual([]);
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
  const pup = idOf('Scorchclaw Pup');
  const gust = idOf('Gustwalker Hatchling');
  const sword = idOf('Long Sword');
  const smiteDamage = (l: Loadout) => {
    const r = resolve(l);
    return summonerHit(smite, { attacker: r.stats, target, smite: r.smite }).total;
  };
  const jungler = (more: Partial<Loadout> = {}) => at(9, { role: 'jungle', summoners: ['SummonerSmite', 'SummonerFlash'], items: [gust], ...more });

  it('levels Smite: none to champions, then Unleashed and Primal for 40 true damage', () => {
    expect(resolve(jungler()).smite).toBe('basic');
    expect(smiteDamage(jungler())).toBe(0);
    const unleashed = resolve(jungler({ petFirstEvolution: true }));
    expect(unleashed.warnings).toEqual([]);
    expect(unleashed.smite).toBe('unleashed');
    expect(smiteDamage(jungler({ petFirstEvolution: true }))).toBe(40);
    const primal = resolve(jungler({ roleQuestCompleted: true }));
    expect(primal.warnings).toEqual([]);
    expect(primal.smite).toBe('primal');
    expect(smiteDamage(jungler({ roleQuestCompleted: true }))).toBe(40);
    // The first evolution is ignored once the quest is done, and off the jungle role.
    expect(resolve(jungler({ roleQuestCompleted: true, petFirstEvolution: false })).smite).toBe('primal');
    expect(resolve(at(9, { role: 'top', petFirstEvolution: true })).smite).toBe('basic');
  });

  it('checks the first evolution when the quest is completed', () => {
    expect(applyRoleQuest({ role: 'jungle', roleQuestCompleted: true, summoners: ['SummonerSmite'] }, data.roleQuests).petFirstEvolution).toBe(true);
    expect(applyRoleQuest({ role: 'jungle', summoners: ['SummonerSmite'] }, data.roleQuests).petFirstEvolution).toBeUndefined();
  });

  it('moves the consumed pet to the role quest slot once completed, still counting its gold', () => {
    const six = Array(6).fill(sword);
    expect(kinds(jungler({ items: [gust, ...six] }))).toEqual(['tooManyItems']);
    const done = resolve(jungler({ roleQuestCompleted: true, items: [gust, ...six] }));
    expect(done.warnings).toEqual([]);
    expect(done.gold.total).toBe(450 + 6 * 350);
    expect(resolve(jungler({ roleQuestCompleted: true, items: [gust, ...six, sword] })).warnings)
      .toEqual([{ kind: 'tooManyItems', count: 8, max: 7 }]);
  });

  it("gives Scorchclaw's Slash with Primal Smite and Scorchclaw Pup, charged at the start", () => {
    const effects = resolve(jungler({ roleQuestCompleted: true, items: [pup] })).effects;
    const slash = effects.find((e) => e.effect.id === 'RoleQuest:jungle:scorchclaw');
    expect(slash?.state.proc).toBe(true);
    const hit = computeHit({ type: 'physical', raw: 0, source: 'x', tags: ['auto'] }, { attacker: resolve(jungler()).stats, target, effects });
    const burn = hit.hits.find((h) => h.source === "Scorchclaw's Slash")!;
    expect(burn.type).toBe('true');
    expect(burn.final).toBeCloseTo(0.05 * target.stats.hp.total);
    expect(resolve(jungler({ items: [pup] })).effects.some((e) => e.effect.id === 'RoleQuest:jungle:scorchclaw')).toBe(false);
    expect(resolve(jungler({ roleQuestCompleted: true })).effects.some((e) => e.effect.id === 'RoleQuest:jungle:scorchclaw')).toBe(false);
  });

  it('binds Smite and the jungle pet to the jungle role', () => {
    expect(applyRoleQuest({ role: 'jungle', summoners: ['SummonerFlash'] }, data.roleQuests).summoners).toEqual(['SummonerSmite', 'SummonerFlash']);
    expect(applyRoleQuest({ role: 'jungle', summoners: ['SummonerFlash', 'SummonerSmite'] }, data.roleQuests).summoners).toEqual(['SummonerFlash', 'SummonerSmite']);
    expect(applyRoleQuest({ role: 'mid', summoners: ['SummonerSmite', 'SummonerFlash'] }, data.roleQuests).summoners).toEqual(['SummonerFlash']);
    expect(applyRoleQuest({ role: TARGET_DUMMY_ROLE, summoners: ['SummonerSmite'] }, data.roleQuests).summoners).toEqual(['SummonerSmite']);
    expect(applyItems([gust, sword], 'top', false)).toEqual([sword]);
    expect(applyItems([gust, sword], 'jungle', true)).toEqual([gust, sword]);
    expect(applyItems([gust, sword], TARGET_DUMMY_ROLE, false)).toEqual([gust, sword]);
    expect(resolve(jungler({ summoners: ['SummonerFlash'] })).warnings).toEqual([
      { kind: 'summoners', message: 'A jungler needs Smite' },
      { kind: 'junglePet', message: 'A jungle pet needs Smite' },
    ]);
    expect(resolve(at(9, { role: 'mid', summoners: ['SummonerSmite'] })).warnings).toEqual([{ kind: 'summoners', message: 'Smite is only for the jungle role' }]);
    expect(kinds(at(9, { role: TARGET_DUMMY_ROLE, summoners: ['SummonerSmite'], items: [gust] }))).toEqual([]);
  });

  it('needs a pet: for other items, the first evolution and the quest', () => {
    const noPet = { summoners: ['SummonerSmite'], items: [] as string[] };
    expect(kinds(jungler(noPet))).toEqual([]);
    expect(resolve(jungler({ ...noPet, items: [sword] })).warnings).toEqual([{ kind: 'junglePet', message: 'A jungler needs a jungle pet before other items' }]);
    expect(resolve(jungler({ ...noPet, petFirstEvolution: true })).warnings).toEqual([{ kind: 'junglePet', message: "The pet's first evolution needs a jungle pet" }]);
    expect(resolve(jungler({ ...noPet, roleQuestCompleted: true })).warnings).toEqual([{ kind: 'roleQuest', message: 'The jungle quest needs a jungle pet' }]);
  });
});

it('lets every role mark its quest completed', () => {
  for (const role of ['top', 'mid', 'bot', 'support'] as const) {
    const items = applyItems([], role, true);
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
    for (const done of [true, false]) expect(applyItems(items, TARGET_DUMMY_ROLE, done)).toEqual(items);
  });
});
