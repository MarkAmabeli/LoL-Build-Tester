import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ItemLimitGroup } from '../src/engine/types.ts';

// Checks the committed item-groups.json for the latest patch.
describe('committed item limit groups', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const groups = JSON.parse(readFileSync(`public/data/${latest}/item-groups.json`, 'utf8')) as ItemLimitGroup[];
  const items = JSON.parse(readFileSync(`public/data/${latest}/items.json`, 'utf8')) as Array<{ id: string; name: string }>;
  const idOf = (name: string) => items.find((i) => i.name === name)?.id;

  it('limits Spellblade and Last Whisper items to one', () => {
    const named = (n: string) => groups.find((g) => g.name === n);
    expect(named('Spellblade')).toMatchObject({ max: 1 });
    expect(named('Spellblade')?.items).toEqual(expect.arrayContaining([idOf('Trinity Force'), idOf('Lich Bane')]));
    expect(named('LastWhisper')?.items).toEqual(expect.arrayContaining([idOf('Black Cleaver'), idOf("Lord Dominik's Regards")]));
  });

  it('only references items in items.json', () => {
    const ids = new Set(items.map((i) => i.id));
    for (const g of groups) for (const id of g.items) expect(ids.has(id), `${g.name}: ${id}`).toBe(true);
  });
});
