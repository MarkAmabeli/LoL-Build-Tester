/**
 * Snapshot of the game-file values that hand-entered engine constants are checked against
 * (src/engine/hand.ts). Written per patch to public/data/<version>/game-values.json, so
 * `npm test` can flag a constant whose source value changed without network access.
 *
 *   items:     Items/<id> (4-digit IDs): data values by name, and calculation numbers as
 *              "calc:<Calculation>.<part>[.<part>…].<field>" (e.g. "calc:OnHitDamage.0.mNumber")
 *   perks:     rune ID → mEffectAmount values by name
 *   champions: champion ID → CharacterRecords/Root values the engine relies on
 */

export type ValueMap = Record<string, number>;

export interface GameValues {
  items: Record<string, ValueMap>;
  perks: Record<string, ValueMap>;
  champions: Record<string, ValueMap>;
}

/** Bin floats are float32 (0.0599999…); 7 significant digits is the stored precision. */
export const clean = (x: number) => Number(x.toPrecision(7));

interface BinDataValue {
  mName?: string;
  name?: string;
  mValue?: number;
  value?: number;
}

/** Numeric fields of calculation parts, keyed by their path; nested parts recurse. */
export function flattenCalculations(calcs: Record<string, unknown>): ValueMap {
  const out: ValueMap = {};
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((n, i) => walk(n, `${path}.${i}`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === '__type') continue;
      if (typeof v === 'number') out[`${path}.${k}`] = clean(v);
      // mFormulaParts and similar part lists don't add to the path; their indexes do.
      else walk(v, /parts$/i.test(k) ? path : `${path}.${k}`);
    }
  };
  for (const [name, calc] of Object.entries(calcs)) walk(calc, `calc:${name}`);
  return out;
}

export function itemValues(bin: Record<string, unknown>): Record<string, ValueMap> {
  const out: Record<string, ValueMap> = {};
  for (const [key, entry] of Object.entries(bin)) {
    const m = /^Items\/(\d{4})$/.exec(key);
    if (!m || !entry || typeof entry !== 'object') continue;
    const e = entry as { mDataValues?: BinDataValue[]; mItemCalculations?: Record<string, unknown> };
    const values: ValueMap = {};
    for (const dv of e.mDataValues ?? []) {
      const name = dv.mName ?? dv.name;
      const value = dv.mValue ?? dv.value;
      if (name && typeof value === 'number') values[name] = clean(value);
    }
    Object.assign(values, flattenCalculations(e.mItemCalculations ?? {}));
    if (Object.keys(values).length > 0) out[m[1]] = values;
  }
  return out;
}

export function perkValues(bin: Record<string, unknown>): Record<string, ValueMap> {
  const out: Record<string, ValueMap> = {};
  for (const entry of Object.values(bin)) {
    if (!entry || typeof entry !== 'object' || !('mPerkId' in entry)) continue;
    const e = entry as { mPerkId: number; mScript?: { mSpellScriptData?: { mEffectAmount?: Record<string, unknown> } } };
    const amounts = e.mScript?.mSpellScriptData?.mEffectAmount ?? {};
    const values: ValueMap = {};
    for (const [k, v] of Object.entries(amounts)) if (typeof v === 'number') values[k] = clean(v);
    if (Object.keys(values).length > 0) out[String(e.mPerkId)] = values;
  }
  return out;
}
