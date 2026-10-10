import type { Formula, Ratio, ScalingStat } from '../src/engine/types.ts';

/**
 * Translates CommunityDragon SpellCalculations (as stored in spells/<Champion>.json)
 * into the engine's linear `Formula` shape: a base per rank, a base by level and
 * stat ratios. Anything that doesn't fit (stat × stat, conditions, unknown parts)
 * is reported as unsupported with a reason rather than guessed.
 */

export const MAX_LEVEL = 18;

/** Thrown for calculations the linear model can't express. */
export class Unsupported extends Error {}

// ---- Scalars: a constant, a value per rank, or a value per level ----

type Scalar =
  | { kind: 'const'; v: number }
  | { kind: 'rank'; v: number[] }
  | { kind: 'level'; v: number[] };

const konst = (v: number): Scalar => ({ kind: 'const', v });

function combine(a: Scalar, b: Scalar, op: (x: number, y: number) => number, what: string): Scalar {
  if (a.kind === 'const' && b.kind === 'const') return konst(op(a.v, b.v));
  if (a.kind !== 'const' && b.kind !== 'const' && a.kind !== b.kind) {
    throw new Unsupported(`${what} of a per-rank and a per-level value`);
  }
  const kind = a.kind === 'const' ? b.kind : a.kind;
  const len = Math.max(a.kind === 'const' ? 0 : a.v.length, b.kind === 'const' ? 0 : b.v.length);
  const at = (s: Scalar, i: number) => (s.kind === 'const' ? s.v : s.v[Math.min(i, s.v.length - 1)]);
  // Simplify so that e.g. 0 × per-rank stays a constant 0 and can still be added to a per-level value.
  return simplify({ kind, v: Array.from({ length: len }, (_, i) => op(at(a, i), at(b, i))) } as Scalar);
}
const mul = (a: Scalar, b: Scalar) => combine(a, b, (x, y) => x * y, 'Product');
const add = (a: Scalar, b: Scalar) => combine(a, b, (x, y) => x + y, 'Sum');

/** Collapse arrays whose entries are all equal into a constant. */
function simplify(s: Scalar): Scalar {
  if (s.kind === 'const' || s.v.length === 0) return s.kind === 'const' ? s : konst(0);
  return s.v.every((x) => x === s.v[0]) ? konst(s.v[0]) : s;
}

// ---- Linear expressions: base (per rank and per level) + Σ scalar × stat ----

interface Expr {
  rankBase: Scalar;
  levelBase: Scalar;
  ratios: Map<ScalingStat, Scalar>;
}

const emptyExpr = (): Expr => ({ rankBase: konst(0), levelBase: konst(0), ratios: new Map() });

function exprOfScalar(s: Scalar): Expr {
  const e = emptyExpr();
  if (s.kind === 'level') e.levelBase = s;
  else e.rankBase = s;
  return e;
}

function addExpr(a: Expr, b: Expr): Expr {
  const ratios = new Map(a.ratios);
  for (const [stat, s] of b.ratios) ratios.set(stat, ratios.has(stat) ? add(ratios.get(stat)!, s) : s);
  return { rankBase: add(a.rankBase, b.rankBase), levelBase: add(a.levelBase, b.levelBase), ratios };
}

function scaleExpr(e: Expr, s: Scalar): Expr {
  const ratios = new Map<ScalingStat, Scalar>();
  for (const [stat, r] of e.ratios) ratios.set(stat, mul(r, s));
  // A per-level base times a per-rank multiplier can't stay linear; mul() throws for it.
  return { rankBase: mul(e.rankBase, s), levelBase: mul(e.levelBase, s), ratios };
}

const isPureScalar = (e: Expr) => e.ratios.size === 0;
function asScalar(e: Expr, what: string): Scalar {
  if (!isPureScalar(e)) throw new Unsupported(`${what} scales with a stat (stat × stat)`);
  const r = simplify(e.rankBase);
  const l = simplify(e.levelBase);
  if (l.kind === 'const' && l.v === 0) return r;
  if (r.kind === 'const' && r.v === 0) return l;
  return add(r, l); // throws when both vary
}

// ---- Stat codes (inferred from usage; see ROADMAP) ----

/** [mStat, mStatFormula] → engine stat. Formula 0 = total, 1 = base, 2 = bonus. */
function statFor(code: number, formula: number, ofTarget: boolean): ScalingStat {
  if (ofTarget) {
    if (code === 12 && formula === 0) return 'targetMaxHP';
    if (code === 12 && formula === 2) return 'targetBonusHP';
    if (code === 13) return 'targetCurrentHP';
    throw new Unsupported(`target stat code ${code}/${formula}`);
  }
  const table: Record<string, ScalingStat> = {
    '0/0': 'AP', '0/2': 'AP',
    '1/0': 'totalArmor', '1/2': 'bonusArmor',
    '2/0': 'totalAD', '2/1': 'baseAD', '2/2': 'bonusAD',
    '4/0': 'attackSpeed', '4/2': 'bonusAttackSpeed',
    '6/0': 'totalMR', '6/2': 'bonusMR',
    '7/0': 'moveSpeed',
    '8/0': 'critChance',
    '12/0': 'maxHP', '12/1': 'baseHP', '12/2': 'bonusHP',
    '29/0': 'lethality',
  };
  const stat = table[`${code}/${formula}`];
  if (!stat) throw new Unsupported(`stat code ${code}/${formula}`);
  return stat;
}

// ---- Bin shapes (loose) ----

type Part = Record<string, unknown> & { __type?: string };
export type Calculation = Part;
export interface SpellData {
  dataValues: Record<string, number[]>;
  calculations: Record<string, Calculation>;
}

/** The hashed key CommunityDragon uses for "this stat belongs to the target". */
const OF_TARGET_KEY = '{a8cb9c14}';
/** The hashed part type that references another calculation by name. */
const CALC_REFERENCE_TYPE = '{f3cbe7b2}';

/** Value of `level` (1-18) for Riot's ByCharLevelBreakpoints part. */
export function breakpointsAt(part: Part, level: number): number {
  const breakpoints = ((part.mBreakpoints as Part[] | undefined) ?? [])
    .map((b) => ({
      level: Number(b.mLevel),
      add: Number(b.mAdditionalBonusAtThisLevel ?? 0),
      perLevel: b.mBonusPerLevelAtAndAfter === undefined ? undefined : Number(b.mBonusPerLevelAtAndAfter),
    }))
    .sort((a, b) => a.level - b.level);
  let value = Number(part.mLevel1Value ?? 0);
  let perLevel = Number(part.mInitialBonusPerLevel ?? 0);
  for (let lvl = 2; lvl <= level; lvl++) {
    for (const b of breakpoints) {
      if (b.level !== lvl) continue;
      value += b.add;
      if (b.perLevel !== undefined) perLevel = b.perLevel;
    }
    value += perLevel;
  }
  return value;
}

const byLevel = (f: (level: number) => number): Scalar => ({
  kind: 'level',
  v: Array.from({ length: MAX_LEVEL }, (_, i) => f(i + 1)),
});

class Translator {
  private readonly values = new Map<string, number[]>();
  private readonly visiting = new Set<string>();
  private readonly spell: SpellData;
  private readonly maxRank: number;

  constructor(spell: SpellData, maxRank: number) {
    this.spell = spell;
    this.maxRank = maxRank;
    // Names are matched without case: the bins aren't consistent (e.g. Nasus R's
    // calculation refers to "AoeDamagePercent" but the value is "AOEDamagePercent").
    for (const [name, values] of Object.entries(spell.dataValues)) this.values.set(name.toLowerCase(), values);
  }

  /** A data value per rank. Entry 0 of the bin's list is a placeholder; ranks start at entry 1. */
  dataValue(name: unknown): Scalar {
    const values = this.values.get(String(name).toLowerCase());
    if (!values) throw new Unsupported(`missing data value "${String(name)}"`);
    if (values.length === 0) throw new Unsupported(`data value "${String(name)}" has no numbers`);
    if (values.length === 1) return konst(values[0]);
    const ranks = Array.from({ length: this.maxRank }, (_, i) => values[Math.min(i + 1, values.length - 1)]);
    return simplify({ kind: 'rank', v: ranks });
  }

  calculation(name: string): Expr {
    const calc = this.spell.calculations[name];
    if (!calc) throw new Unsupported(`missing calculation "${name}"`);
    if (this.visiting.has(name)) throw new Unsupported(`calculation "${name}" refers to itself`);
    this.visiting.add(name);
    try {
      return this.calc(calc);
    } finally {
      this.visiting.delete(name);
    }
  }

  calc(calc: Calculation): Expr {
    switch (calc.__type) {
      case 'GameCalculation': {
        const parts = (calc.mFormulaParts as Part[] | undefined) ?? [];
        const sum = parts.map((p) => this.part(p)).reduce(addExpr, emptyExpr());
        return calc.mMultiplier ? scaleExpr(sum, this.scalar(calc.mMultiplier as Part)) : sum;
      }
      case 'GameCalculationModified': {
        const inner = this.calculation(String(calc.mModifiedGameCalculation));
        return calc.mMultiplier ? scaleExpr(inner, this.scalar(calc.mMultiplier as Part)) : inner;
      }
      case 'GameCalculationConditional':
        throw new Unsupported('conditional calculation (depends on a game condition)');
      default:
        throw new Unsupported(`calculation type ${calc.__type}`);
    }
  }

  scalar(part: Part): Scalar {
    return asScalar(this.part(part), part.__type ?? 'part');
  }

  part(part: Part): Expr {
    const ofTarget = part[OF_TARGET_KEY] === true;
    const stat = () => statFor(Number(part.mStat ?? 0), Number(part.mStatFormula ?? 0), ofTarget);
    const ratio = (s: ScalingStat, value: Scalar): Expr => ({ ...emptyExpr(), ratios: new Map([[s, value]]) });

    switch (part.__type) {
      case 'NamedDataValueCalculationPart':
        return exprOfScalar(this.dataValue(part.mDataValue));
      case 'NumberCalculationPart':
        return exprOfScalar(konst(Number(part.mNumber)));
      case 'ByCharLevelInterpolationCalculationPart': {
        const start = Number(part.mStartValue ?? 0);
        const end = Number(part.mEndValue ?? 0);
        return exprOfScalar(byLevel((l) => start + ((end - start) * (l - 1)) / (MAX_LEVEL - 1)));
      }
      case 'ByCharLevelBreakpointsCalculationPart':
        return exprOfScalar(byLevel((l) => breakpointsAt(part, l)));
      case 'StatByCoefficientCalculationPart':
        return ratio(stat(), konst(Number(part.mCoefficient ?? 0)));
      case 'StatByNamedDataValueCalculationPart':
        return ratio(stat(), this.dataValue(part.mDataValue));
      case 'StatBySubPartCalculationPart':
        return ratio(stat(), this.scalar(part.mSubpart as Part));
      case 'BuffCounterByCoefficientCalculationPart':
        return ratio('stacks', konst(Number(part.mCoefficient ?? 0)));
      case 'BuffCounterByNamedDataValueCalculationPart':
        return ratio('stacks', this.dataValue(part.mDataValue));
      case 'AbilityResourceByCoefficientCalculationPart':
        return ratio(Number(part.mStatFormula ?? 0) === 2 ? 'bonusMana' : 'maxMana', konst(Number(part.mCoefficient ?? 0)));
      case 'SumOfSubPartsCalculationPart':
        return ((part.mSubparts as Part[] | undefined) ?? []).map((p) => this.part(p)).reduce(addExpr, emptyExpr());
      case 'ProductOfSubPartsCalculationPart': {
        const a = this.part(part.mPart1 as Part);
        const b = this.part(part.mPart2 as Part);
        if (isPureScalar(a)) return scaleExpr(b, asScalar(a, 'product'));
        if (isPureScalar(b)) return scaleExpr(a, asScalar(b, 'product'));
        throw new Unsupported('product of two stats (stat × stat)');
      }
      case CALC_REFERENCE_TYPE:
        return this.calculation(String(part.mSpellCalculationKey));
      default:
        throw new Unsupported(`part type ${part.__type}`);
    }
  }
}

/**
 * The bins store 32-bit floats (0.04 is 0.0399999991…), which hold about 7 significant
 * digits; rounding to that removes the noise without changing any real value.
 */
const clean = (x: number) => Number(x.toPrecision(7));
const cleanScalar = (s: Scalar): Scalar =>
  simplify(s.kind === 'const' ? konst(clean(s.v)) : { kind: s.kind, v: s.v.map(clean) });

function toFormula(e: Expr): Formula {
  const rankBase = cleanScalar(e.rankBase);
  const levelBase = cleanScalar(e.levelBase);
  const formula: Formula = { base: rankBase.v };
  if (!(levelBase.kind === 'const' && levelBase.v === 0)) {
    formula.baseByLevel = levelBase.kind === 'const' ? Array(MAX_LEVEL).fill(levelBase.v) : levelBase.v;
  }
  const ratios: Ratio[] = [];
  for (const [stat, raw] of e.ratios) {
    const s = cleanScalar(raw);
    if (s.kind === 'const' && s.v === 0) continue;
    ratios.push(s.kind === 'level' ? { stat, value: 0, valueByLevel: s.v } : { stat, value: s.v });
  }
  if (ratios.length > 0) formula.ratios = ratios;
  return formula;
}

export interface TranslatedSpell {
  formulas: Record<string, Formula>;
  /** Calculation name → why it wasn't translated. */
  unsupported: Record<string, string>;
}

/** Translate every calculation of a spell; ranks run from 1 to `maxRank`. */
export function translateSpell(spell: SpellData, maxRank: number): TranslatedSpell {
  const translator = new Translator(spell, maxRank);
  const out: TranslatedSpell = { formulas: {}, unsupported: {} };
  for (const name of Object.keys(spell.calculations)) {
    try {
      out.formulas[name] = toFormula(translator.calculation(name));
    } catch (err) {
      if (!(err instanceof Unsupported)) throw err;
      out.unsupported[name] = err.message;
    }
  }
  return out;
}
