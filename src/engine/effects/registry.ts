import { blackCleaver } from './items/black-cleaver';
import { krakenSlayer } from './items/kraken-slayer';
import { nashorsTooth } from './items/nashors-tooth';
import { rabadonsDeathcap } from './items/rabadons-deathcap';
import type { ActiveEffect, Effect, EffectState } from './types';

const ALL: Effect[] = [rabadonsDeathcap, blackCleaver, nashorsTooth, krakenSlayer];

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
