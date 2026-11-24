import { describe, expect, it } from 'vitest';
import { checkItemLimits, type ItemLimitGroup } from './index';

const spellblade: ItemLimitGroup = { id: '{8b55a7b3}', name: 'Spellblade', max: 1, items: ['3057', '3078', '3100'] };
const rabadons: ItemLimitGroup = { id: '{ac92b6ad}', name: "Rabadon's Deathcap", max: 1, items: ['3089'] };
const groups = [spellblade, rabadons];

describe('checkItemLimits', () => {
  it('flags two items from one shared group', () => {
    expect(checkItemLimits(['3078', '3089', '3100'], groups)).toEqual([{ group: spellblade, items: ['3078', '3100'] }]);
  });

  it('flags a second copy of a one-copy item', () => {
    expect(checkItemLimits(['3089', '3089'], groups)).toEqual([{ group: rabadons, items: ['3089', '3089'] }]);
  });

  it('accepts a legal build', () => {
    expect(checkItemLimits(['3078', '3089', '1036', '1036'], groups)).toEqual([]);
  });
});
