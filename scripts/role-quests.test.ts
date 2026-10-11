import { describe, expect, it } from 'vitest';
import { buildRoleQuestItems } from './role-quests.ts';

describe('role quest items', () => {
  const groups = [
    { id: 'b', name: 'Boots', max: 1, items: ['1001', '3006', '3172', '3009', '3170', '3020'] },
    { id: 'p', name: 'HuntersTalismanGroup', max: 1, items: ['1101'] },
  ];
  const listed = ['1001', '3006', '3172', '3009', '3170', '3020', '1101', '3877', '3865'].map((id) => ({ id }));
  const recipes = { '3006': ['1001', '1042', '1042'], '3172': ['3006'], '3009': ['1001'], '3170': ['3009'], '3877': ['3867'], '3020': ['1001'] };

  // Sorcerer's Shoes (3020) is built from basic Boots alone, which isn't a tier 2.
  it('maps tier 2 boots to the tier 3 built from them, and finds the support upgrades', () => {
    expect(buildRoleQuestItems(listed, recipes, groups)).toEqual({
      boots: ['1001', '3006', '3009', '3020', '3170', '3172'],
      bootsUpgrades: { '3006': '3172', '3009': '3170' },
      supportUpgrades: ['3877'],
      junglePets: ['1101'],
    });
  });
});
