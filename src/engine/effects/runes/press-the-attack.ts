import { byLevel } from '../../stats';
import type { Effect } from '../types';
import { adaptiveProc } from './adaptive';

// CommunityDragon perks Precision/PressTheAttack: MinDamage 40, MaxDamage 160, BonusPercentDamage 0.08.
const DAMAGE_L1 = 40;
const DAMAGE_L18 = 160;
const DAMAGE_AMP = 0.08;

/**
 * Three consecutive attacks deal 40–160 adaptive damage (by level) and expose the
 * target, amplifying your damage by 8%. The proc hit itself isn't amplified, since
 * exposure starts after it. Assumes the damage grows linearly with level, like the
 * other keystones; the data only gives the endpoints.
 */
export const pressTheAttack: Effect = {
  id: '8005',
  name: 'Press the Attack',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [
    { key: 'proc', label: 'Third attack (proc)', kind: 'toggle', default: false },
    { key: 'exposed', label: 'Target exposed', kind: 'toggle', default: true },
  ],
  onHit: ({ attacker, state }) =>
    state.proc ? [adaptiveProc(attacker, byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), 'Press the Attack')] : [],
  preMitigation: (hit, { state }) =>
    state.exposed && !state.proc ? { ...hit, raw: hit.raw * (1 + DAMAGE_AMP) } : hit,
};
