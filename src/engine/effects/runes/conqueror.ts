import { addAdaptiveForce, byLevel } from '../../stats';
import type { Effect } from '../types';
import { hand, perk, runeText, sourced } from '../../hand';

const PER_STACK_L1 = sourced('conqueror.perStackL1', perk('8010', 'MinAdaptivePerStack', 1.8));
const PER_STACK_L18 = sourced('conqueror.perStackL18', perk('8010', 'MaxAdaptivePerStack', 4));
const MAX_STACKS = sourced('conqueror.maxStacks', perk('8010', 'MaxStacks', 12));
const STACKS_PER_HIT = hand('conqueror.stacksPerHit', 2, runeText(8010, 'grant 2 stacks of Conqueror'));
const RANGED_ATTACK_STACKS = hand('conqueror.rangedAttackStacks', 1, runeText(8010, 'Ranged champions gain only 1 stack per basic attack'));
const STACK_SECONDS = sourced('conqueror.stackSeconds', perk('8010', 'BuffDuration', 5));

/** Each stack grants adaptive force. Healing at max stacks isn't modeled (no effect on damage dealt). */
export const conqueror: Effect = {
  id: '8010',
  name: 'Conqueror',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Stacks', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS }],
  // Abilities only stack once per cast instance (wiki), which counts as one event here.
  cycles: [{ kind: 'stacks', field: 'stacks', counts: 'hit', perHit: { melee: STACKS_PER_HIT, ranged: RANGED_ATTACK_STACKS }, perAbilityHit: STACKS_PER_HIT, max: MAX_STACKS, expiresAfter: STACK_SECONDS }],
  modifyStats: (stats, state) =>
    addAdaptiveForce(stats, Math.min(MAX_STACKS, Number(state.stacks)) * byLevel(PER_STACK_L1, PER_STACK_L18, stats.level)),
};
