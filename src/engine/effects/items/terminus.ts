import { stackPct } from '../../stats';
import type { Effect } from '../types';

// CommunityDragon Items/3302: OnHitDamage 30 + 0.1 bonus AD + 0.1 AP (magic); PenPerHit 0.1, PenMax 0.3.
const BASE = 30;
const BONUS_AD_RATIO = 0.1;
const AP_RATIO = 0.1;
const PEN_PER_STACK = 0.1;
const MAX_STACKS = 3;

/**
 * Shadow: attacks deal bonus magic damage on-hit. Juxtaposition: Dark attacks grant
 * 10% armor and magic penetration per stack, up to 30%. Light stacks (armor and MR) aren't modeled.
 */
export const terminus: Effect = {
  id: '3302',
  name: 'Terminus',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'dark', label: 'Dark stacks', kind: 'number', default: MAX_STACKS, min: 0, max: MAX_STACKS }],
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
