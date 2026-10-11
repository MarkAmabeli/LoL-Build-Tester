import { byLevel } from '../../stats';
import type { Effect, HitContext } from '../types';
import { adaptiveProc } from './adaptive';
import { hand, perk, runeText, sourced } from '../../hand';

const DAMAGE_L1 = sourced('electrocute.damageL1', perk('8112', 'DamageBase', 70));
const DAMAGE_L18 = sourced('electrocute.damageL18', perk('8112', 'DamageMax', 240));
const BONUS_AD_RATIO = sourced('electrocute.bonusAdRatio', perk('8112', 'BonusADRatio', 0.1));
const AP_RATIO = sourced('electrocute.apRatio', perk('8112', 'APRatio', 0.05));
const HITS = hand('electrocute.hits', 3, runeText(8112, '3 separate attacks or abilities'));
const WINDOW_SECONDS = sourced('electrocute.windowSeconds', perk('8112', 'WindowDuration', 3));
const COOLDOWN = sourced('electrocute.cooldown', perk('8112', 'Cooldown', 20));

const proc = ({ attacker, state }: HitContext) =>
  state.proc
    ? [adaptiveProc(
        attacker,
        byLevel(DAMAGE_L1, DAMAGE_L18, attacker.level) + BONUS_AD_RATIO * attacker.ad.bonus + AP_RATIO * attacker.ap,
        'Electrocute',
      )]
    : [];

/** Hitting a champion with 3 separate attacks or abilities within 3s deals bonus adaptive damage. */
export const electrocute: Effect = {
  id: '8112',
  name: 'Electrocute',
  kind: 'rune',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Third hit (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // The window starts at the first hit and doesn't refresh. Ignite's cast counts as a hit (wiki).
  cycles: [{ kind: 'proc', field: 'proc', counts: ['hit', 'igniteCast'], hits: HITS, window: { seconds: WINDOW_SECONDS, from: 'first' }, cooldown: COOLDOWN }],
  onHit: proc,
  onAbilityHit: proc,
};
