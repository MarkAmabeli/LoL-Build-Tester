import type { Effect } from '../types';
import { item, sourced } from '../../hand';

// Hatefog damage is per second, ticking every 0.25s.
const DAMAGE_PER_SECOND = sourced('malignance.damagePerSecond', item('3118', 'BaseDamage', 60));
const AP_RATIO_PER_SECOND = sourced('malignance.apRatioPerSecond', item('3118', 'APRatio', 0.05));
const MAX_SECONDS = sourced('malignance.maxSeconds', item('3118', 'GroundDuration', 3));
const MR_SHRED = sourced('malignance.mrShred', item('3118', 'calc:MagicResistanceShred.0.mNumber', 10));
const ULTIMATE_HASTE = sourced('malignance.ultimateHaste', item('3118', 'UltimateHaste', 20));

/**
 * Hatefog: your ultimate burns the ground under the target for 3s, dealing 60 (+5% AP)
 * magic damage per second and reducing their MR by 10. Needs hits tagged `ultimate`.
 * Scorn: 20 ultimate haste.
 */
export const malignance: Effect = {
  id: '3118',
  name: 'Malignance',
  kind: 'item',
  verifiedPatch: '16.20',
  state: [{ key: 'seconds', label: 'Seconds in Hatefog', scope: 'action', kind: 'number', default: MAX_SECONDS, min: 0, max: MAX_SECONDS }],
  modifyStats: (stats) => ({ ...stats, ultimateHaste: stats.ultimateHaste + ULTIMATE_HASTE }),
  onAbilityHit: ({ attacker, state, hit }) => {
    const seconds = Math.min(MAX_SECONDS, Number(state.seconds));
    if (!hit?.tags?.includes('ultimate') || seconds <= 0) return [];
    return [{
      type: 'magic',
      raw: (DAMAGE_PER_SECOND + AP_RATIO_PER_SECOND * attacker.ap) * seconds,
      source: 'Hatefog',
      tags: ['proc', 'dot'],
    }];
  },
  targetResist: ({ state }) => (Number(state.seconds) > 0 ? { mr: { flat: MR_SHRED } } : {}),
};
