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

  it("reads crit damage (Infinity Edge) without confusing it with crit chance", () => {
    const desc =
      '<stats><attention>75</attention> Attack Damage<br><attention>25%</attention> Critical Strike Chance' +
      '<br><attention>30%</attention> Critical Strike Damage</stats>';
    expect(parseItemDescriptionStats(desc)).toEqual({ critDamageBonus: 0.3 });
  });

  it('reads omnivamp, tenacity, heal and shield power and base regen as fractions, and gold per 10 seconds', () => {
    const desc =
      '<stats><attention>5%</attention> Omnivamp<br><attention>20%</attention> Tenacity<br><attention>10%</attention> Heal and Shield Power' +
      '<br><attention>100%</attention> Base Health Regen<br><attention>125%</attention> Base Mana Regen<br><attention>9</attention> Gold Per 10 Seconds</stats>';
    expect(parseItemDescriptionStats(desc)).toEqual({
      omnivamp: 0.05,
      tenacity: 0.2,
      healShieldPower: 0.1,
      baseHpRegenPct: 1,
      baseManaRegenPct: 1.25,
      goldPer10: 9,
    });
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

  it('keeps percent move speed and life steal as fractions', () => {
    expect(toStatBonuses({ PercentMovementSpeedMod: 0.04, PercentLifeStealMod: 0.07 }, {})).toEqual({ moveSpeedPct: 0.04, lifeSteal: 0.07 });
  });
});
