import { byLevel } from '../../stats';
import type { Effect, HitContext } from '../types';
import { adaptiveProc } from './adaptive';

// CommunityDragon perks Domination/Electrocute: 70–240 by level, +0.1 bonus AD, +0.05 AP.
const DAMAGE_L1 = 70;
const DAMAGE_L18 = 240;
const BONUS_AD_RATIO = 0.1;
const AP_RATIO = 0.05;

const proc = ({ attacker, state }: HitContext) =>
  state.proc
    ? [adaptiveProc(
        attacker,
        byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level) + BONUS_AD_RATIO * attacker.ad.bonus + AP_RATIO * attacker.ap,
        'Electrocute',
      )]
    : [];

/** Hitting a champion with 3 separate attacks or abilities within 3s deals bonus adaptive damage. */
export const electrocute: Effect = {
  id: '8112',
  name: 'Electrocute',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Third hit (proc)', kind: 'toggle', default: true }],
  onHit: proc,
  onAbilityHit: proc,
};
