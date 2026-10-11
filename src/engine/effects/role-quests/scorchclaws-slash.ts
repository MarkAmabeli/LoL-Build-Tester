import type { DamageInstance } from '../../types';
import type { Effect, HitContext } from '../types';
import { hand, item, notApplied, sourced, wiki } from '../../hand';

const BURN_MAX_HP_RATIO = sourced('scorchclaw.burnMaxHpRatio', item('1101', 'AvatarMaxHPBurnTotal', 0.05));
const MAX_STACKS = sourced('scorchclaw.maxStacks', item('1101', 'AvatarMaxStacks', 100));
const STACKS_PER_TICK = sourced('scorchclaw.stacksPerTick', item('1101', 'StacksPerHalfSec', 3));
const TICK_SECONDS = hand('scorchclaw.tickSeconds', 0.5, wiki('Scorchclaw Pup', 'Gain 3 Ember stacks every 0.5 seconds, up to 100'));
notApplied('scorchclaw.burnSeconds', item('1101', 'AvatarBurnDuration', 4), 'The burn counts as one hit');
notApplied('scorchclaw.slowAmount', item('1101', 'AvatarSlowAmount', 0.3), 'Slows only; no damage');
notApplied('scorchclaw.aoeRadius', item('1101', 'AvatarAoERadius', 250), 'Only the target is counted');

/** Time to rebuild full Ember stacks after a burn: 100 stacks at 3 per 0.5s ≈ 16.7s. */
export const SCORCHCLAW_RECHARGE_SECONDS = (MAX_STACKS / STACKS_PER_TICK) * TICK_SECONDS;

const burn = ({ target, state }: HitContext): DamageInstance[] =>
  state.proc
    ? [{ type: 'true', raw: BURN_MAX_HP_RATIO * target.stats.hp.total, source: "Scorchclaw's Slash", tags: ['proc', 'dot'] }]
    : [];

/**
 * Scorchclaw's Slash (Primal Smite with Scorchclaw Pup; wiki "Scorchclaw Pup"): with full Ember
 * stacks, the next attack or ability damage against a champion burns them for 5% of their max
 * health as true damage over 4s (counted as one hit, like item burns) and slows them (not
 * modeled). The 250-unit splash isn't counted.
 *
 * Deliberate exception to "unstacked at the start of combat": Ember stacks build on their own
 * (and fill on killing a large monster), so the first hit of a fight burns. Modeled as a one-hit
 * proc with the rebuild time as its cooldown, which starts ready.
 */
export const scorchclawsSlash: Effect = {
  id: 'RoleQuest:jungle:scorchclaw',
  name: "Scorchclaw's Slash",
  kind: 'roleQuest',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Full Ember stacks (proc)', scope: 'combat', kind: 'toggle', default: true }],
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: SCORCHCLAW_RECHARGE_SECONDS }],
  onHit: burn,
  onAbilityHit: burn,
};
