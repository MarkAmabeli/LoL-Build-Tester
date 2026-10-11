import { describe, expect, it } from 'vitest';
import type { ChampionSpells } from './champions/types';
import { HAND_ENTERED, type HandEntered } from './hand';
import './index'; // loads every effect, champion and engine module, so all declarations register

// The latest committed data (no Node APIs in src, so via Vite).
const data = import.meta.glob<unknown>(
  ['/public/data/manifest.json', '/public/data/*/{game-values,items,runes}.json', '/src/engine/champions/wiki-sources.json'],
  { eager: true, import: 'default' },
);
const spellFiles = import.meta.glob<ChampionSpells>('/public/data/*/spells/*.json', { import: 'default' });
const { latest } = data['/public/data/manifest.json'] as { latest: string };
const file = <T,>(name: string) => {
  const f = data[`/public/data/${latest}/${name}`];
  if (!f) throw new Error(`no ${name} for ${latest}`);
  return f as T;
};
type ValueMap = Record<string, number>;
const gameValues = file<{ items: Record<string, ValueMap>; perks: Record<string, ValueMap>; champions: Record<string, ValueMap> }>('game-values.json');
const items = file<Array<{ id: string; description: string }>>('items.json');
const runes = file<Array<{ slots: Array<{ runes: Array<{ id: number; longDesc: string }> }> }>>('runes.json');
const wikiSources = data['/src/engine/champions/wiki-sources.json'] as {
  champions: Record<string, { pages: Array<{ page: string }> }>;
  pages?: Array<{ page: string }>;
};

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const itemText = new Map(items.map((i) => [i.id, plain(i.description)]));
const runeText = new Map(runes.flatMap((t) => t.slots.flatMap((s) => s.runes.map((r) => [r.id, plain(r.longDesc)] as const))));
const wikiPages = new Set([
  ...Object.values(wikiSources.champions).flatMap((c) => c.pages.map((p) => p.page)),
  ...(wikiSources.pages ?? []).map((p) => p.page),
]);

/** The source's current value, or a problem with the source itself. */
async function current(e: HandEntered): Promise<{ value?: number; problem?: string }> {
  const s = e.source;
  const read = (map: ValueMap | undefined, where: string, key: string) =>
    map && key in map ? { value: map[key] } : { problem: `${where} has no "${key}"` };
  switch (s.kind) {
    case 'item': return read(gameValues.items[s.id], `item ${s.id}`, s.key);
    case 'perk': return read(gameValues.perks[s.id], `rune ${s.id}`, s.key);
    case 'champion': return read(gameValues.champions[s.id], `champion ${s.id}`, s.key);
    case 'spell': {
      const load = spellFiles[`/public/data/${latest}/spells/${s.champion}.json`];
      const values = load ? (await load())[s.spell]?.dataValues[s.key] : undefined;
      return values ? { value: values[Math.min(s.rank, values.length - 1)] } : { problem: `${s.champion} ${s.spell} has no "${s.key}"` };
    }
    case 'description': {
      const text = s.item !== undefined ? itemText.get(s.item) : runeText.get(s.rune!);
      if (text === undefined) return { problem: `no description for ${s.item ?? s.rune}` };
      return text.includes(s.contains) ? {} : { problem: `description no longer says "${s.contains}"` };
    }
    case 'wiki': return wikiPages.has(s.page) ? {} : { problem: `wiki page "${s.page}" isn't recorded in wiki-sources.json` };
    case 'assumption': return {};
  }
}

describe('hand-entered values', () => {
  it('have unique IDs', () => {
    const ids = HAND_ENTERED.map((e) => e.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  // The flag after a data refresh: a source value differs from the one recorded when the
  // value was entered. Differences that were already there (unit changes, interpretations)
  // don't count, since they're recorded as the checked value.
  it(`match their sources in the latest data (${latest})`, async () => {
    const problems: string[] = [];
    for (const e of HAND_ENTERED) {
      const now = await current(e);
      if (now.problem) problems.push(`${e.id}: ${now.problem}`);
      else if ('checked' in e.source && now.value !== e.source.checked) {
        problems.push(`${e.id}: source changed from ${e.source.checked} to ${now.value} (engine uses ${e.value ?? 'nothing (not applied)'})`);
      }
    }
    expect(problems).toEqual([]);
  });
});

// Gameplay numbers must be declared through hand.ts. This scans the effect and champion
// files (and the top-level constants of stats.ts and loadout.ts) for numeric literals
// outside a declaration. 0, 1 and 100 (percent conversion) are allowed everywhere.
const sources = import.meta.glob<string>(
  ['./effects/**/*.ts', './champions/*.ts', './stats.ts', './loadout.ts', '!./**/*.test.ts'],
  { eager: true, query: '?raw', import: 'default' },
);
/** Framework files with no gameplay numbers of their own. */
const FRAMEWORK = new Set([
  './effects/cycles.ts', './effects/types.ts', './effects/registry.ts', './effects/amplify.ts', './effects/index.ts',
  './effects/runes/adaptive.ts', './champions/types.ts', './champions/registry.ts', './champions/index.ts', './champions/spells.ts',
]);
/** Plain arithmetic, not gameplay values. */
const ARITHMETIC = ['(n + 1)) / 2'];
const TOP_LEVEL_ONLY = new Set(['./stats.ts', './loadout.ts']);

function undeclaredNumbers(path: string, source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat(m.split('\n').length - 1))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`[^`]*`/g, '``');
  return stripped.split('\n').flatMap((line, i) => {
    if (TOP_LEVEL_ONLY.has(path) && !/^(export )?const /.test(line)) return [];
    if (/\b(hand|sourced|notApplied)\(/.test(line) || line.includes('scope:')) return [];
    if (ARITHMETIC.some((a) => line.includes(a))) return [];
    const numbers = (line.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? []).filter((n) => !['0', '1', '100'].includes(n));
    return numbers.length > 0 ? [`${path}:${i + 1}: ${numbers.join(', ')} in "${line.trim()}"`] : [];
  });
}

describe('undeclared gameplay numbers', () => {
  it('there are none in effect and champion files', () => {
    const found = Object.entries(sources)
      .filter(([path]) => !FRAMEWORK.has(path))
      .flatMap(([path, source]) => undeclaredNumbers(path, source));
    expect(found).toEqual([]);
  });

  it('the scan catches a bare constant', () => {
    expect(undeclaredNumbers('./effects/items/x.ts', 'const DAMAGE = 45;\nconst OK = sourced(\'x\', item(\'1\', \'k\', 45));')).toHaveLength(1);
  });
});
