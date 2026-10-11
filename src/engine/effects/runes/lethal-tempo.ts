import { addBonusAttackSpeed, byLevel, isRanged } from '../../stats';
import type { Effect } from '../types';
import { adaptiveProc } from './adaptive';
import { hand, perk, sourced } from '../../hand';

// The tooltip calculation would give ranged 4.8% AS and 6–20 damage (melee × 0.8 / × 0.667),
// but the data values below match the in-game description, so they're used instead.
const MAX_STACKS = sourced('lethalTempo.maxStacks', perk('8008', 'MaxStacks', 6));
const STACK_SECONDS = sourced('lethalTempo.stackSeconds', perk('8008', 'Duration', 6));
const AS_PER_STACK = {
  melee: hand('lethalTempo.attackSpeedPerStack.melee', 6, perk('8008', 'TTASPerStackMelee', 0.06), 'percent'),
  ranged: hand('lethalTempo.attackSpeedPerStack.ranged', 4, perk('8008', 'TTASPerStackRanged', 0.04), 'percent'),
};
const DAMAGE = {
  melee: [sourced('lethalTempo.damageL1.melee', perk('8008', 'TTMinNoteDamageMelee', 9)), sourced('lethalTempo.damageL18.melee', perk('8008', 'TTMaxNoteDamageMelee', 30))],
  ranged: [sourced('lethalTempo.damageL1.ranged', perk('8008', 'TTMinNoteDamageRanged', 6)), sourced('lethalTempo.damageL18.ranged', perk('8008', 'TTMaxNoteDamageRanged', 24))],
} as const;

/**
 * Attacking a champion grants attack speed per stack, up to 6. At max stacks,
 * attacks deal bonus adaptive damage, increased by 1% per 1% bonus attack speed.
 */
export const lethalTempo: Effect = {
  id: '8008',
  name: 'Lethal Tempo',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Stacks', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS }],
  cycles: [{ kind: 'stacks', field: 'stacks', counts: 'attack', max: MAX_STACKS, expiresAfter: STACK_SECONDS }],
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
