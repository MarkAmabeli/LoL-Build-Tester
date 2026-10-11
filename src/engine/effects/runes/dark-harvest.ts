import { targetHpPct } from '../../damage';
import type { Effect, HitContext } from '../types';
import { adaptiveProc } from './adaptive';
import { perk, sourced } from '../../hand';

const BASE = sourced('darkHarvest.base', perk('8128', 'BaseDamage', 30));
const PER_SOUL = sourced('darkHarvest.perSoul', perk('8128', 'DamagePerSoulEssence', 11));
const BONUS_AD_RATIO = sourced('darkHarvest.bonusAdRatio', perk('8128', 'ADRatio', 0.1));
const AP_RATIO = sourced('darkHarvest.apRatio', perk('8128', 'APRatio', 0.05));
const HEALTH_THRESHOLD = sourced('darkHarvest.healthThreshold', perk('8128', 'HarvestThreshold', 0.5));
const COOLDOWN = sourced('darkHarvest.cooldown', perk('8128', 'Cooldown', 35));

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
  // The reset on takedown isn't modeled; only hits below the health threshold count.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'hit', hits: 1, cooldown: COOLDOWN, requires: 'targetBelowHalfHealth' }],
  onHit: proc,
  onAbilityHit: proc,
};
