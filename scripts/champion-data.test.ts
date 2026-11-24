import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const champions = JSON.parse(readFileSync('public/data/16.20.1/champions.json', 'utf8')) as Array<{
  name: string;
  stats: Record<string, number | string>;
}>;
const stat = (name: string, key: string) => champions.find((c) => c.name === name)?.stats[key];

describe('champion data', () => {
  // Data Dragon ships 0 for everyone; fetch-data takes the value from the champion's game data.
  it('has AD per level from game data (values match the wiki)', () => {
    expect(stat('Vayne', 'attackdamageperlevel')).toBe(2.35);
    expect(stat('Darius', 'attackdamageperlevel')).toBe(5);
    expect(stat('Veigar', 'attackdamageperlevel')).toBe(2.7);
    expect(stat('Nasus', 'attackdamageperlevel')).toBe(4);
    expect(stat('Yunara', 'attackdamageperlevel')).toBe(3);
    // Senna really has no AD growth (her passive grants AD instead).
    expect(champions.filter((c) => c.stats.attackdamageperlevel === 0).map((c) => c.name)).toEqual(['Senna']);
  });
});
