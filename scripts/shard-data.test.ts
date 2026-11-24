import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ShardData } from '../src/engine/types.ts';

// Checks the committed shards.json for the latest patch. Structure only,
// so this keeps passing as values change between patches.
describe('committed shard data', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const data = JSON.parse(readFileSync(`public/data/${latest}/shards.json`, 'utf8')) as ShardData;

  it('has a shard entry for every row option', () => {
    expect(data.rows.length).toBeGreaterThan(0);
    for (const row of data.rows) for (const id of row.options) expect(data.shards[id]).toBeDefined();
  });

  it('gives every shard either stats or an unmodeled note', () => {
    for (const shard of Object.values(data.shards)) {
      const modeled = Object.keys(shard.stats).length > 0 || (shard.scaling?.length ?? 0) > 0;
      expect(modeled || (shard.unmodeled?.length ?? 0) > 0, shard.name).toBe(true);
    }
  });
});
