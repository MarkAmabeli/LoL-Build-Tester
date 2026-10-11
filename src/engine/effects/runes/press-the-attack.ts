import { byLevel } from '../../stats';
import { amplify } from '../amplify';
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
    { key: 'proc', label: 'Third attack (proc)', scope: 'combat', kind: 'toggle', default: false },
    { key: 'exposed', label: 'Target exposed', scope: 'combat', kind: 'toggle', default: false },
  ],
  // HitsRequired 3, TimeBetweenHits 4, Cooldown 6. Exposure lasts until 5s out of combat
  // (OutOfCombatTimer 5), so hits refresh it.
  cycles: [
    { kind: 'proc', field: 'proc', counts: 'attack', hits: 3, window: { seconds: 4, from: 'last' }, cooldown: 6 },
    { kind: 'buff', field: 'exposed', startedBy: 'proc', lasts: 5, refreshedBy: 'hit' },
  ],
  onHit: ({ attacker, state }) =>
    state.proc ? [adaptiveProc(attacker, byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), 'Press the Attack')] : [],
  preMitigation: (hit, { state }) =>
    state.exposed && !state.proc ? amplify(hit, DAMAGE_AMP) : hit,
};
