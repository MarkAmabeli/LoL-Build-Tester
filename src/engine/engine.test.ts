import { describe, expect, it } from 'vitest';
import {
  attackSpeedAt,
  autoAttack,
  cooldownWithHaste,
  effectiveHp,
  effectiveResist,
  evaluateComponent,
  growthAtLevel,
  mitigate,
  resistMultiplier,
  resolveStats,
  sumBonuses,
  type ChampionBaseStats,
} from './index';

// Synthetic champion: round numbers so expected values are easy to verify by hand.
const dummy: ChampionBaseStats = {
  hp: 600, hpperlevel: 100,
  mp: 300, mpperlevel: 50,
  armor: 30, armorperlevel: 4,
  spellblock: 30, spellblockperlevel: 2,
  attackdamage: 60, attackdamageperlevel: 3,
  attackspeed: 0.625, attackspeedperlevel: 2,
  movespeed: 330, attackrange: 550,
};

describe('growthAtLevel', () => {
  it('is zero at level 1', () => {
    expect(growthAtLevel(100, 1)).toBe(0);
  });
  it('is exactly growth × 17 at level 18', () => {
    expect(growthAtLevel(100, 18)).toBeCloseTo(1700, 10);
  });
  it('matches the curve at level 2 (0.72 × growth)', () => {
    expect(growthAtLevel(100, 2)).toBeCloseTo(72, 10);
  });
  it('clamps levels outside 1-18', () => {
    expect(growthAtLevel(100, 25)).toBeCloseTo(1700, 10);
    expect(growthAtLevel(100, 0)).toBe(0);
  });
});

describe('resolveStats', () => {
  it('splits base and bonus correctly', () => {
    const s = resolveStats(dummy, 18, { ad: 50, armor: 40 });
    expect(s.hp.total).toBeCloseTo(600 + 1700);
    expect(s.ad.base).toBeCloseTo(60 + 51);
    expect(s.ad.bonus).toBe(50);
    expect(s.armor.total).toBeCloseTo(30 + 68 + 40);
  });
  it('applies the attack speed ratio and cap', () => {
    expect(attackSpeedAt(dummy, 1, 0)).toBeCloseTo(0.625);
    expect(attackSpeedAt(dummy, 1, 100)).toBeCloseTo(1.25);
    expect(attackSpeedAt(dummy, 18, 1000)).toBe(2.5);
  });
});

describe('sumBonuses', () => {
  it('adds flat stats and stacks % pen multiplicatively', () => {
    const b = sumBonuses({ ad: 10, armorPenPct: 0.3 }, { ad: 5, armorPenPct: 0.3 });
    expect(b.ad).toBe(15);
    expect(b.armorPenPct).toBeCloseTo(0.51);
  });
});

describe('resistMultiplier', () => {
  it('halves damage at 100 resist', () => expect(resistMultiplier(100)).toBe(0.5));
  it('is 1 at 0 resist', () => expect(resistMultiplier(0)).toBe(1));
  it('amplifies damage at negative resist', () => expect(resistMultiplier(-100)).toBe(1.5));
});

describe('effectiveResist', () => {
  it('applies % pen before flat pen', () => {
    // 100 × 0.7 = 70, then − 10 = 60
    expect(effectiveResist(100, { pct: 0.3, flat: 10 })).toBeCloseTo(60);
  });
  it('flat pen cannot go below zero', () => {
    expect(effectiveResist(20, { flat: 50 })).toBe(0);
  });
  it('flat reduction can go below zero, and then % effects are skipped', () => {
    expect(effectiveResist(10, { pct: 0.5, flat: 10 }, { flat: 20 })).toBe(-10);
  });
  it('applies reduction before penetration', () => {
    // 100 − 10 = 90, × 0.8 = 72, × 0.7 = 50.4, − 0.4 = 50
    expect(effectiveResist(100, { pct: 0.3, flat: 0.4 }, { flat: 10, pct: 0.2 })).toBeCloseTo(50);
  });
});

describe('damage evaluation', () => {
  const attacker = resolveStats(dummy, 1, { ap: 100, ad: 40 });
  const target = resolveStats(dummy, 1, { mr: 70 }); // 100 MR total

  it('evaluates per-rank base and ratios', () => {
    const hit = evaluateComponent(
      { type: 'magic', base: [80, 120, 160], ratios: [{ stat: 'AP', value: 0.6 }], label: 'Q' },
      2,
      attacker,
      { stats: target },
    );
    expect(hit.raw).toBeCloseTo(120 + 60);
    expect(mitigate(hit, { attacker, target }).final).toBeCloseTo(90);
  });

  it('reads target missing HP', () => {
    const hit = evaluateComponent(
      { type: 'true', base: 0, ratios: [{ stat: 'targetMissingHP', value: 0.1 }] },
      1,
      attacker,
      { stats: target, currentHp: 200 },
    );
    expect(hit.raw).toBeCloseTo(40);
  });

  it('true damage ignores resistances', () => {
    const final = mitigate({ type: 'true', raw: 100, source: 't' }, { attacker, target }).final;
    expect(final).toBe(100);
  });

  it('averages crit for expected auto damage', () => {
    const crit = resolveStats(dummy, 1, { critChance: 0.5 });
    expect(autoAttack(crit, 'expected').raw).toBeCloseTo(60 * 1.375);
    expect(autoAttack(crit, true).raw).toBeCloseTo(60 * 1.75);
  });
});

describe('utility formulas', () => {
  it('ability haste cooldown', () => expect(cooldownWithHaste(10, 100)).toBe(5));
  it('effective HP', () => expect(effectiveHp(1000, 100)).toBe(2000));
});
