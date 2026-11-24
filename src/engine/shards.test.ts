import { describe, expect, it } from 'vitest';
import {
  activate,
  adaptiveSplit,
  getEffect,
  resolveStats,
  scaledStatAt,
  shardPageBonuses,
  type ChampionBaseStats,
  type ShardData,
} from './index';

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

// Shard rows and values as of patch 16.20, trimmed to what the tests use.
const shardData: ShardData = {
  rows: [
    { label: 'Offense', options: [5008, 5005, 5007] },
    { label: 'Flex', options: [5008, 5010, 5001] },
    { label: 'Defense', options: [5011, 5013, 5001] },
  ],
  shards: {
    5001: { id: 5001, name: 'Health Scaling', description: '', icon: '', stats: {}, scaling: [{ stat: 'hp', from: 10, to: 180 }] },
    5005: { id: 5005, name: 'Attack Speed', description: '', icon: '', stats: { attackSpeedPct: 10 } },
    5007: { id: 5007, name: 'Ability Haste', description: '', icon: '', stats: { abilityHaste: 8 } },
    5008: { id: 5008, name: 'Adaptive Force', description: '', icon: '', stats: { adaptiveForce: 9 } },
    5010: { id: 5010, name: 'Move Speed', description: '', icon: '', stats: { moveSpeedPct: 0.025 } },
    5011: { id: 5011, name: 'Health', description: '', icon: '', stats: { hp: 65 } },
    5013: { id: 5013, name: 'Tenacity and Slow Resist', description: '', icon: '', stats: {}, unmodeled: ['+15% Tenacity and Slow Resist'] },
  },
};

describe('adaptiveSplit', () => {
  it('grants 0.6 AD per point by default', () => {
    expect(adaptiveSplit(9, 0, 0)).toEqual({ ad: 9 * 0.6, ap: 0 });
  });
  it('grants 1 AP per point when bonus AP is higher', () => {
    expect(adaptiveSplit(9, 10, 20)).toEqual({ ad: 0, ap: 9 });
  });
  it('uses the tie-break when bonuses are equal', () => {
    expect(adaptiveSplit(9, 0, 0, 'ap')).toEqual({ ad: 0, ap: 9 });
    expect(adaptiveSplit(9, 30, 20, 'ap')).toEqual({ ad: 9 * 0.6, ap: 0 });
  });
});

describe('resolveStats with shard bonuses', () => {
  it('converts adaptive force into bonus AD', () => {
    const s = resolveStats(dummy, 1, { adaptiveForce: 9 });
    expect(s.ad.bonus).toBeCloseTo(5.4);
    expect(s.ap).toBe(0);
  });

  it('follows the champion adaptive type on a tie', () => {
    expect(resolveStats({ ...dummy, adaptiveType: 'ap' }, 1, { adaptiveForce: 9 }).ap).toBe(9);
  });

  it("converts adaptive force before Rabadon's multiplies AP", () => {
    const s = resolveStats(dummy, 1, { ap: 100, adaptiveForce: 9 }, [activate(getEffect('3089')!)]);
    expect(s.ap).toBeCloseTo(109 * 1.3);
  });

  it('applies percent move speed after flat', () => {
    expect(resolveStats(dummy, 1, { moveSpeed: 20, moveSpeedPct: 0.025 }).moveSpeed).toBeCloseTo(350 * 1.025);
  });
});

describe('shards', () => {
  it('scales level-based stats linearly from level 1 to 18', () => {
    const hp = { stat: 'hp' as const, from: 10, to: 180 };
    expect(scaledStatAt(hp, 1)).toBe(10);
    expect(scaledStatAt(hp, 10)).toBe(100);
    expect(scaledStatAt(hp, 18)).toBe(180);
  });

  it('sums a page, counting a shard picked in two rows twice', () => {
    expect(shardPageBonuses(shardData, [5008, 5008, 5001], 18)).toEqual({ adaptiveForce: 18, hp: 180 });
  });

  it('ignores unmodeled shards', () => {
    expect(shardPageBonuses(shardData, [5005, 5010, 5013], 1)).toEqual({ attackSpeedPct: 10, moveSpeedPct: 0.025 });
  });

  it('rejects a shard in the wrong row, or too many shards', () => {
    expect(() => shardPageBonuses(shardData, [5011], 1)).toThrow(/Offense/);
    expect(() => shardPageBonuses(shardData, [5008, 5008, 5011, 5011], 1)).toThrow(/rows/);
  });
});
