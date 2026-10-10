import { evaluateFormula, type TargetState } from '../damage';
import { activate } from '../effects/registry';
import type { ActiveEffect, EffectState } from '../effects/types';
import { computeHit, type HitResult } from '../hit';
import type { ResolvedStats } from '../types';
import { dataValue, spellOf } from './spells';
import type { AbilityContext, ChampionDefinition, ChampionSpells, Ranks } from './types';

export * from './types';
export { dataValue, selfFormula } from './spells';
export { CHAMPIONS, getChampion } from './registry';

export interface AbilityInput {
  rank: number;
  attacker: ResolvedStats;
  target: TargetState;
  /** Items, runes and champion effects, as for `computeHit`. */
  effects?: ActiveEffect[];
  /** Overrides for the ability's state. */
  state?: EffectState;
  crit?: boolean | 'expected';
}

/** The champion's passives and self-buffs for the learned ranks, with default state. */
export function championEffects(def: ChampionDefinition, spells: ChampionSpells, ranks: Ranks): ActiveEffect[] {
  return (def.effects?.(spells, ranks) ?? []).map((e) => activate(e));
}

/** One use of an ability, through the full item/rune pipeline. */
export function abilityHit(def: ChampionDefinition, spells: ChampionSpells, id: string, input: AbilityInput): HitResult {
  const ability = def.abilities.find((a) => a.id === id);
  if (!ability) throw new Error(`${def.id} has no ability "${id}"`);
  const defaults = Object.fromEntries((ability.state ?? []).map((f) => [f.key, f.default]));
  const ctx: AbilityContext = {
    attacker: input.attacker,
    target: input.target,
    rank: input.rank,
    state: { ...defaults, ...input.state },
    crit: input.crit ?? 'expected',
    formula: (spell, name, context) => {
      const formula = spellOf(spells, spell).formulas[name];
      if (!formula) throw new Error(`No translated formula "${name}" in spell "${spell}"`);
      return evaluateFormula(formula, input.rank, input.attacker, input.target, context);
    },
    value: (spell, name) => dataValue(spells, spell, name, input.rank),
  };
  const hits = ability.hits(ctx).map((h) =>
    ability.slot === 'R' && h.tags?.includes('ability') && !h.tags.includes('ultimate')
      ? { ...h, tags: [...h.tags, 'ultimate' as const] }
      : h,
  );
  if (hits.length === 0) return { hits: [], total: 0 };
  return computeHit(hits[0], {
    attacker: input.attacker,
    target: input.target,
    effects: input.effects,
    extra: hits.slice(1),
  });
}
