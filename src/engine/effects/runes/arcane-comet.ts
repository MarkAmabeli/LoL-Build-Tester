import { byLevel } from '../../stats';
import type { Effect } from '../types';
import { adaptiveProc } from './adaptive';

// CommunityDragon perks Sorcery/ArcaneComet: 15–100 by level, +0.1 bonus AD, +0.05 AP;
// MaxDamageAmp 1 at MaxRange 750.
const DAMAGE_L1 = 15;
const DAMAGE_L18 = 100;
const BONUS_AD_RATIO = 0.1;
const AP_RATIO = 0.05;
const MAX_DAMAGE_AMP = 1;
const MAX_RANGE = 750;

/**
 * Damaging a champion with an ability hurls a comet, dealing more damage the
 * farther away the target is (up to +100% at 750 range).
 * Assumes the distance bonus is linear; the bin data only gives the cap.
 */
export const arcaneComet: Effect = {
  id: '8229',
  name: 'Arcane Comet',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [
    { key: 'proc', label: 'Off cooldown', kind: 'toggle', default: true },
    { key: 'distance', label: 'Distance to target', kind: 'number', default: 0, min: 0, max: MAX_RANGE },
  ],
  onAbilityHit: ({ attacker, state }) => {
    if (!state.proc) return [];
    const base = byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level) + BONUS_AD_RATIO * attacker.ad.bonus + AP_RATIO * attacker.ap;
    const amp = 1 + MAX_DAMAGE_AMP * Math.min(1, Math.max(0, Number(state.distance) / MAX_RANGE));
    return [adaptiveProc(attacker, base * amp, 'Arcane Comet')];
  },
};
