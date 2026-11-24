import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = <T>(file: string) => JSON.parse(readFileSync(file, 'utf8')) as T;

describe('adaptive-magic overrides', () => {
  const { champions: names } = readJson<{ champions: string[] }>('scripts/overrides/adaptive-magic.json');
  const { latest } = readJson<{ latest: string }>('public/data/manifest.json');
  const champions = readJson<Array<{ name: string; stats: { adaptiveType?: string } }>>(
    `public/data/${latest}/champions.json`,
  );

  it('has no duplicates', () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it('only names champions that exist in the latest data', () => {
    const known = new Set(champions.map((c) => c.name));
    expect(names.filter((n) => !known.has(n))).toEqual([]);
  });

  it('is applied to the committed champion data', () => {
    const listed = new Set(names);
    for (const c of champions) {
      expect(c.stats.adaptiveType, c.name).toBe(listed.has(c.name) ? 'ap' : 'ad');
    }
  });
});
