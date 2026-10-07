import { blackCleaver } from './items/black-cleaver';
import { krakenSlayer } from './items/kraken-slayer';
import { nashorsTooth } from './items/nashors-tooth';
import { rabadonsDeathcap } from './items/rabadons-deathcap';
import { arcaneComet } from './runes/arcane-comet';
import { conqueror } from './runes/conqueror';
import { darkHarvest } from './runes/dark-harvest';
import { electrocute } from './runes/electrocute';
import { firstStrike } from './runes/first-strike';
import { lethalTempo } from './runes/lethal-tempo';
import { pressTheAttack } from './runes/press-the-attack';
import type { ActiveEffect, Effect, EffectState } from './types';

const ALL: Effect[] = [
  // Items
  rabadonsDeathcap, blackCleaver, nashorsTooth, krakenSlayer,
  // Keystones
  conqueror, electrocute, pressTheAttack, lethalTempo, arcaneComet, darkHarvest, firstStrike,
];

/** Implemented effects by Riot item/rune ID. */
export const EFFECTS: ReadonlyMap<string, Effect> = new Map(ALL.map((e) => [e.id, e]));

export function getEffect(id: string): Effect | undefined {
  return EFFECTS.get(id);
}

/** Pair an effect with its state: declared defaults, overridden by `overrides`. */
export function activate(effect: Effect, overrides: EffectState = {}): ActiveEffect {
  const defaults = Object.fromEntries((effect.state ?? []).map((f) => [f.key, f.default]));
  return { effect, state: { ...defaults, ...overrides } };
}

/** Activate every implemented effect among a list of item/rune IDs; unknown IDs are skipped. */
export function activateIds(ids: string[], overrides: Record<string, EffectState> = {}): ActiveEffect[] {
  return ids.flatMap((id) => {
    const effect = getEffect(id);
    return effect ? [activate(effect, overrides[id])] : [];
  });
}
