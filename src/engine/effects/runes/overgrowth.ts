import { addBonus } from '../../stats';
import type { Effect } from '../types';
import { perk, sourced } from '../../hand';

const HEALTH_PER_TIER = sourced('overgrowth.healthPerTier', perk('8451', 'FlatHealthPerTier', 3));
const UNITS_PER_TIER = sourced('overgrowth.unitsPerTier', perk('8451', 'UnitsPerTier', 8));
const THRESHOLD_UNITS = sourced('overgrowth.thresholdUnits', perk('8451', 'ThresholdUnits', 120));
const MAX_HEALTH_AMP = sourced('overgrowth.maxHealthAmp', perk('8451', 'ThresholdMaxHealthRatio', 0.035));

/**
 * Gain 3 max health per 8 monsters or minions absorbed; at 120, gain another 3.5% max health.
 * A defensive rune: put it on the target's loadout. Runs in the multiply phase
 * so the 3.5% sees every flat addition.
 */
export const overgrowth: Effect = {
  id: '8451',
  name: 'Overgrowth',
  kind: 'rune',
  verifiedPatch: '16.20',
  statPhase: 'multiply',
  state: [{ key: 'units', label: 'Units absorbed', scope: 'setup', kind: 'number', default: THRESHOLD_UNITS, min: 0, max: 1000 }],
  modifyStats: (stats, state) => {
    const units = Math.max(0, Number(state.units));
    const flat = HEALTH_PER_TIER * Math.floor(units / UNITS_PER_TIER);
    const pct = units >= THRESHOLD_UNITS ? (stats.hp.total + flat) * MAX_HEALTH_AMP : 0;
    return { ...stats, hp: addBonus(stats.hp, flat + pct) };
  },
};
