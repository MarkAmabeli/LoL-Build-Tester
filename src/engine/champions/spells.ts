import { evaluateFormula } from '../damage';
import type { ResolvedStats } from '../types';
import type { ChampionSpells, SpellRecord } from './types';

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
