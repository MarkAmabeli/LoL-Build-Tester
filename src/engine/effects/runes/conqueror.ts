import { addAdaptiveForce, byLevel } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon perks Precision/Conqueror: 1.8–4 adaptive force per stack by level, 12 stacks.
const PER_STACK_L1 = 1.8;
const PER_STACK_L18 = 4;
const MAX_STACKS = 12;

/** Each stack grants adaptive force. Healing at max stacks isn't modeled (no effect on damage dealt). */
export const conqueror: Effect = {
  id: '8010',
  name: 'Conqueror',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Stacks', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS }],
  // 2 stacks per hit, 1 per ranged attack (in-game description); BuffDuration 5. Abilities only stack
  // once per cast instance (wiki), which counts as one event here.
  cycles: [{ kind: 'stacks', field: 'stacks', counts: 'hit', perHit: { melee: 2, ranged: 1 }, perAbilityHit: 2, max: MAX_STACKS, expiresAfter: 5 }],
  modifyStats: (stats, state) =>
    addAdaptiveForce(stats, Math.min(MAX_STACKS, Number(state.stacks)) * byLevel(PER_STACK_L1, PER_STACK_L18, stats.level)),
};
