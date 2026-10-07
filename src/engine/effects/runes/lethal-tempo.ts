import { addBonusAttackSpeed, byLevel, isRanged } from '../../stats';
import type { Effect } from '../types';
import { adaptiveProc } from './adaptive';

// CommunityDragon perks Precision/LethalTempo data values. The tooltip calculation
// would give ranged 4.8% AS and 6–20 damage (melee × 0.8 / × 0.667), but the data
// values below match the in-game description, so they're used instead.
const MAX_STACKS = 6;
const AS_PER_STACK = { melee: 6, ranged: 4 };
const DAMAGE = { melee: [9, 30], ranged: [6, 24] } as const;

/**
 * Attacking a champion grants attack speed per stack, up to 6. At max stacks,
 * attacks deal bonus adaptive damage, increased by 1% per 1% bonus attack speed.
 */
export const lethalTempo: Effect = {
  id: '8008',
  name: 'Lethal Tempo',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Stacks', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
  modifyStats: (stats, state) => {
    const perStack = isRanged(stats) ? AS_PER_STACK.ranged : AS_PER_STACK.melee;
    return addBonusAttackSpeed(stats, perStack * Math.min(MAX_STACKS, Number(state.stacks)));
  },
  onHit: ({ attacker, state }) => {
    if (Number(state.stacks) < MAX_STACKS) return [];
    const [l1, l18] = isRanged(attacker) ? DAMAGE.ranged : DAMAGE.melee;
    const raw = byLevel(l1, l18, attacker.level) * (1 + attacker.bonusAttackSpeedPct / 100);
    return [adaptiveProc(attacker, raw, 'Lethal Tempo')];
  },
};
