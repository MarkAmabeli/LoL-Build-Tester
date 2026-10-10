import type { Effect } from '../types';

// CommunityDragon perks Sorcery/Transcendence: LevelToTurnOn 5 / LevelToTurnOn2 8, HasteBonus 0.05 each
// (shown as 5 ability haste in game).
const STEPS = [{ level: 5, haste: 5 }, { level: 8, haste: 5 }];

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
