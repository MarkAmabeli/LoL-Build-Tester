import type { Effect } from '../types';
import { hand, perk, sourced } from '../../hand';

const STEPS = [
  { level: sourced('transcendence.level1', perk('8210', 'LevelToTurnOn', 5)), haste: hand('transcendence.haste1', 5, perk('8210', 'HasteBonus1', 0.05), 'Shown as 5 ability haste in game') },
  { level: sourced('transcendence.level2', perk('8210', 'LevelToTurnOn2', 8)), haste: hand('transcendence.haste2', 5, perk('8210', 'HasteBonus2', 0.05), 'Shown as 5 ability haste in game') },
];

/** +5 ability haste at level 5 and another +5 at level 8. The level 11 takedown refund isn't modeled. */
export const transcendence: Effect = {
  id: '8210',
  name: 'Transcendence',
  kind: 'rune',
  verifiedPatch: '16.20',
  modifyStats: (stats) => ({
    ...stats,
    abilityHaste: stats.abilityHaste + STEPS.reduce((sum, s) => (stats.level >= s.level ? sum + s.haste : sum), 0),
  }),
};
