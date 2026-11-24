import { describe, expect, it } from 'vitest';
import { dedupeItemsByName } from './item-dedupe.ts';

const maps = (...ids: string[]) => Object.fromEntries(['11', '12', '453'].map((m) => [m, ids.includes(m)]));

describe('dedupeItemsByName', () => {
  it('keeps the entry on the most maps, then the lowest ID', () => {
    const { items, dropped } = dedupeItemsByName([
      { id: '323110', name: 'Frozen Heart', maps: maps('11') },
      { id: '3110', name: 'Frozen Heart', maps: maps('11', '12', '453') },
      { id: '1107', name: 'Scorchclaw Pup', maps: maps('11') },
      { id: '1101', name: 'Scorchclaw Pup', maps: maps('11', '453') },
      { id: '3', name: 'Same Maps', maps: maps('11') },
      { id: '2', name: 'Same Maps', maps: maps('11') },
      { id: '3031', name: 'Infinity Edge', maps: maps('11', '12') },
    ]);
    expect(items.map((i) => i.id)).toEqual(['3110', '1101', '2', '3031']);
    expect(dropped).toEqual([
      { name: 'Frozen Heart', kept: '3110', dropped: ['323110'] },
      { name: 'Same Maps', kept: '2', dropped: ['3'] },
      { name: 'Scorchclaw Pup', kept: '1101', dropped: ['1107'] },
    ]);
  });
});
