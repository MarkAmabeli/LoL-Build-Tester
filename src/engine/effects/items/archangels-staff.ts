import type { Effect } from '../types';
import { item, sourced } from '../../hand';

// Both ratios are of bonus mana.
const ARCHANGEL_RATIO = sourced('archangels.apFromMana', item('3003', 'APFromMana', 0.01));
const SERAPH_RATIO = sourced('seraphs.apFromMana', item('3040', 'APFromMana', 0.02));

/**
 * Awe: AP equal to 1% of bonus mana. Runs in the 'add' phase, before Rabadon's
 * multiplies AP. Manaflow stacking isn't modeled: set mana directly.
 */
export const archangelsStaff: Effect = {
  id: '3003',
  name: "Archangel's Staff",
  kind: 'item',
  verifiedPatch: '16.20',
  modifyStats: (stats) => ({ ...stats, ap: stats.ap + ARCHANGEL_RATIO * stats.mana.bonus }),
};

/** Seraph's Embrace (Archangel's transformed): AP equal to 2% of bonus mana. The Lifeline shield isn't modeled. */
export const seraphsEmbrace: Effect = {
  id: '3040',
  name: "Seraph's Embrace",
  kind: 'item',
  verifiedPatch: '16.20',
  modifyStats: (stats) => ({ ...stats, ap: stats.ap + SERAPH_RATIO * stats.mana.bonus }),
};
