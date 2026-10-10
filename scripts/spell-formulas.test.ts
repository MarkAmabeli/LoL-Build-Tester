import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Formula } from '../src/engine/types.ts';
import { breakpointsAt, translateSpell, type SpellData } from './spell-formulas.ts';

const ndv = (name: string) => ({ __type: 'NamedDataValueCalculationPart', mDataValue: name });
const calc = (...parts: object[]) => ({ __type: 'GameCalculation', mFormulaParts: parts });

describe('translateSpell', () => {
  it('drops the placeholder rank 0 and reads ratios per rank', () => {
    const spell: SpellData = {
      dataValues: { BaseDamage: [40, 80, 120, 160, 200, 240, 280], APRatio: [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75] },
      calculations: {
        TotalDamage: calc(ndv('BaseDamage'), { __type: 'StatByNamedDataValueCalculationPart', mDataValue: 'APRatio' }),
      },
    };
    expect(translateSpell(spell, 5).formulas.TotalDamage).toEqual({
      base: [80, 120, 160, 200, 240],
      ratios: [{ stat: 'AP', value: [0.5, 0.55, 0.6, 0.65, 0.7] }],
    });
  });

  it('applies multipliers from modified calculations and folds constant products', () => {
    const spell: SpellData = {
      dataValues: { Base: [0, 125, 250, 375], Pct: [90, 100, 110, 120] },
      calculations: {
        Damage: calc(ndv('Base'), { __type: 'StatByCoefficientCalculationPart', mStat: 2, mStatFormula: 2, mCoefficient: 0.75 }),
        Max: { __type: 'GameCalculationModified', mModifiedGameCalculation: 'Damage', mMultiplier: { __type: 'NumberCalculationPart', mNumber: 2 } },
        Percent: calc({
          __type: 'StatBySubPartCalculationPart',
          mStat: 2,
          mSubpart: { __type: 'ProductOfSubPartsCalculationPart', mPart1: ndv('Pct'), mPart2: { __type: 'NumberCalculationPart', mNumber: 0.01 } },
        }),
      },
    };
    const { formulas } = translateSpell(spell, 3);
    expect(formulas.Max).toEqual({ base: [250, 500, 750], ratios: [{ stat: 'bonusAD', value: 1.5 }] });
    expect(formulas.Percent).toEqual({ base: 0, ratios: [{ stat: 'totalAD', value: [1, 1.1, 1.2] }] });
  });

  it('matches data value names without case', () => {
    const spell: SpellData = {
      dataValues: { AOEDamagePercent: [0.02, 0.03, 0.04, 0.05] },
      calculations: { DamageCalc: calc(ndv('AoeDamagePercent')) },
    };
    expect(translateSpell(spell, 3).formulas.DamageCalc).toEqual({ base: [0.03, 0.04, 0.05] });
  });

  it('turns level parts into a base by level and buff counters into stacks', () => {
    const spell: SpellData = {
      dataValues: {},
      calculations: {
        Bleed: calc({ __type: 'ByCharLevelInterpolationCalculationPart', mStartValue: 13, mEndValue: 30 }),
        Stacked: calc({ __type: 'BuffCounterByCoefficientCalculationPart', mBuffName: '{x}', mCoefficient: 1 }),
      },
    };
    const { formulas } = translateSpell(spell, 5);
    expect(formulas.Bleed.baseByLevel?.[0]).toBe(13);
    expect(formulas.Bleed.baseByLevel?.[17]).toBe(30);
    expect(formulas.Stacked).toEqual({ base: 0, ratios: [{ stat: 'stacks', value: 1 }] });
  });

  it('reports what it cannot express instead of guessing', () => {
    const spell: SpellData = {
      dataValues: {},
      calculations: {
        Crit: calc({ __type: 'StatByCoefficientCalculationPart', mStat: 9, mCoefficient: 1 }),
        Cond: { __type: 'GameCalculationConditional' },
        Missing: calc(ndv('Nope')),
      },
    };
    expect(translateSpell(spell, 5).unsupported).toEqual({
      Crit: 'stat code 9/0',
      Cond: 'conditional calculation (depends on a game condition)',
      Missing: 'missing data value "Nope"',
    });
  });

  it('rounds away 32-bit float noise', () => {
    const spell: SpellData = { dataValues: { R: [0, 0.03999999910593033] }, calculations: { C: calc(ndv('R')) } };
    expect(translateSpell(spell, 1).formulas.C).toEqual({ base: 0.04 });
  });
});

describe('breakpointsAt', () => {
  // Darius's Noxian Might: 30 at level 1, +5 per level, +10 from 11, +25 from 14.
  const noxianMight = {
    mLevel1Value: 30,
    mInitialBonusPerLevel: 5,
    mBreakpoints: [{ mLevel: 11, mBonusPerLevelAtAndAfter: 10 }, { mLevel: 14, mBonusPerLevelAtAndAfter: 25 }],
  };

  it('follows per-level increases from each breakpoint', () => {
    expect([1, 10, 11, 13, 14, 18].map((l) => breakpointsAt(noxianMight, l))).toEqual([30, 75, 85, 105, 130, 230]);
  });

  it('adds one-off bonuses at their level', () => {
    const terminus = { mLevel1Value: 6, mBreakpoints: [{ mLevel: 11, mAdditionalBonusAtThisLevel: 1 }, { mLevel: 14, mAdditionalBonusAtThisLevel: 1 }] };
    expect([1, 10, 11, 14, 18].map((l) => breakpointsAt(terminus, l))).toEqual([6, 6, 7, 8, 8]);
  });
});

describe('committed formulas', () => {
  const { latest } = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { latest: string };
  const spells = (champion: string) =>
    JSON.parse(readFileSync(`public/data/${latest}/spells/${champion}.json`, 'utf8')) as Record<
      string,
      { slot?: string; maxRank: number; formulas: Record<string, Formula> }
    >;

  it('tags spells with their slot and max rank', () => {
    const veigar = spells('Veigar');
    expect(veigar.VeigarBalefulStrike).toMatchObject({ slot: 'Q', maxRank: 5 });
    expect(veigar.VeigarR).toMatchObject({ slot: 'R', maxRank: 3 });
    expect(veigar.VeigarPassive.slot).toBe('P');
  });

  it("translates Veigar's ultimate as the wiki describes it", () => {
    expect(spells('Veigar').VeigarR.formulas.MinDamage).toEqual({
      base: [175, 250, 325],
      ratios: [{ stat: 'AP', value: [0.65, 0.7, 0.75] }],
    });
  });
});
