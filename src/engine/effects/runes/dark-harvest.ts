import type { Effect, HitContext } from '../types';
import { adaptiveProc } from './adaptive';

// CommunityDragon perks Domination/DarkHarvest: 30 + 11 per soul, +0.1 bonus AD, +0.05 AP, below 50% health.
const BASE = 30;
const PER_SOUL = 11;
const BONUS_AD_RATIO = 0.1;
const AP_RATIO = 0.05;
const HEALTH_THRESHOLD = 0.5;

const proc = ({ attacker, target, state }: HitContext) => {
  const maxHp = target.stats.hp.total;
  const below = (target.currentHp ?? maxHp) < HEALTH_THRESHOLD * maxHp;
  if (!state.proc || !below) return [];
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
    { key: 'proc', label: 'Off cooldown', kind: 'toggle', default: true },
    { key: 'souls', label: 'Souls collected', kind: 'number', default: 0, min: 0, max: 100 },
  ],
  onHit: proc,
  onAbilityHit: proc,
};
