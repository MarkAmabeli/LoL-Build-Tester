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
  /** A data value of this spell. */
  value(name: string): number;
  /** Smite's level (role quests: Primal once the jungle quest is done). */
  smite: 'basic' | 'primal';
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

/**
 * Smite: only Primal Smite (jungle quest completed) can hit champions here, for 40 true damage
 * (SecondPVPDamage). Like Ignite, its damage isn't amplified and applies no spell effects
 * (wiki, "Smite"). The intermediate Unleashed Smite (FirstPVPDamage) and the pets' Primal
 * Smite effects aren't modeled yet.
 */
export const smite: SummonerDefinition = {
  id: 'SummonerSmite',
  hits: ({ value, smite: tier }) =>
    tier === 'primal' ? [{ type: 'true', raw: value('SecondPVPDamage'), source: 'Primal Smite', tags: ['summoner'] }] : [],
};

/** Summoner spells with damage definitions, by Data Dragon ID. */
export const SUMMONER_DEFINITIONS: ReadonlyMap<string, SummonerDefinition> = new Map([ignite, smite].map((d) => [d.id, d]));

/**
 * One use of a summoner spell against the target. Only resistances apply (true damage
 * ignores them); no item or rune effects run, since Ignite and Smite can't be amplified and
 * apply no spell effects. A spell with no damage definition deals nothing. `smite` comes
 * from the loadout (`ResolvedLoadout.smite`).
 */
export function summonerHit(
  spell: SummonerSpellRecord,
  input: { attacker: ResolvedStats; target: TargetState; smite?: 'basic' | 'primal' },
): HitResult {
  const def = SUMMONER_DEFINITIONS.get(spell.id);
  if (!def) return { hits: [], total: 0 };
  const hits = def
    .hits({
      attacker: input.attacker,
      target: input.target,
      smite: input.smite ?? 'basic',
      value: (name) => {
        const values = spell.dataValues[name];
        if (!values?.length) throw new Error(`No data value "${name}" in ${spell.name}`);
        // Entry 0 is a placeholder, as in champion spells; one rank.
        return values[Math.min(1, values.length - 1)];
      },
      formula: (name) => {
        const formula = spell.formulas[name];
        if (!formula) throw new Error(`No translated formula "${name}" in ${spell.name}`);
        return evaluateFormula(formula, 1, input.attacker, input.target);
      },
    })
    .map((h) => mitigate(h, { attacker: input.attacker, target: input.target.stats }));
  return { hits, total: hits.reduce((sum, h) => sum + h.final, 0) };
}
