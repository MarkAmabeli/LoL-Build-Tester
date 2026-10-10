import { addBonusAttackSpeed } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/3124: OnHitDamage 30 (magic), AttackSpeedPerStack 0.08, MaxStacks 4.
const DAMAGE = 30;
const AS_PER_STACK_PCT = 8;
const MAX_STACKS = 4;

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
  state: [{ key: 'stacks', label: 'Seething Strike stacks', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
  modifyStats: (stats, state) => addBonusAttackSpeed(stats, AS_PER_STACK_PCT * Math.min(MAX_STACKS, Number(state.stacks))),
  onHit: () => [{ type: 'magic', raw: DAMAGE, source: "Guinsoo's Rageblade", tags: ['onhit'] }],
};
