import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareWikiPatch, dataPatchToWiki, parseChampionChanges, type WikiSources } from './wiki-sources.ts';

describe('wiki patch helpers', () => {
  it('maps Data Dragon versions to wiki patch names', () => {
    expect(dataPatchToWiki('16.20.1')).toBe('V26.20');
    expect(dataPatchToWiki('16.7.1')).toBe('V26.07');
  });

  it('orders wiki patches', () => {
    expect(compareWikiPatch('V26.07', 'V26.20')).toBeLessThan(0);
    expect(compareWikiPatch('V26.20', 'V26.20')).toBe(0);
    expect(compareWikiPatch('V27.01', 'V26.24')).toBeGreaterThan(0);
  });

  it('reads each champion\'s changes value from the module source', () => {
    const lua = `return {
  ["Veigar"] = {
    ["id"]         = 45,
    ["stats"] = { ["hp_base"]  = 580 },
    ["changes"]     = "V26.07",
  },
  ["Vel'Koz"] = {
    ["id"]         = 161,
    ["changes"]     = "V25.S1.1",
  },
}`;
    expect([...parseChampionChanges(lua)]).toEqual([['Veigar', 'V26.07'], ["Vel'Koz", 'V25.S1.1']]);
  });
});

describe('committed wiki sources', () => {
  const sources = JSON.parse(readFileSync('src/engine/champions/wiki-sources.json', 'utf8')) as WikiSources;
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };

  it('records a source for every champion definition', () => {
    const defined = readFileSync('src/engine/champions/registry.ts', 'utf8').match(/\[([a-z, ]+)\]\.map/)?.[1].split(/,\s*/) ?? [];
    expect(Object.keys(sources.champions).map((c) => c.toLowerCase()).sort()).toEqual(defined.sort());
  });

  it("was checked against the current data patch, and the wiki wasn't ahead of it", () => {
    for (const [champion, entry] of Object.entries(sources.champions)) {
      expect(`${entry.checkedPatch}`, champion).toBe(latest.split('.').slice(0, 2).join('.'));
      expect(compareWikiPatch(entry.changes, dataPatchToWiki(latest)), champion).toBeLessThanOrEqual(0);
    }
  });
});
