import type { DamageInstance, DamageType, Formula, ResolvedStats, ScalingStat } from './types';

/** One damage component of an ability, e.g. "80/120/160 (+60% AP) magic damage". */
export interface DamageComponent extends Formula {
  type: DamageType;
  label?: string;
  tags?: DamageInstance['tags'];
}

/** Values a formula needs beyond attacker and target stats. */
export interface FormulaContext {
  /** For the `stacks` scaling stat. */
  stacks?: number;
}

export interface TargetState {
  stats: ResolvedStats;
  /** Current HP; defaults to full. */
  currentHp?: number;
}

/** Target's current health as a fraction of max (1 = full). */
export function targetHpPct(target: TargetState): number {
  const max = target.stats.hp.total;
  return max > 0 ? (target.currentHp ?? max) / max : 1;
}

function atRank(value: number | number[], rank: number): number {
  if (!Array.isArray(value)) return value;
  if (value.length === 0) return 0;
  const i = Math.min(value.length, Math.max(1, rank)) - 1;
  return value[i];
}

export function readStat(
  stat: ScalingStat,
  attacker: ResolvedStats,
  target: TargetState,
  context: FormulaContext = {},
): number {
  const targetMax = target.stats.hp.total;
  const targetCurrent = target.currentHp ?? targetMax;
  switch (stat) {
    case 'totalAD': return attacker.ad.total;
    case 'bonusAD': return attacker.ad.bonus;
    case 'baseAD': return attacker.ad.base;
    case 'AP': return attacker.ap;
    case 'maxHP': return attacker.hp.total;
    case 'baseHP': return attacker.hp.base;
    case 'bonusHP': return attacker.hp.bonus;
    case 'totalArmor': return attacker.armor.total;
    case 'bonusArmor': return attacker.armor.bonus;
    case 'totalMR': return attacker.mr.total;
    case 'bonusMR': return attacker.mr.bonus;
    case 'maxMana': return attacker.mana.total;
    case 'bonusMana': return attacker.mana.bonus;
    case 'attackSpeed': return attacker.attackSpeed;
    case 'bonusAttackSpeed': return attacker.bonusAttackSpeedPct / 100;
    case 'critChance': return attacker.critChance;
    case 'lethality': return attacker.lethality;
    case 'moveSpeed': return attacker.moveSpeed;
    case 'stacks': return context.stacks ?? 0;
    case 'targetMaxHP': return targetMax;
    case 'targetBonusHP': return target.stats.hp.bonus;
    case 'targetCurrentHP': return targetCurrent;
    case 'targetMissingHP': return targetMax - targetCurrent;
  }
}

function atLevel(values: number[], level: number): number {
  if (values.length === 0) return 0;
  return values[Math.min(values.length, Math.max(1, Math.round(level))) - 1];
}

/** A formula's value at a rank, for this attacker (level and stats) and target. */
export function evaluateFormula(
  formula: Formula,
  rank: number,
  attacker: ResolvedStats,
  target: TargetState,
  context: FormulaContext = {},
): number {
  let value = atRank(formula.base, rank);
  if (formula.baseByLevel) value += atLevel(formula.baseByLevel, attacker.level);
  for (const ratio of formula.ratios ?? []) {
    const coefficient = ratio.valueByLevel ? atLevel(ratio.valueByLevel, attacker.level) : atRank(ratio.value, rank);
    value += coefficient * readStat(ratio.stat, attacker, target, context);
  }
  return value;
}

/** Raw (pre-mitigation) damage of one component at a rank. */
export function evaluateComponent(
  component: DamageComponent,
  rank: number,
  attacker: ResolvedStats,
  target: TargetState,
  context: FormulaContext = {},
): DamageInstance {
  return {
    type: component.type,
    raw: evaluateFormula(component, rank, attacker, target, context),
    source: component.label ?? 'Ability',
    tags: component.tags ?? ['ability'],
  };
}

/** Damage multiplier for an attack's crit: ×1, × the crit multiplier, or averaged by crit chance. */
export function critFactor(attacker: ResolvedStats, crit: boolean | 'expected'): number {
  if (crit === true) return attacker.critMultiplier;
  if (crit === 'expected') return 1 + attacker.critChance * (attacker.critMultiplier - 1);
  return 1;
}

/** A basic attack. `crit: 'expected'` averages crit damage by crit chance. */
export function autoAttack(
  attacker: ResolvedStats,
  crit: boolean | 'expected' = 'expected',
): DamageInstance {
  return {
    type: 'physical',
    raw: attacker.ad.total * critFactor(attacker, crit),
    source: 'Auto attack',
    tags: crit === true ? ['auto', 'crit'] : ['auto'],
  };
}
