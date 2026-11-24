import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Checks the committed items.json for the latest patch.
describe('committed items', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const items = JSON.parse(readFileSync(`public/data/${latest}/items.json`, 'utf8')) as Array<{
    id: string;
    name: string;
    from: string[];
    into: string[];
  }>;

  it('lists each item once, keeping the standard shop item (item-dedupe.ts)', () => {
    const names = items.map((i) => i.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const idOf = (name: string) => items.find((i) => i.name === name)?.id;
    expect(idOf('Frozen Heart')).toBe('3110');
    expect(idOf('Hextech Gunblade')).toBe('3146');
    expect(idOf('The Collector')).toBe('6676');
    expect(idOf('Scorchclaw Pup')).toBe('1101');
  });

  it('only links recipes to items in the list', () => {
    const ids = new Set(items.map((i) => i.id));
    expect(items.flatMap((i) => [...i.from, ...i.into]).filter((id) => !ids.has(id))).toEqual([]);
    const kindlegem = items.find((i) => i.name === 'Kindlegem');
    expect(kindlegem?.into).toContain('3050'); // Zeke's Convergence, not its 323050 variant
  });
});
