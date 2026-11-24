import { evaluateFormula } from '../damage';
import { cooldownWithHaste, hasteFor } from '../stats';
import type { ResolvedStats } from '../types';
import type { AbilityDefinition, ChampionSpells, SpellRecord } from './types';

export function spellOf(spells: ChampionSpells, name: string): SpellRecord {
  const spell = spells[name];
  if (!spell) throw new Error(`No spell "${name}" in the champion's spell data`);
  return spell;
}

/**
 * A raw data value at a rank (1-based). Entry 0 of the bin's list is a placeholder,
 * so rank N is entry N; single-entry lists apply to every rank.
 */
export function dataValue(spells: ChampionSpells, spell: string, name: string, rank: number): number {
  const values = spellOf(spells, spell).dataValues[name];
  if (!values) throw new Error(`No data value "${name}" in spell "${spell}"`);
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  return values[Math.min(Math.max(1, rank), values.length - 1)];
}

/**
 * A translated formula evaluated for the champion alone, for effects (stat buffs, procs
 * with no target scaling). Target-based ratios would read the champion's own stats.
 */
export function selfFormula(spells: ChampionSpells, spell: string, name: string, rank: number, stats: ResolvedStats): number {
  const formula = spellOf(spells, spell).formulas[name];
  if (!formula) throw new Error(`No translated formula "${name}" in spell "${spell}"`);
  return evaluateFormula(formula, rank, stats, { stats });
}

/** The spell record an ability's cooldown, cost and range come from: its `spell`, else the one in its slot. */
export function abilitySpell(spells: ChampionSpells, ability: AbilityDefinition): SpellRecord | undefined {
  if (ability.spell) return spellOf(spells, ability.spell);
  return Object.values(spells).find((s) => s.slot === ability.slot);
}

/** Per-rank value at a rank (1-based), clamped to the known ranks. */
function atRank(values: number[] | undefined, rank: number): number | undefined {
  if (!values || values.length === 0) return undefined;
  return values[Math.min(values.length, Math.max(1, rank)) - 1];
}

/**
 * An ability's cooldown at a rank after ability haste (the ultimate also gets ultimate haste,
 * basic abilities basic haste). Undefined when the data has no usable cooldown.
 */
export function abilityCooldown(
  spells: ChampionSpells,
  ability: AbilityDefinition,
  rank: number,
  stats: ResolvedStats,
): number | undefined {
  const base = atRank(abilitySpell(spells, ability)?.cooldown, rank);
  if (base === undefined) return undefined;
  return cooldownWithHaste(base, hasteFor(stats, ability.slot === 'R' ? 'ultimate' : 'basic'));
}

/** An ability's cost and range at a rank, when the data has them. */
export function abilityCostAndRange(
  spells: ChampionSpells,
  ability: AbilityDefinition,
  rank: number,
): { cost?: number; range?: number } {
  const spell = abilitySpell(spells, ability);
  return { cost: atRank(spell?.cost, rank), range: atRank(spell?.range, rank) };
}
