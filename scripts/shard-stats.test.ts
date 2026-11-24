import { describe, expect, it } from 'vitest';
import { parseShardText } from './shard-stats.ts';

// Description strings as they appear in CommunityDragon perks.json (patch 16.20).
describe('parseShardText', () => {
  it('reads adaptive force through tooltip markup', () => {
    const text = "+9 <lol-uikit-tooltipped-keyword key='LinkTooltip_Description_Adaptive'><font color='#48C4B7'>Adaptive Force</font></lol-uikit-tooltipped-keyword>";
    expect(parseShardText(text)).toEqual({ stats: { adaptiveForce: 9 } });
  });

  it('reads level-scaling health as a scaled stat', () => {
    expect(parseShardText('+10-180 Health (based on level)')).toEqual({
      stats: {},
      scaling: [{ stat: 'hp', from: 10, to: 180 }],
    });
  });

  it('reads flat health, attack speed, haste and percent move speed', () => {
    expect(parseShardText('+65 Health').stats).toEqual({ hp: 65 });
    expect(parseShardText('+10% Attack Speed').stats).toEqual({ attackSpeedPct: 10 });
    expect(parseShardText("+8 <lol-uikit-tooltipped-keyword key='x'>Ability Haste</lol-uikit-tooltipped-keyword> ").stats)
      .toEqual({ abilityHaste: 8 });
    expect(parseShardText("+2.5% <lol-uikit-tooltipped-keyword key='x'>Move Speed</lol-uikit-tooltipped-keyword>").stats)
      .toEqual({ moveSpeedPct: 0.025 });
  });

  it('reports text it cannot model instead of dropping it', () => {
    expect(parseShardText('+15% Tenacity and Slow Resist')).toEqual({
      stats: {},
      unmodeled: ['+15% Tenacity and Slow Resist'],
    });
  });
});
