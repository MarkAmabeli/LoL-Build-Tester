import { byLevel } from '../../stats';
import type { Effect } from '../types';
import { adaptiveProc } from './adaptive';
import { perk, sourced } from '../../hand';

const DAMAGE_L1 = sourced('comet.damageL1', perk('8229', 'DamageBase', 15));
const DAMAGE_L18 = sourced('comet.damageL18', perk('8229', 'DamageMax', 100));
const BONUS_AD_RATIO = sourced('comet.bonusAdRatio', perk('8229', 'ADRatio', 0.1));
const AP_RATIO = sourced('comet.apRatio', perk('8229', 'APRatio', 0.05));
const MAX_DAMAGE_AMP = sourced('comet.maxDamageAmp', perk('8229', 'MaxDamageAmp', 1));
const MAX_RANGE = sourced('comet.maxRange', perk('8229', 'MaxRange', 750));
const COOLDOWN_L1 = sourced('comet.cooldownL1', perk('8229', 'RechargeTime', 20));
const COOLDOWN_L18 = sourced('comet.cooldownL18', perk('8229', 'RechargeTimeMin', 8));

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
    { key: 'proc', label: 'Comet (proc)', scope: 'combat', kind: 'toggle', default: true },
    { key: 'distance', label: 'Distance to target', scope: 'action', kind: 'number', default: 0, min: 0, max: MAX_RANGE },
  ],
  // The cooldown refund from hits (PercentRefund, DotPercentRefund, AoEPercentRefund) isn't modeled.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'ability', hits: 1, cooldown: { from: COOLDOWN_L1, to: COOLDOWN_L18 } }],
  onAbilityHit: ({ attacker, state }) => {
    if (!state.proc) return [];
    const base = byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level) + BONUS_AD_RATIO * attacker.ad.bonus + AP_RATIO * attacker.ap;
    const amp = 1 + MAX_DAMAGE_AMP * Math.min(1, Math.max(0, Number(state.distance) / MAX_RANGE));
    return [adaptiveProc(attacker, base * amp, 'Arcane Comet')];
  },
};
