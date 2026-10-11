import { describe, expect, it } from 'vitest';
import { resolveStats } from './stats';
import { summonerHit, type SummonerSpellRecord } from './summoners';
import type { ChampionBaseStats } from './types';

const files = import.meta.glob<unknown>(['/public/data/manifest.json', '/public/data/*/summoners.json'], { eager: true, import: 'default' });
const { latest } = files['/public/data/manifest.json'] as { latest: string };
const summoners = files[`/public/data/${latest}/summoners.json`] as SummonerSpellRecord[];
const spell = (id: string) => summoners.find((s) => s.id === id)!;

// Same synthetic champion as engine.test.ts.
const dummy: ChampionBaseStats = {
  hp: 600, hpperlevel: 100,
  mp: 300, mpperlevel: 50,
  armor: 30, armorperlevel: 4,
  spellblock: 30, spellblockperlevel: 2,
  attackdamage: 60, attackdamageperlevel: 3,
  attackspeed: 0.625, attackspeedperlevel: 2,
  movespeed: 330, attackrange: 550,
};
const target = { stats: resolveStats(dummy, 18, { armor: 200, mr: 200 }) };

describe('Ignite', () => {
  const at = (level: number) => summonerHit(spell('SummonerDot'), { attacker: resolveStats(dummy, level), target });

  it('deals 70 true damage, +20 per level through 5, then +25 per level (wiki)', () => {
    expect(at(1).total).toBe(70);
    expect(at(5).total).toBe(150);
    expect(at(6).total).toBe(175);
    expect(at(18).total).toBe(475);
  });

  it('is true damage over time, ignoring armor and MR', () => {
    expect(at(1).hits).toEqual([expect.objectContaining({ type: 'true', raw: 70, final: 70, tags: ['summoner', 'dot'] })]);
  });
});

it('summoner spells without damage deal nothing', () => {
  expect(summonerHit(spell('SummonerFlash'), { attacker: resolveStats(dummy, 1), target })).toEqual({ hits: [], total: 0 });
});
