import { championEffects } from './champions';
import type { ChampionDefinition, ChampionSpells, Ranks, Slot } from './champions/types';
import { activate, getEffect } from './effects/registry';
import type { ActiveEffect, EffectState } from './effects/types';
import { checkItemLimits } from './items';
import { shardBonuses } from './shards';
import { clampLevel, resolveStats, sumBonuses } from './stats';
import type { ChampionBaseStats, ItemLimitGroup, ResolvedStats, ShardData, StatBonuses } from './types';

/** Inventory slots. Role quests will change this for bot lane (boots get their own slot); not modeled yet. */
export const MAX_ITEMS = 6;
/** Item tags that aren't part of a build here. */
const EXCLUDED_TAGS = ['Trinket', 'Consumable'] as const;
/** Default max ranks when there's no spell data; per-champion maxima come from the spell files. */
const DEFAULT_MAX_RANK = { basic: 5, ultimate: 3 };
/** Levels at which each ultimate rank can be learned (the standard rule; some champions differ). */
const ULTIMATE_LEVELS = [6, 11, 16];

/** An item as written to items.json (the fields used here). */
export interface ItemRecord {
  id: string;
  name: string;
  tags: string[];
  stats: StatBonuses;
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
  | { kind: 'skillRanks'; message: string };

export interface ResolvedLoadout {
  stats: ResolvedStats;
  /** Item, rune and champion effects with their state, for `computeHit` and `abilityHit`. */
  effects: ActiveEffect[];
  /** Flat bonuses from items and shards, before effects. */
  bonuses: StatBonuses;
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
export function checkSkillRanks(ranks: Ranks, level: number, spells?: ChampionSpells): string[] {
  const lvl = clampLevel(level);
  const problems: string[] = [];
  let total = 0;
  for (const slot of ['Q', 'W', 'E', 'R'] as const) {
    const rank = ranks[slot] ?? 0;
    if (rank <= 0) continue;
    total += rank;
    const max = maxRankOf(spells, slot);
    if (rank > max) problems.push(`${slot} rank ${rank} is above its max rank ${max}`);
    const needs = slot === 'R' ? ULTIMATE_LEVELS[Math.min(rank, ULTIMATE_LEVELS.length) - 1] : 2 * rank - 1;
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
  if (items.length > MAX_ITEMS) warnings.push({ kind: 'tooManyItems', count: items.length, max: MAX_ITEMS });
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

  const ranks = loadout.ranks ?? {};
  for (const message of checkSkillRanks(ranks, loadout.level, loadout.champion?.spells)) warnings.push({ kind: 'skillRanks', message });

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
  ];

  const bonuses = sumBonuses(...items.map((id) => byId.get(id)!.stats), ...shardStats);
  const stats = resolveStats(loadout.stats, loadout.level, bonuses, effects, { currentHpPct: loadout.currentHpPct });
  return { stats, effects, bonuses, warnings };
}
