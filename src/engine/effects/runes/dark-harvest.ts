import { targetHpPct } from '../../damage';
import type { Effect, HitContext } from '../types';
import { adaptiveProc } from './adaptive';

// CommunityDragon perks Domination/DarkHarvest: 30 + 11 per soul, +0.1 bonus AD, +0.05 AP, below 50% health.
const BASE = 30;
const PER_SOUL = 11;
const BONUS_AD_RATIO = 0.1;
const AP_RATIO = 0.05;
const HEALTH_THRESHOLD = 0.5;

const proc = ({ attacker, target, state }: HitContext) => {
  if (!state.proc || targetHpPct(target) >= HEALTH_THRESHOLD) return [];
  const raw = BASE + PER_SOUL * Number(state.souls) + BONUS_AD_RATIO * attacker.ad.bonus + AP_RATIO * attacker.ap;
  return [adaptiveProc(attacker, raw, 'Dark Harvest')];
};

/** Damaging a champion below 50% health deals adaptive damage; each soul adds 11. */
export const darkHarvest: Effect = {
  id: '8128',
  name: 'Dark Harvest',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [
    { key: 'proc', label: 'Off cooldown', scope: 'combat', kind: 'toggle', default: true },
    { key: 'souls', label: 'Souls collected', scope: 'setup', kind: 'number', default: 0, min: 0, max: 100 },
  ],
  // Cooldown 35 (resets to 1s on takedown, not modeled); only hits below HarvestThreshold count.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: 35, requires: 'targetBelowHalfHealth' }],
  onHit: proc,
  onAbilityHit: proc,
};
