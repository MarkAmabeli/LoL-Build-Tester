import { describe, expect, it } from 'vitest';
import { flattenCalculations, itemValues, perkValues } from './game-values.ts';

describe('game values snapshot', () => {
  it('flattens calculation parts by index, dropping the part list name', () => {
    const calcs = {
      OnHitDamage: { DamageType: 1, mFormulaParts: [{ mNumber: 45, __type: 'NumberCalculationPart' }], __type: 'GameCalculation' },
      SpellbladeDamage: { mFormulaParts: [{ mStat: 2, mStatFormula: 1, mCoefficient: 0.75 }, { mCoefficient: 0.10000000149011612 }] },
    };
    expect(flattenCalculations(calcs)).toEqual({
      'calc:OnHitDamage.DamageType': 1,
      'calc:OnHitDamage.0.mNumber': 45,
      'calc:SpellbladeDamage.0.mStat': 2,
      'calc:SpellbladeDamage.0.mStatFormula': 1,
      'calc:SpellbladeDamage.0.mCoefficient': 0.75,
      'calc:SpellbladeDamage.1.mCoefficient': 0.1,
    });
  });

  it('reads 4-digit items and perk effect amounts, rounding float32 noise', () => {
    const items = itemValues({
      'Items/3071': { mDataValues: [{ mName: 'ShredPerStack', mValue: 0.05999999865889549 }] },
      'Items/223071': { mDataValues: [{ mName: 'ShredPerStack', mValue: 1 }] },
    });
    expect(items).toEqual({ '3071': { ShredPerStack: 0.06 } });
    const perks = perkValues({ 'Perks/Styles/Domination/Electrocute': { mPerkId: 8112, mScript: { mSpellScriptData: { mEffectAmount: { Cooldown: 20 } } } } });
    expect(perks).toEqual({ '8112': { Cooldown: 20 } });
  });
});
