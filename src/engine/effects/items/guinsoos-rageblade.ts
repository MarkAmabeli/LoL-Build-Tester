import { addBonusAttackSpeed } from '../../stats';
import type { Effect } from '../types';
import { hand, item, sourced } from '../../hand';

const DAMAGE = sourced('guinsoos.damage', item('3124', 'OnHitDamage', 30));
const AS_PER_STACK_PCT = hand('guinsoos.attackSpeedPerStack', 8, item('3124', 'AttackSpeedPerStack', 0.08), 'percent');
const MAX_STACKS = sourced('guinsoos.maxStacks', item('3124', 'MaxStacks', 4));
const STACK_SECONDS = sourced('guinsoos.stackSeconds', item('3124', 'BuffDuration', 4));

/**
 * Wrath: attacks deal 30 bonus magic damage on-hit. Seething Strike: 8% attack speed
 * per stack, up to 4. Applying on-hit twice every third attack isn't modeled; it
 * needs the other effects' procs (ROADMAP step 5).
 */
export const guinsoosRageblade: Effect = {
  id: '3124',
  name: "Guinsoo's Rageblade",
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Seething Strike stacks', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS }],
  cycles: [{ kind: 'stacks', field: 'stacks', counts: 'attack', max: MAX_STACKS, expiresAfter: STACK_SECONDS }],
  modifyStats: (stats, state) => addBonusAttackSpeed(stats, AS_PER_STACK_PCT * Math.min(MAX_STACKS, Number(state.stacks))),
  onHit: () => [{ type: 'magic', raw: DAMAGE, source: "Guinsoo's Rageblade", tags: ['onhit'] }],
};
