import { addBonusAttackSpeed } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Precision/LegendAlacrity: AttackSpeedBase 0.03, AttackSpeedPerStack 0.015, MaxLegendStacks 10.
const BASE_PCT = 3;
const PER_STACK_PCT = 1.5;
const MAX_STACKS = 10;

/** Gain 3% attack speed plus 1.5% per Legend stack (up to 10). */
export const legendAlacrity: Effect = {
  id: '9104',
  name: 'Legend: Alacrity',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Legend stacks', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
  modifyStats: (stats, state) =>
    addBonusAttackSpeed(stats, BASE_PCT + PER_STACK_PCT * Math.min(MAX_STACKS, Number(state.stacks))),
};
