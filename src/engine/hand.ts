/**
 * Hand-entered values: every gameplay number the engine hard-codes, declared with where it
 * comes from and the source value it was checked against. Declaring them through `sourced`
 * or `hand` puts each in HAND_ENTERED, so the full set can be listed and checked:
 *
 *   - hand-entered.test.ts compares every source value against the latest data (game-values.json,
 *     spell files, item and rune descriptions) and fails when one changed since it was
 *     checked, so a data refresh flags it. A difference that was already there when the
 *     value was entered (a deliberate interpretation, a unit change) isn't flagged.
 *   - The same test fails on numbers in effect and champion files that aren't declared
 *     here, so none goes untracked.
 *
 * Call these at module top level only, one declaration per line. IDs are "<effect>.<value>",
 * e.g. "electrocute.damageBase", and must be unique.
 */

/** Where a value comes from. Checkable sources carry the value they were checked against. */
export type HandSource =
  /** CommunityDragon items bin, Items/<id>: a data value name, or "calc:<Calculation>.<part>.<field>". */
  | { kind: 'item'; id: string; key: string; checked: number }
  /** CommunityDragon perks bin: the rune's mEffectAmount value. */
  | { kind: 'perk'; id: string; key: string; checked: number }
  /** A champion bin's CharacterRecords/Root value. */
  | { kind: 'champion'; id: string; key: string; checked: number }
  /** A data value in the committed spell files, at a rank (entry `rank` of the list). */
  | { kind: 'spell'; champion: string; spell: string; key: string; rank: number; checked: number }
  /** In-game description text (Data Dragon item description or rune long description). */
  | { kind: 'description'; item?: string; rune?: number; contains: string }
  /** A wiki page recorded in src/engine/champions/wiki-sources.json (`npm run wiki:check` tracks revisions). */
  | { kind: 'wiki'; page: string; says: string }
  /** Nothing states it; the engine's own choice. */
  | { kind: 'assumption'; why: string };

export interface HandEntered {
  id: string;
  /** The value the engine uses; null when the source value is deliberately not applied. */
  value: number | null;
  source: HandSource;
  /** Why the value differs from the source, or how it's interpreted. */
  note?: string;
}

const REGISTRY: HandEntered[] = [];

/** Every declared hand-entered value, in declaration order. */
export const HAND_ENTERED: readonly HandEntered[] = REGISTRY;

function register(entry: HandEntered) {
  const existing = REGISTRY.find((e) => e.id === entry.id);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(entry)) throw new Error(`Hand-entered value "${entry.id}" declared twice`);
    return;
  }
  REGISTRY.push(entry);
}

const checkedOf = (source: HandSource): number => {
  if ('checked' in source) return source.checked;
  throw new Error(`A ${source.kind} source has no checked value; use hand() with an explicit value`);
};

/** A value taken as is from a checkable source: the value is the source's checked value. */
export function sourced(id: string, source: HandSource & { checked: number }): number {
  register({ id, value: source.checked, source });
  return source.checked;
}

/** A value that differs from its source (a unit change, an interpretation) or has no numeric source. */
export function hand(id: string, value: number, source: HandSource, note?: string): number {
  register({ id, value, source, ...(note ? { note } : {}) });
  return value;
}

/** A source value deliberately not applied (e.g. not described in game). Tracked so a change to it is flagged too. */
export function notApplied(id: string, source: HandSource & { checked: number }, why: string): void {
  checkedOf(source);
  register({ id, value: null, source, note: why });
}

// Source builders.
export const item = (id: string, key: string, checked: number): HandSource & { checked: number } => ({ kind: 'item', id, key, checked });
export const perk = (id: string, key: string, checked: number): HandSource & { checked: number } => ({ kind: 'perk', id, key, checked });
export const champion = (id: string, key: string, checked: number): HandSource & { checked: number } => ({ kind: 'champion', id, key, checked });
export const spell = (championId: string, spellName: string, key: string, checked: number, rank = 1): HandSource & { checked: number } =>
  ({ kind: 'spell', champion: championId, spell: spellName, key, rank, checked });
export const itemText = (id: string, contains: string): HandSource => ({ kind: 'description', item: id, contains });
export const runeText = (id: number, contains: string): HandSource => ({ kind: 'description', rune: id, contains });
export const wiki = (page: string, says: string): HandSource => ({ kind: 'wiki', page, says });
export const assumed = (why: string): HandSource => ({ kind: 'assumption', why });
