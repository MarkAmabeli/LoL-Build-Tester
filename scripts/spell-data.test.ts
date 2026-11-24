import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Checks the committed spell files for the latest patch. Structure only,
// so this keeps passing as values change between patches.
describe('committed spell data', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const dir = `public/data/${latest}/spells`;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const spells = files.flatMap((f) =>
    Object.entries(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Record<string, { dataValues: Record<string, number[]> }>)
      .map(([name, spell]) => ({ file: f, name, keys: Object.keys(spell.dataValues) })),
  );

  it('names every data value (no "undefined" or empty keys from a bin field rename)', () => {
    for (const s of spells) {
      expect(s.keys.filter((k) => k === 'undefined' || k === ''), `${s.file} ${s.name}`).toEqual([]);
    }
  });

  it('has one cooldown, cost and range value per rank where present', () => {
    for (const f of files) {
      const records = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Record<string, Record<string, unknown> & { maxRank: number }>;
      for (const [name, spell] of Object.entries(records)) {
        for (const key of ['cooldown', 'cost', 'range']) {
          const values = spell[key] as number[] | undefined;
          if (values !== undefined) expect(values.length, `${f} ${name} ${key}`).toBe(spell.maxRank);
        }
      }
    }
  });

  it('reads data values for every champion', () => {
    const withValues = new Set(spells.filter((s) => s.keys.length > 0).map((s) => s.file));
    expect(files.filter((f) => !withValues.has(f))).toEqual([]);
  });
});
