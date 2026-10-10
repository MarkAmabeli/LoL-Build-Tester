import { describe, expect, it } from 'vitest';
import { buildItemGroups, type ItemsBin } from './item-groups.ts';

const bin: ItemsBin = {
  '{8b55a7b3}': { __type: 'ItemGroup', mItemGroupID: '{57352a0f}', mMaxGroupOwnable: 1 },
  'Items/ItemGroups/LastWhisper': { __type: 'ItemGroup', mItemGroupID: 'LastWhisper', mMaxGroupOwnable: 1 },
  'Items/ItemGroups/Default': { __type: 'ItemGroup', mItemGroupID: 'Default' },
  '{ac92b6ad}': { __type: 'ItemGroup', mItemGroupID: '3089', mMaxGroupOwnable: 1 },
  '{d790b43f}': { __type: 'ItemGroup', mItemGroupID: 'Arena', mMaxGroupOwnable: 99 },
  '{3aa8b165}': { __type: 'ItemGroup', mItemGroupID: 'HuntersTalismanGroup', mMaxGroupOwnable: 1 },
  'Items/3078': { __type: 'ItemData', itemID: 3078, mItemGroups: ['{8b55a7b3}', 'Items/ItemGroups/Default'] },
  'Items/3100': { __type: 'ItemData', itemID: 3100, mItemGroups: ['{8b55a7b3}', '{d790b43f}'] },
  'Items/3071': { __type: 'ItemData', itemID: 3071, mItemGroups: ['Items/ItemGroups/LastWhisper'] },
  'Items/3089': { __type: 'ItemData', itemID: 3089, mItemGroups: ['{ac92b6ad}'] },
  'Items/1101': { __type: 'ItemData', itemID: 1101, mItemGroups: ['{3aa8b165}'] },
  'Items/9999': { __type: 'ItemData', itemID: 9999, mItemGroups: ['Items/ItemGroups/LastWhisper'] },
};
const items = [
  { id: '3078', name: 'Trinity Force' },
  { id: '3100', name: 'Lich Bane' },
  { id: '3071', name: 'Black Cleaver' },
  { id: '3089', name: "Rabadon's Deathcap" },
  { id: '1101', name: 'Scorchclaw Pup' },
];

describe('buildItemGroups', () => {
  const groups = buildItemGroups(bin, items);

  it('names groups by readable key, known hash, readable ID, or their single item', () => {
    expect(groups.map((g) => g.name)).toEqual(['HuntersTalismanGroup', 'LastWhisper', "Rabadon's Deathcap", 'Spellblade']);
  });

  it('keeps only store items as members', () => {
    expect(groups.find((g) => g.name === 'LastWhisper')?.items).toEqual(['3071']);
    expect(groups.find((g) => g.name === 'Spellblade')).toMatchObject({ max: 1, items: ['3078', '3100'] });
  });

  it('skips groups without a real limit', () => {
    expect(groups.some((g) => g.id === 'Items/ItemGroups/Default' || g.id === '{d790b43f}')).toBe(false);
  });
});
