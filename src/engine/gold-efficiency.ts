import { item, sourced } from './hand';
import type { StatBonuses } from './types';

/**
 * Gold efficiency (wiki: "Gold efficiency"): an item's gold value, the sum of its stats at
 * their gold per point, compared with its price. Only stats count; passives and actives don't.
 * Gold per point comes from reference items in the current patch's data, so it follows each
 * refresh; only the choice of reference items is fixed here (the wiki's, Module:Gold value/data).
 */
export type StatKey = keyof StatBonuses;
/** Gold per point of each valued stat, in engine units (e.g. per 1.0 crit chance, per 1% attack speed). */
export type StatGoldValues = Partial<Record<StatKey, number>>;

interface PricedItem {
  id: string;
  gold: number;
  stats: StatBonuses;
}

/** Basic stats: the cheapest item that gives only that stat. */
export const BASIC_REFERENCES: Partial<Record<StatKey, string>> = {
  ad: '1036', // Long Sword
  abilityHaste: '2022', // Glowing Mote
  ap: '1052', // Amplifying Tome
  armor: '1029', // Cloth Armor
  mr: '1033', // Null-Magic Mantle
  hp: '1028', // Ruby Crystal
  mana: '1027', // Sapphire Crystal
  baseHpRegenPct: '1006', // Rejuvenation Bead
  baseManaRegenPct: '1004', // Faerie Charm
  critChance: '1018', // Cloak of Agility
  attackSpeedPct: '1042', // Dagger
  moveSpeed: '1001', // Boots
};

/** Secondary stats: the rest of the item's price, after its basic stats, goes to this stat. */
export const SECONDARY_REFERENCES: Partial<Record<StatKey, string>> = {
  armorPenPct: '3035', // Last Whisper
  healShieldPower: '3114', // Forbidden Idol
  lethality: '3134', // Serrated Dirk
  lifeSteal: '1053', // Vampiric Scepter
  magicPenFlat: '3020', // Sorcerer's Shoes
  magicPenPct: '4630', // Blighting Jewel
  omnivamp: '3008', // Gluttonous Greaves
  tenacity: '3111', // Mercury's Treads
};

/** Percent move speed: averaged over the epic items that give it. */
export const MOVE_SPEED_PCT_REFERENCES = ['3113', '6690', '3066', '3086']; // Aether Wisp, Rectrix, Winged Moonplate, Zeal

/** The wiki values Gluttonous Greaves' omnivamp at full passive stacks, on top of its stat. */
const GLUTTONOUS_PASSIVE_OMNIVAMP =
  sourced('goldValue.gluttonous.omnivampPerStack', item('3008', 'OmnivampOnTakedown', 0.006)) *
  sourced('goldValue.gluttonous.maxStacks', item('3008', 'MaxStacks', 10));
const EXTRA_REFERENCE_AMOUNT: Partial<Record<StatKey, number>> = { omnivamp: GLUTTONOUS_PASSIVE_OMNIVAMP };

const statEntries = (stats: StatBonuses) => Object.entries(stats) as Array<[StatKey, number]>;
const valueOf = (stats: StatBonuses, values: StatGoldValues, except?: StatKey) =>
  statEntries(stats).reduce((sum, [k, v]) => (k === except ? sum : sum + v * (values[k] ?? 0)), 0);

const cache = new WeakMap<readonly PricedItem[], StatGoldValues>();

/** Gold per point of each stat, from the reference items. A stat whose reference is missing isn't valued. */
export function statGoldValues(items: readonly PricedItem[]): StatGoldValues {
  const cached = cache.get(items);
  if (cached) return cached;
  const byId = new Map(items.map((i) => [i.id, i]));
  const values: StatGoldValues = {};
  for (const [stat, id] of Object.entries(BASIC_REFERENCES) as Array<[StatKey, string]>) {
    const ref = byId.get(id);
    const amount = ref?.stats[stat];
    if (ref && amount) values[stat] = ref.gold / amount;
  }
  const basic = { ...values };
  for (const [stat, id] of Object.entries(SECONDARY_REFERENCES) as Array<[StatKey, string]>) {
    const ref = byId.get(id);
    const amount = (ref?.stats[stat] ?? 0) + (EXTRA_REFERENCE_AMOUNT[stat] ?? 0);
    if (ref && amount) values[stat] = (ref.gold - valueOf(ref.stats, basic, stat)) / amount;
  }
  // The average of the rest of each price over the average percent: sum over sum.
  const epics = MOVE_SPEED_PCT_REFERENCES.flatMap((id) => {
    const ref = byId.get(id);
    return ref?.stats.moveSpeedPct ? [ref] : [];
  });
  const msPct = epics.reduce((sum, r) => sum + r.stats.moveSpeedPct!, 0);
  if (msPct) values.moveSpeedPct = epics.reduce((sum, r) => sum + r.gold - valueOf(r.stats, basic, 'moveSpeedPct'), 0) / msPct;
  cache.set(items, values);
  return values;
}

/** Reference items that no longer fit their role in the data (checked by a test after a refresh). */
export function referenceProblems(items: readonly PricedItem[]): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const problems: string[] = [];
  const basicStats = new Set(Object.keys(BASIC_REFERENCES));
  for (const [stat, id] of Object.entries(BASIC_REFERENCES)) {
    const ref = byId.get(id);
    if (!ref) problems.push(`${stat}: reference item ${id} is missing`);
    else if (Object.keys(ref.stats).join() !== stat) problems.push(`${stat}: reference item ${id} gives ${Object.keys(ref.stats).join(', ') || 'nothing'}`);
  }
  const secondary = [...Object.entries(SECONDARY_REFERENCES), ...MOVE_SPEED_PCT_REFERENCES.map((id) => ['moveSpeedPct', id] as const)];
  for (const [stat, id] of secondary) {
    const ref = byId.get(id);
    if (!ref) problems.push(`${stat}: reference item ${id} is missing`);
    else if (!(stat in ref.stats)) problems.push(`${stat}: reference item ${id} no longer gives it`);
    else {
      const others = Object.keys(ref.stats).filter((k) => k !== stat && !basicStats.has(k));
      if (others.length) problems.push(`${stat}: reference item ${id} also gives ${others.join(', ')}, which have no basic value`);
    }
  }
  return problems;
}

export interface GoldValue {
  /** Gold value of the stats. */
  value: number;
  /** Gold value ÷ price (1 = 100%); undefined for a free item. */
  efficiency?: number;
  /** Gold value of each valued stat. */
  byStat: StatGoldValues;
  /** Stats with no gold value (e.g. crit damage, gold per 10 seconds); they add nothing. */
  notValued: StatKey[];
}

/** Gold value of a set of stats at a price (an item's build cost). */
export function goldValue(stats: StatBonuses, price: number, values: StatGoldValues): GoldValue {
  const byStat: StatGoldValues = {};
  const notValued: StatKey[] = [];
  for (const [stat, amount] of statEntries(stats)) {
    const perPoint = values[stat];
    if (perPoint === undefined) notValued.push(stat);
    else byStat[stat] = amount * perPoint;
  }
  const value = Object.values(byStat).reduce((sum, v) => sum + v, 0);
  return { value, efficiency: price > 0 ? value / price : undefined, byStat, notValued };
}
