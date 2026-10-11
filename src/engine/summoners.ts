import { evaluateFormula, type TargetState } from './damage';
import type { HitResult } from './hit';
import { mitigate } from './mitigation';
import type { DamageInstance, Formula, ResolvedStats } from './types';

/** A summoner spell as written to summoners.json. Values come from the game data (one rank). */
export interface SummonerSpellRecord {
  /** Data Dragon ID, e.g. "SummonerDot". */
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Seconds, before summoner spell haste (not modeled). */
  cooldown?: number;
  range?: number;
  dataValues: Record<string, number[]>;
  formulas: Record<string, Formula>;
  unsupported: Record<string, string>;
}

export interface SummonerContext {
  attacker: ResolvedStats;
  target: TargetState;
  /** A translated formula of this spell, at the attacker's level. */
  formula(name: string): number;
}

/** Hand-written summoner spell damage. Spells that deal no damage to champions have none. */
export interface SummonerDefinition {
  id: string;
  hits(ctx: SummonerContext): DamageInstance[];
}

/**
 * Ignite: true damage over 5s (counted as one hit, like item burns). Per the wiki
 * (wiki-sources.json, "Ignite"), its damage can't be amplified by damage modifiers and it
 * applies no spell effects, so no item or rune effects touch it. Its Grievous Wounds
 * matter for healing (not modeled yet).
 */
export const ignite: SummonerDefinition = {
  id: 'SummonerDot',
  hits: ({ formula }) => [
    { type: 'true', raw: formula('TooltipTrueDamageCalculation'), source: 'Ignite', tags: ['summoner', 'dot'] },
  ],
};

/** Summoner spells with damage definitions, by Data Dragon ID. */
export const SUMMONER_DEFINITIONS: ReadonlyMap<string, SummonerDefinition> = new Map([ignite].map((d) => [d.id, d]));

/**
 * One use of a summoner spell against the target. Only resistances apply (true damage
 * ignores them); no item or rune effects run, since Ignite can't be amplified and applies
 * no spell effects. A spell with no damage definition deals nothing.
 */
export function summonerHit(spell: SummonerSpellRecord, input: { attacker: ResolvedStats; target: TargetState }): HitResult {
  const def = SUMMONER_DEFINITIONS.get(spell.id);
  if (!def) return { hits: [], total: 0 };
  const hits = def
    .hits({
      ...input,
      formula: (name) => {
        const formula = spell.formulas[name];
        if (!formula) throw new Error(`No translated formula "${name}" in ${spell.name}`);
        return evaluateFormula(formula, 1, input.attacker, input.target);
      },
    })
    .map((h) => mitigate(h, { attacker: input.attacker, target: input.target.stats }));
  return { hits, total: hits.reduce((sum, h) => sum + h.final, 0) };
}
