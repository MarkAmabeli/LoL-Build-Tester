import { describe, expect, it } from 'vitest';
import { parseItemDescriptionStats, toStatBonuses } from './item-stats.ts';

describe('parseItemDescriptionStats', () => {
  it('reads haste, lethality and penetration from the <stats> block', () => {
    const desc =
      '<mainText><stats><attention>55</attention> Attack Damage<br><attention>20</attention> Ability Haste' +
      '<br><attention>18</attention> Lethality<br><attention>30%</attention> Armor Penetration</stats></mainText>';
    expect(parseItemDescriptionStats(desc)).toEqual({
      abilityHaste: 20,
      lethality: 18,
      armorPenPct: 0.3,
    });
  });

  it('distinguishes flat and percent magic penetration', () => {
    expect(
      parseItemDescriptionStats('<stats><attention>40%</attention> Magic Penetration</stats>'),
    ).toEqual({ magicPenPct: 0.4 });
    expect(
      parseItemDescriptionStats('<stats><attention>15</attention> Magic Penetration</stats>'),
    ).toEqual({ magicPenFlat: 15 });
  });

  it('ignores text outside the <stats> block', () => {
    expect(parseItemDescriptionStats('<passive>Gain 10 Lethality</passive>')).toEqual({});
  });
});

describe('toStatBonuses', () => {
  it('converts Data Dragon fractions to engine units and drops zeros', () => {
    expect(
      toStatBonuses({ FlatPhysicalDamageMod: 40, PercentAttackSpeedMod: 0.25, FlatArmorMod: 0 }, {}),
    ).toEqual({ ad: 40, attackSpeedPct: 25 });
  });
});
