import { stackPct } from '../../stats';
import type { Effect } from '../types';
import { hand, item, itemText, sourced } from '../../hand';

const BASE = sourced('terminus.base', item('3302', 'calc:OnHitDamage.0.mNumber', 30));
const BONUS_AD_RATIO = sourced('terminus.bonusAdRatio', item('3302', 'calc:OnHitDamage.1.mCoefficient', 0.1));
const AP_RATIO = sourced('terminus.apRatio', item('3302', 'calc:OnHitDamage.2.mCoefficient', 0.1));
const PEN_PER_STACK = sourced('terminus.penPerStack', item('3302', 'PenPerHit', 0.1));
const MAX_STACKS = hand('terminus.maxStacks', 3, item('3302', 'PenMax', 0.3), 'PenMax ÷ PenPerHit');
const DARK_EVERY = hand('terminus.darkEvery', 2, itemText('3302', 'Alternate between Light and Dark'), 'Assumes the first attack is Light');
const STACK_SECONDS = sourced('terminus.stackSeconds', item('3302', 'BuffDuration', 5));

/**
 * Shadow: attacks deal bonus magic damage on-hit. Juxtaposition: Dark attacks grant
 * 10% armor and magic penetration per stack, up to 30%. Light stacks (armor and MR) aren't modeled.
 */
export const terminus: Effect = {
  id: '3302',
  name: 'Terminus',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'dark', label: 'Dark stacks', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS }],
  // Attacks alternate Light and Dark; assumes the first is Light, so every second attack adds a
  // Dark stack.
  cycles: [{ kind: 'stacks', field: 'dark', counts: 'attack', every: DARK_EVERY, max: MAX_STACKS, expiresAfter: STACK_SECONDS }],
  modifyStats: (stats, state) => {
    const pen = PEN_PER_STACK * Math.min(MAX_STACKS, Number(state.dark));
    return { ...stats, armorPenPct: stackPct(stats.armorPenPct, pen), magicPenPct: stackPct(stats.magicPenPct, pen) };
  },
  onHit: ({ attacker }) => [{
    type: 'magic',
    raw: BASE + BONUS_AD_RATIO * attacker.ad.bonus + AP_RATIO * attacker.ap,
    source: 'Terminus',
    tags: ['onhit'],
  }],
};
