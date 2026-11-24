import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Checks the committed summoners.json for the latest patch.
describe('committed summoner spells', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const summoners = JSON.parse(readFileSync(`public/data/${latest}/summoners.json`, 'utf8')) as Array<{
    id: string;
    name: string;
    cooldown?: number;
    formulas: Record<string, unknown>;
    unsupported: Record<string, string>;
  }>;

  it("lists Summoner's Rift spells with values from the game data", () => {
    expect(summoners.map((s) => s.id)).toEqual(expect.arrayContaining(['SummonerFlash', 'SummonerDot', 'SummonerExhaust', 'SummonerSmite']));
    expect(summoners.every((s) => s.cooldown !== undefined)).toBe(true);
  });

  it("translates Ignite's damage", () => {
    const ignite = summoners.find((s) => s.id === 'SummonerDot');
    expect(ignite?.formulas.TooltipTrueDamageCalculation).toBeDefined();
    expect(ignite?.unsupported).toEqual({});
  });
});
