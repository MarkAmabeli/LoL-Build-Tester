import type { StatBonuses } from '../src/engine/types.ts';

/**
 * Data Dragon's structured `stats` only covers some item stats. Ability haste,
 * lethality and penetration appear only in the HTML description's <stats> block,
 * e.g. "<stats><attention>20</attention> Ability Haste<br>...</stats>".
 */
export interface DescriptionStats {
  abilityHaste?: number;
  lethality?: number;
  armorPenPct?: number;
  magicPenFlat?: number;
  magicPenPct?: number;
}

const PATTERNS: Array<[keyof DescriptionStats, RegExp, boolean]> = [
  // [key, pattern, value is a percentage]
  ['abilityHaste', /(\d+(?:\.\d+)?)\s*Ability Haste/i, false],
  ['lethality', /(\d+(?:\.\d+)?)\s*Lethality/i, false],
  ['armorPenPct', /(\d+(?:\.\d+)?)%\s*Armor Penetration/i, true],
  ['magicPenPct', /(\d+(?:\.\d+)?)%\s*Magic Penetration/i, true],
  ['magicPenFlat', /(\d+(?:\.\d+)?)\s*Magic Penetration/i, false],
];

export function parseItemDescriptionStats(description: string): DescriptionStats {
  const block = /<stats>([\s\S]*?)<\/stats>/i.exec(description)?.[1] ?? '';
  // Strip tags so "<attention>20</attention> Ability Haste" becomes "20 Ability Haste".
  const lines = block.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split('\n');

  const out: DescriptionStats = {};
  for (const line of lines) {
    for (const [key, re, isPct] of PATTERNS) {
      if (out[key] !== undefined) continue;
      // Don't let "40% Magic Penetration" also match the flat pattern.
      if (key === 'magicPenFlat' && /%\s*Magic Penetration/i.test(line)) continue;
      const m = re.exec(line);
      if (m) out[key] = isPct ? Number(m[1]) / 100 : Number(m[1]);
    }
  }
  return out;
}

/** Map Data Dragon's stat keys (+ description stats) onto the engine's StatBonuses. */
export function toStatBonuses(dd: Record<string, number>, text: DescriptionStats): StatBonuses {
  const s: StatBonuses = {
    hp: dd.FlatHPPoolMod,
    mana: dd.FlatMPPoolMod,
    ad: dd.FlatPhysicalDamageMod,
    ap: dd.FlatMagicDamageMod,
    armor: dd.FlatArmorMod,
    mr: dd.FlatSpellBlockMod,
    // Data Dragon stores these as fractions (0.4 = 40%).
    attackSpeedPct: dd.PercentAttackSpeedMod !== undefined ? dd.PercentAttackSpeedMod * 100 : undefined,
    critChance: dd.FlatCritChanceMod,
    moveSpeed: dd.FlatMovementSpeedMod,
    ...text,
  };
  // Drop undefined/zero entries to keep the JSON small.
  return Object.fromEntries(
    Object.entries(s).filter(([, v]) => typeof v === 'number' && v !== 0),
  ) as StatBonuses;
}
