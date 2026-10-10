import { archangelsStaff, seraphsEmbrace } from './items/archangels-staff';
import { blackCleaver } from './items/black-cleaver';
import { blackfireTorch } from './items/blackfire-torch';
import { bladeOfTheRuinedKing } from './items/blade-of-the-ruined-king';
import { experimentalHexplate } from './items/experimental-hexplate';
import { guinsoosRageblade } from './items/guinsoos-rageblade';
import { hubris } from './items/hubris';
import { hullbreaker } from './items/hullbreaker';
import { krakenSlayer } from './items/kraken-slayer';
import { liandrysTorment } from './items/liandrys-torment';
import { lordDominiksRegards } from './items/lord-dominiks-regards';
import { ludensEcho } from './items/ludens-echo';
import { malignance } from './items/malignance';
import { manamune, muramana } from './items/manamune';
import { nashorsTooth } from './items/nashors-tooth';
import { rabadonsDeathcap } from './items/rabadons-deathcap';
import { riftmaker } from './items/riftmaker';
import { shadowflame } from './items/shadowflame';
import { stormsurge } from './items/stormsurge';
import { terminus } from './items/terminus';
import { titanicHydra } from './items/titanic-hydra';
import { voltaicCyclosword } from './items/voltaic-cyclosword';
import { witsEnd } from './items/wits-end';
import { absoluteFocus } from './runes/absolute-focus';
import { arcaneComet } from './runes/arcane-comet';
import { axiomArcanist } from './runes/axiom-arcanist';
import { cheapShot } from './runes/cheap-shot';
import { conditioning } from './runes/conditioning';
import { conqueror } from './runes/conqueror';
import { coupDeGrace } from './runes/coup-de-grace';
import { cutDown } from './runes/cut-down';
import { darkHarvest } from './runes/dark-harvest';
import { electrocute } from './runes/electrocute';
import { firstStrike } from './runes/first-strike';
import { gatheringStorm } from './runes/gathering-storm';
import { jackOfAllTrades } from './runes/jack-of-all-trades';
import { lastStand } from './runes/last-stand';
import { legendAlacrity } from './runes/legend-alacrity';
import { legendHaste } from './runes/legend-haste';
import { lethalTempo } from './runes/lethal-tempo';
import { overgrowth } from './runes/overgrowth';
import { pressTheAttack } from './runes/press-the-attack';
import { scorch } from './runes/scorch';
import { suddenImpact } from './runes/sudden-impact';
import { transcendence } from './runes/transcendence';
import { waterwalking } from './runes/waterwalking';
import type { ActiveEffect, Effect, EffectState } from './types';

const ALL: Effect[] = [
  // Items
  rabadonsDeathcap, blackCleaver, nashorsTooth, krakenSlayer,
  witsEnd, terminus, bladeOfTheRuinedKing, guinsoosRageblade, hullbreaker, titanicHydra,
  lordDominiksRegards, shadowflame, liandrysTorment, riftmaker,
  manamune, muramana, archangelsStaff, seraphsEmbrace, blackfireTorch, hubris, voltaicCyclosword, experimentalHexplate,
  ludensEcho, malignance, stormsurge,
  // Keystones
  conqueror, electrocute, pressTheAttack, lethalTempo, arcaneComet, darkHarvest, firstStrike,
  // Minor runes
  coupDeGrace, cutDown, lastStand, absoluteFocus, gatheringStorm,
  cheapShot, suddenImpact, scorch, axiomArcanist, legendAlacrity, legendHaste, transcendence, waterwalking,
  jackOfAllTrades,
  // Defensive runes (for the target's loadout)
  conditioning, overgrowth,
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
