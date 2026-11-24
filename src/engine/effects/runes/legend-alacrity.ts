import { addBonusAttackSpeed } from '../../stats';
import type { Effect } from '../types';
import { hand, perk, sourced } from '../../hand';

const BASE_PCT = hand('legendAlacrity.base', 3, perk('9104', 'AttackSpeedBase', 0.03), 'percent');
const PER_STACK_PCT = hand('legendAlacrity.perStack', 1.5, perk('9104', 'AttackSpeedPerStack', 0.015), 'percent');
const MAX_STACKS = sourced('legendAlacrity.maxStacks', perk('9104', 'MaxLegendStacks', 10));

/** Gain 3% attack speed plus 1.5% per Legend stack (up to 10). */
export const legendAlacrity: Effect = {
  id: '9104',
  name: 'Legend: Alacrity',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Legend stacks', scope: 'setup', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
  modifyStats: (stats, state) =>
    addBonusAttackSpeed(stats, BASE_PCT + PER_STACK_PCT * Math.min(MAX_STACKS, Number(state.stacks))),
};
