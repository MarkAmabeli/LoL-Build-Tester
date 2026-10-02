import type { DamageInstance, DamageType, ResolvedStats } from './types';

/** A stat an ability can scale with. Target-based stats read from the target. */
export type ScalingStat =
  | 'totalAD'
  | 'bonusAD'
  | 'baseAD'
  | 'AP'
  | 'maxHP'
  | 'bonusHP'
  | 'bonusArmor'
  | 'bonusMR'
  | 'maxMana'
  | 'targetMaxHP'
  | 'targetCurrentHP'
  | 'targetMissingHP';

export interface Ratio {
  stat: ScalingStat;
  /** Ratio value as a fraction (0.6 = 60%). Either one value or one per rank. */
  value: number | number[];
}

/** One damage component of an ability, e.g. "80/120/160 (+60% AP) magic damage". */
export interface DamageComponent {
  type: DamageType;
  /** Base damage per rank. A single value applies to all ranks. */
  base: number | number[];
  ratios?: Ratio[];
  label?: string;
  tags?: DamageInstance['tags'];
}

export interface TargetState {
  stats: ResolvedStats;
  /** Current HP; defaults to full. */
  currentHp?: number;
}

function atRank(value: number | number[], rank: number): number {
  if (!Array.isArray(value)) return value;
  if (value.length === 0) return 0;
  const i = Math.min(value.length, Math.max(1, rank)) - 1;
  return value[i];
}

export function readStat(stat: ScalingStat, attacker: ResolvedStats, target: TargetState): number {
  const targetMax = target.stats.hp.total;
  const targetCurrent = target.currentHp ?? targetMax;
  switch (stat) {
    case 'totalAD': return attacker.ad.total;
    case 'bonusAD': return attacker.ad.bonus;
    case 'baseAD': return attacker.ad.base;
    case 'AP': return attacker.ap;
    case 'maxHP': return attacker.hp.total;
    case 'bonusHP': return attacker.hp.bonus;
    case 'bonusArmor': return attacker.armor.bonus;
    case 'bonusMR': return attacker.mr.bonus;
    case 'maxMana': return attacker.mana.total;
    case 'targetMaxHP': return targetMax;
    case 'targetCurrentHP': return targetCurrent;
    case 'targetMissingHP': return targetMax - targetCurrent;
  }
}

/** Raw (pre-mitigation) damage of one component at a rank. */
export function evaluateComponent(
  component: DamageComponent,
  rank: number,
  attacker: ResolvedStats,
  target: TargetState,
): DamageInstance {
  let raw = atRank(component.base, rank);
  for (const ratio of component.ratios ?? []) {
    raw += atRank(ratio.value, rank) * readStat(ratio.stat, attacker, target);
  }
  return {
    type: component.type,
    raw,
    source: component.label ?? 'Ability',
    tags: component.tags ?? ['ability'],
  };
}

/** A basic attack. `crit: 'expected'` averages crit damage by crit chance. */
export function autoAttack(
  attacker: ResolvedStats,
  crit: boolean | 'expected' = 'expected',
): DamageInstance {
  const ad = attacker.ad.total;
  let mult = 1;
  if (crit === true) mult = attacker.critMultiplier;
  else if (crit === 'expected') mult = 1 + attacker.critChance * (attacker.critMultiplier - 1);
  return {
    type: 'physical',
    raw: ad * mult,
    source: 'Auto attack',
    tags: crit === true ? ['auto', 'crit'] : ['auto'],
  };
}
