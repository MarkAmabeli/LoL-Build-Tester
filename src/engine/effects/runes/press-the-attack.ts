import { byLevel } from '../../stats';
import { amplify } from '../amplify';
import type { Effect } from '../types';
import { adaptiveProc } from './adaptive';
import { perk, sourced } from '../../hand';

const DAMAGE_L1 = sourced('pta.damageL1', perk('8005', 'MinDamage', 40));
const DAMAGE_L18 = sourced('pta.damageL18', perk('8005', 'MaxDamage', 160));
const DAMAGE_AMP = sourced('pta.amp', perk('8005', 'BonusPercentDamage', 0.08));
const HITS = sourced('pta.hits', perk('8005', 'HitsRequired', 3));
const SECONDS_BETWEEN_HITS = sourced('pta.secondsBetweenHits', perk('8005', 'TimeBetweenHits', 4));
const COOLDOWN = sourced('pta.cooldown', perk('8005', 'Cooldown', 6));
const OUT_OF_COMBAT_SECONDS = sourced('pta.outOfCombatSeconds', perk('8005', 'OutOfCombatTimer', 5));

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
  // Exposure lasts until out of combat (OutOfCombatTimer), so hits refresh it.
  cycles: [
    { kind: 'proc', field: 'proc', counts: 'attack', hits: HITS, window: { seconds: SECONDS_BETWEEN_HITS, from: 'last' }, cooldown: COOLDOWN },
    { kind: 'buff', field: 'exposed', startedBy: 'proc', lasts: OUT_OF_COMBAT_SECONDS, refreshedBy: 'hit' },
  ],
  onHit: ({ attacker, state }) =>
    state.proc ? [adaptiveProc(attacker, byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level), 'Press the Attack')] : [],
  preMitigation: (hit, { state }) =>
    state.exposed && !state.proc ? amplify(hit, DAMAGE_AMP) : hit,
};
