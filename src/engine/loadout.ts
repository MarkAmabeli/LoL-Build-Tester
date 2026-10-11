import { championEffects } from './champions';
import type { ChampionDefinition, ChampionSpells, Ranks, Slot } from './champions/types';
import { activate, getEffect } from './effects/registry';
import { assumed, hand } from './hand';
import type { ActiveEffect, EffectState } from './effects/types';
import { checkItemLimits } from './items';
import { shardBonuses } from './shards';
import { clampLevel, resolveStats, sumBonuses } from './stats';
import type { SummonerSpellRecord } from './summoners';
import { BOT_BOOTS_SLOTS, roleQuestEffects, roleQuestLevelCap, smiteTier, supportItems, type Role, type RoleQuestItems } from './role-quests';
import type { ChampionBaseStats, ItemLimitGroup, ResolvedStats, ShardData, StatBonuses } from './types';

/** Inventory slots. Role quests will change this for bot lane (boots get their own slot); not modeled yet. */
export const MAX_ITEMS = hand('loadout.maxItems', 6, assumed('Standard inventory: six item slots'));
export const MAX_SUMMONERS = hand('loadout.maxSummoners', 2, assumed('Two summoner spell slots'));
/** Item tags that aren't part of a build here. */
const EXCLUDED_TAGS = ['Trinket', 'Consumable'] as const;
/** Default max ranks when there's no spell data; per-champion maxima come from the spell files. */
const DEFAULT_MAX_RANK = {
  basic: hand('loadout.defaultMaxRank.basic', 5, assumed('Standard basic ability max rank')),
  ultimate: hand('loadout.defaultMaxRank.ultimate', 3, assumed('Standard ultimate max rank')),
};
/** Levels at which each ultimate rank can be learned (the standard rule; some champions differ). */
/** A basic ability's rank N needs level 2N − 1: one rank per this many levels. */
const LEVELS_PER_BASIC_RANK = hand('loadout.levelsPerBasicRank', 2, assumed('Standard rule: basic ability rank N needs level 2N − 1'));
const ULTIMATE_LEVELS = [6, 11, 16].map((level, i) => hand(`loadout.ultimateLevel${i + 1}`, level, assumed('Standard ultimate rank levels')));

/** An item as written to items.json (the fields used here). */
export interface ItemRecord {
  id: string;
  name: string;
  /** Shop price, components included (Data Dragon's total). */
  gold: number;
  tags: string[];
  stats: StatBonuses;
}

/** A build's gold: what its inventory is worth, item by item. */
export interface BuildCost {
  total: number;
  /** In inventory order, duplicates included. */
  items: Array<{ id: string; cost: number }>;
}

/**
 * An item's cost in a build. Role quest upgrades replace the item they upgrade and cost
 * nothing to upgrade, so they count at that item's price: tier 3 boots at their tier 2's,
 * every form of the support item (Runic Compass, Bounty of Worlds and its upgrades, e.g.
 * Bloodsong) at the support starting item's (World Atlas). This holds even when the build is invalid. Components an item was built from aren't added;
 * its price already includes them.
 */
export function itemCost(id: string, data: Pick<LoadoutData, 'items' | 'roleQuests'>): number {
  const price = (itemId: string) => data.items.find((i) => i.id === itemId)?.gold ?? 0;
  const tier2 = Object.entries(data.roleQuests.bootsUpgrades).find(([, t3]) => t3 === id)?.[0];
  if (tier2) return price(tier2);
  if (supportItems(data.roleQuests).includes(id)) return price(data.roleQuests.supportStarter);
  return price(id);
}

/** A rune tree as written to runes.json (Data Dragon runesReforged). Row 0 holds the keystones. */
export interface RuneTree {
  id: number;
  name: string;
  slots: Array<{ runes: Array<{ id: number; name: string }> }>;
}

/** The patch data a loadout is resolved against. */
export interface LoadoutData {
  items: ItemRecord[];
  itemGroups: ItemLimitGroup[];
  runes: RuneTree[];
  shards: ShardData;
  /** Summoner's Rift summoner spells (summoners.json). */
  summoners: SummonerSpellRecord[];
  /** Role quest item structure (role-quests.json). */
  roleQuests: RoleQuestItems;
}

/** One champion's setup: the attacker, or the target dummy. */
export interface Loadout {
  stats: ChampionBaseStats;
  level: number;
  /** Hand-written champion definition and its spell data, for champion effects and rank checks. */
  champion?: { def: ChampionDefinition; spells: ChampionSpells };
  ranks?: Ranks;
  /** Item IDs in inventory order. Duplicates are allowed where the shop allows them. */
  items?: string[];
  /** Rune IDs: keystone, primary runes, then secondary runes. */
  runes?: number[];
  /** Stat shard IDs, one per row. */
  shards?: number[];
  /** Summoner spell Data Dragon IDs, e.g. ["SummonerFlash", "SummonerDot"]. */
  summoners?: string[];
  role?: Role;
  /** The role quest is completed (see role-quests.ts for what that changes). */
  roleQuestCompleted?: boolean;
  /** State overrides by effect ID (item/rune ID, or "<Champion>:<ability>"). */
  state?: Record<string, EffectState>;
  /** Current health as a fraction of max. */
  currentHpPct?: number;
}

export type LoadoutWarning =
  | { kind: 'unknownItem'; id: string }
  | { kind: 'excludedItem'; id: string; name: string; reason: (typeof EXCLUDED_TAGS)[number] }
  | { kind: 'tooManyItems'; count: number; max: number }
  | { kind: 'itemLimit'; group: ItemLimitGroup; items: string[] }
  | { kind: 'runePage'; message: string }
  | { kind: 'shard'; message: string }
  | { kind: 'skillRanks'; message: string }
  | { kind: 'summoners'; message: string }
  | { kind: 'level'; message: string }
  /**
   * An item the loadout's role can't hold: tier 3 boots need the completed mid quest, Bounty of
   * Worlds' upgrades the completed support quest, and the support item's stages the support role.
   */
  | { kind: 'roleItem'; id: string; name: string; needs: Role }
  /** A support without the support item (World Atlas or what it becomes). */
  | { kind: 'supportItem'; message: string }
  | { kind: 'roleQuest'; message: string };

export interface ResolvedLoadout {
  stats: ResolvedStats;
  /** Item, rune and champion effects with their state, for `computeHit` and `abilityHit`. */
  effects: ActiveEffect[];
  /** Flat bonuses from items and shards, before effects. */
  bonuses: StatBonuses;
  /** The loadout's known summoner spells, for `summonerHit`. */
  summoners: SummonerSpellRecord[];
  /** Smite's level for `summonerHit`. */
  smite: 'basic' | 'primal';
  /** Highest level the loadout can reach (20 with the top lane quest). */
  levelCap: number;
  /** The inventory's gold (skipped items don't count). */
  gold: BuildCost;
  /**
   * Problems that would make the build impossible in game. The loadout is still resolved
   * (excluded and unknown items are skipped), so "what if" setups keep working.
   */
  warnings: LoadoutWarning[];
}

/** Check a rune page: one keystone, a rune from each primary row, two secondary runes from different rows of another tree. */
export function checkRunePage(trees: RuneTree[], runeIds: number[]): string[] {
  if (runeIds.length === 0) return [];
  const where = new Map<number, { tree: RuneTree; row: number }>();
  for (const tree of trees) tree.slots.forEach((slot, row) => slot.runes.forEach((r) => where.set(r.id, { tree, row })));

  const problems: string[] = [];
  const known = runeIds.flatMap((id) => {
    const w = where.get(id);
    if (!w) problems.push(`Unknown rune ${id}`);
    return w ? [{ id, ...w }] : [];
  });
  const keystones = known.filter((r) => r.row === 0);
  if (keystones.length !== 1) {
    problems.push(`${keystones.length} keystones; a page has exactly one`);
    return problems;
  }
  const primary = keystones[0].tree;
  for (const row of [1, 2, 3]) {
    const n = known.filter((r) => r.tree === primary && r.row === row).length;
    if (n !== 1) problems.push(`${n} ${primary.name} runes in row ${row}; the primary tree needs one per row`);
  }
  const secondary = known.filter((r) => r.tree !== primary);
  const secondaryTrees = new Set(secondary.map((r) => r.tree.name));
  if (secondary.length !== 2) problems.push(`${secondary.length} secondary runes; a page has two`);
  if (secondaryTrees.size > 1) problems.push(`Secondary runes come from ${[...secondaryTrees].join(' and ')}; they must share one tree`);
  if (new Set(secondary.map((r) => `${r.tree.id}:${r.row}`)).size !== secondary.length) {
    problems.push('Two secondary runes share a row');
  }
  return problems;
}

function maxRankOf(spells: ChampionSpells | undefined, slot: Slot): number {
  const spell = spells && Object.values(spells).find((s) => s.slot === slot);
  return spell?.maxRank ?? (slot === 'R' ? DEFAULT_MAX_RANK.ultimate : DEFAULT_MAX_RANK.basic);
}

/**
 * Check skill ranks against the level, using the standard rules: one point per level,
 * a basic ability's rank N needs level 2N − 1, the ultimate's ranks need levels 6/11/16.
 * Champions with different rules (e.g. an ultimate at level 1) get warnings until they're
 * handled per champion.
 */
export function checkSkillRanks(ranks: Ranks, level: number, spells?: ChampionSpells, levelCap?: number): string[] {
  const lvl = clampLevel(level, levelCap);
  const problems: string[] = [];
  let total = 0;
  for (const slot of ['Q', 'W', 'E', 'R'] as const) {
    const rank = ranks[slot] ?? 0;
    if (rank <= 0) continue;
    total += rank;
    const max = maxRankOf(spells, slot);
    if (rank > max) problems.push(`${slot} rank ${rank} is above its max rank ${max}`);
    const needs = slot === 'R' ? ULTIMATE_LEVELS[Math.min(rank, ULTIMATE_LEVELS.length) - 1] : LEVELS_PER_BASIC_RANK * rank - 1;
    if (lvl < needs) problems.push(`${slot} rank ${rank} needs level ${needs}`);
  }
  if (total > lvl) problems.push(`${total} skill points spent at level ${lvl}`);
  return problems;
}

/**
 * Resolve a loadout against patch data: item and shard stats, item/rune/champion effects
 * with state, and the resolved stats. Each implemented effect is active once, however
 * many copies of its item are listed (unique passives don't stack).
 */
export function resolveLoadout(loadout: Loadout, data: LoadoutData): ResolvedLoadout {
  const warnings: LoadoutWarning[] = [];
  const byId = new Map(data.items.map((i) => [i.id, i]));

  const items = (loadout.items ?? []).filter((id) => {
    const item = byId.get(id);
    if (!item) {
      warnings.push({ kind: 'unknownItem', id });
      return false;
    }
    const excluded = EXCLUDED_TAGS.find((t) => item.tags.includes(t));
    if (excluded) {
      warnings.push({ kind: 'excludedItem', id, name: item.name, reason: excluded });
      return false;
    }
    return true;
  });
  const { role, roleQuestCompleted: done } = loadout;
  const quest = (r: Role) => role === r && !!done;
  const boots = new Set(data.roleQuests.boots);
  // The bot lane reward gives boots their own slot, outside the six.
  const ownSlot = quest('bot') ? Math.min(BOT_BOOTS_SLOTS, items.filter((id) => boots.has(id)).length) : 0;
  if (items.length - ownSlot > MAX_ITEMS) warnings.push({ kind: 'tooManyItems', count: items.length, max: MAX_ITEMS + ownSlot });
  const tier3Boots = new Set(Object.values(data.roleQuests.bootsUpgrades));
  const supportUpgrades = new Set(data.roleQuests.supportUpgrades);
  const supportStages = new Set(data.roleQuests.supportStages);
  // With no role there's no role binding, so the support item's stages are allowed.
  const offSupport = role !== undefined && role !== 'support';
  for (const id of new Set(items)) {
    const needs: Role | undefined =
      tier3Boots.has(id) && !quest('mid') ? 'mid'
      : (supportUpgrades.has(id) && !quest('support')) || (supportStages.has(id) && offSupport) ? 'support'
      : undefined;
    if (needs) warnings.push({ kind: 'roleItem', id, name: byId.get(id)!.name, needs });
  }
  if (role === 'support' && !items.some((id) => supportStages.has(id) || supportUpgrades.has(id))) {
    warnings.push({ kind: 'supportItem', message: 'A support needs the support item (World Atlas or what it becomes)' });
  }
  if (quest('jungle') && !items.some((id) => data.roleQuests.junglePets.includes(id))) {
    warnings.push({ kind: 'roleQuest', message: 'The jungle quest needs a jungle pet' });
  }
  const levelCap = roleQuestLevelCap(role, done);
  if (loadout.level > levelCap) warnings.push({ kind: 'level', message: `Level ${loadout.level} is above the level cap ${levelCap}` });
  for (const v of checkItemLimits(items, data.itemGroups)) warnings.push({ kind: 'itemLimit', ...v });

  const runes = loadout.runes ?? [];
  for (const message of checkRunePage(data.runes, runes)) warnings.push({ kind: 'runePage', message });

  const shardStats: StatBonuses[] = [];
  (loadout.shards ?? []).forEach((id, i) => {
    const row = data.shards.rows[i];
    const shard = data.shards.shards[id];
    if (!row) warnings.push({ kind: 'shard', message: `Shard ${id} is past the last row (${data.shards.rows.length} rows)` });
    else if (!shard || !row.options.includes(id)) warnings.push({ kind: 'shard', message: `Shard ${id} isn't an option in the ${row.label} row` });
    else shardStats.push(shardBonuses(shard, loadout.level));
  });

  const summonerIds = loadout.summoners ?? [];
  const summoners = [...new Set(summonerIds)].flatMap((id) => {
    const spell = data.summoners.find((s) => s.id === id);
    if (!spell) warnings.push({ kind: 'summoners', message: `Unknown summoner spell ${id}` });
    return spell ? [spell] : [];
  });
  if (summonerIds.length > MAX_SUMMONERS) {
    warnings.push({ kind: 'summoners', message: `${summonerIds.length} summoner spells; a loadout has ${MAX_SUMMONERS}` });
  }
  if (new Set(summonerIds).size !== summonerIds.length) warnings.push({ kind: 'summoners', message: 'The same summoner spell is taken twice' });

  const ranks = loadout.ranks ?? {};
  for (const message of checkSkillRanks(ranks, loadout.level, loadout.champion?.spells, levelCap)) warnings.push({ kind: 'skillRanks', message });

  const overrides = loadout.state ?? {};
  const effectIds = [...new Set([...items, ...runes.map(String)])];
  const effects: ActiveEffect[] = [
    ...effectIds.flatMap((id) => {
      const effect = getEffect(id);
      return effect ? [activate(effect, overrides[id])] : [];
    }),
    ...(loadout.champion
      ? championEffects(loadout.champion.def, loadout.champion.spells, ranks).map((a) => ({
          ...a,
          state: { ...a.state, ...overrides[a.effect.id] },
        }))
      : []),
    ...roleQuestEffects(role, done).map((e) => activate(e, overrides[e.id])),
  ];

  const bonuses = sumBonuses(...items.map((id) => byId.get(id)!.stats), ...shardStats);
  const stats = resolveStats(loadout.stats, loadout.level, bonuses, effects, { currentHpPct: loadout.currentHpPct, levelCap });
  const costs = items.map((id) => ({ id, cost: itemCost(id, data) }));
  const gold = { total: costs.reduce((sum, c) => sum + c.cost, 0), items: costs };
  return { stats, effects, bonuses, summoners, smite: smiteTier(role, done), levelCap, gold, warnings };
}
