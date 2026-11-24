import { describe, expect, it } from 'vitest';
import { cooldownByRank, costByRank, rangeByRank } from './spell-ranks.ts';

describe('spell ranks', () => {
  it('reads cooldowns from entry 1 (entry 0 is a placeholder)', () => {
    // Vayne Condemn (wiki: 20–12).
    expect(cooldownByRank([22, 20, 18, 16, 14, 12, 12], 5)).toEqual([20, 18, 16, 14, 12]);
    // Vayne Final Hour (wiki: 100–70), 3 ranks.
    expect(cooldownByRank([100, 100, 85, 70, 70, 70, 70], 3)).toEqual([100, 85, 70]);
  });

  it('reads costs from entry 0 (no placeholder)', () => {
    // Draven Blood Rush: 40/35/30/25/20 mana.
    expect(costByRank([40, 35, 30, 25, 20, 15], 5)).toEqual([40, 35, 30, 25, 20]);
  });

  it('treats missing or all-zero cooldowns and costs as unknown or free', () => {
    expect(cooldownByRank(undefined, 5)).toBeUndefined();
    expect(cooldownByRank([0, 0, 0, 0, 0, 0, 0], 5)).toBeUndefined();
    expect(costByRank([0, 0, 0, 0, 0, 0], 5)).toBeUndefined();
  });

  it('repeats the last entry when an array is shorter than the ranks', () => {
    expect(cooldownByRank([0, 10], 3)).toEqual([10, 10, 10]);
  });

  it('drops placeholder ranges', () => {
    expect(rangeByRank([550, 550, 550, 550, 550, 550, 550], 5)).toEqual([550, 550, 550, 550, 550]);
    expect(rangeByRank(Array(7).fill(25000), 5)).toBeUndefined();
    expect(rangeByRank(Array(7).fill(1), 3)).toBeUndefined();
    expect(rangeByRank(Array(7).fill(0), 5)).toBeUndefined();
  });
});
