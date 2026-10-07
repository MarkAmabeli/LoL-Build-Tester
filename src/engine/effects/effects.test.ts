import { describe, expect, it } from 'vitest';
import {
  activate,
  activateIds,
  autoAttack,
  combineReductions,
  computeHit,
  getEffect,
  krakenBaseDamage,
  resolveStats,
  type ChampionBaseStats,
  type Effect,
} from '../index';

// Same synthetic champion as engine.test.ts. Ranged (550 range).
const dummy: ChampionBaseStats = {
  hp: 600, hpperlevel: 100,
  mp: 300, mpperlevel: 50,
  armor: 30, armorperlevel: 4,
  spellblock: 30, spellblockperlevel: 2,
  attackdamage: 60, attackdamageperlevel: 3,
  attackspeed: 0.625, attackspeedperlevel: 2,
  movespeed: 330, attackrange: 550,
};
const melee: ChampionBaseStats = { ...dummy, attackrange: 125 };

const item = (id: string): Effect => {
  const e = getEffect(id);
  if (!e) throw new Error(`no effect ${id}`);
  return e;
};
const rabadons = item('3089');
const cleaver = item('3071');
const nashors = item('3115');
const kraken = item('6672');

const ability = { type: 'magic' as const, raw: 100, source: 'Q', tags: ['ability' as const] };

describe('registry', () => {
  it('fills state defaults and applies overrides', () => {
    expect(activate(cleaver).state).toEqual({ stacks: 5 });
    expect(activate(cleaver, { stacks: 2 }).state).toEqual({ stacks: 2 });
  });

  it('skips IDs with no implemented effect', () => {
    const active = activateIds(['3089', '1001', '3071'], { '3071': { stacks: 1 } });
    expect(active.map((a) => a.effect.name)).toEqual(["Rabadon's Deathcap", 'Black Cleaver']);
    expect(active[1].state.stacks).toBe(1);
  });
});

describe('combineReductions', () => {
  it('adds flat and stacks percent multiplicatively', () => {
    const r = combineReductions({ flat: 5, pct: 0.3 }, undefined, { flat: 5, pct: 0.5 });
    expect(r.flat).toBe(10);
    expect(r.pct).toBeCloseTo(0.65);
  });
});

describe("Rabadon's Deathcap", () => {
  it('multiplies total AP after flat sources are summed', () => {
    expect(resolveStats(dummy, 1, { ap: 100 }, [activate(rabadons)]).ap).toBeCloseTo(130);
  });

  it('feeds amplified AP into other effects', () => {
    const effects = [activate(rabadons), activate(nashors)];
    const attacker = resolveStats(dummy, 1, { ap: 100 }, effects);
    const target = resolveStats(dummy, 1, { mr: -30 }); // 0 MR
    const { hits } = computeHit(autoAttack(attacker, false), { attacker, target: { stats: target }, effects });
    expect(hits[1].final).toBeCloseTo(15 + 0.15 * 130);
  });
});

describe('Black Cleaver', () => {
  const attacker = resolveStats(dummy, 1);
  const target = { stats: resolveStats(dummy, 1, { armor: 70 }) }; // 100 armor

  it('shreds 6% armor per stack', () => {
    const effects = [activate(cleaver)]; // 5 stacks: 100 -> 70 armor
    const { total, hits } = computeHit(autoAttack(attacker, false), { attacker, target, effects });
    expect(hits[0].effectiveResist).toBeCloseTo(70);
    expect(total).toBeCloseTo(60 * 100 / 170);
  });

  it('does nothing at 0 stacks', () => {
    const effects = [activate(cleaver, { stacks: 0 })];
    expect(computeHit(autoAttack(attacker, false), { attacker, target, effects }).total).toBeCloseTo(30);
  });

  it('applies before lethality', () => {
    const lethal = resolveStats(dummy, 1, { lethality: 10 });
    const effects = [activate(cleaver)];
    const { hits } = computeHit(autoAttack(lethal, false), { attacker: lethal, target, effects });
    expect(hits[0].effectiveResist).toBeCloseTo(60); // 100 × 0.7 − 10
  });

  it('does not reduce magic resist', () => {
    const effects = [activate(cleaver)];
    const mrTarget = { stats: resolveStats(dummy, 1, { mr: 70 }) };
    expect(computeHit(ability, { attacker, target: mrTarget, effects }).total).toBeCloseTo(50);
  });
});

describe("Nashor's Tooth", () => {
  const effects = [activate(nashors)];
  const attacker = resolveStats(dummy, 1, { ap: 100 }, effects);
  const target = { stats: resolveStats(dummy, 1, { mr: 70 }) }; // 30 armor, 100 MR

  it('adds magic on-hit damage to auto attacks', () => {
    const { hits, total } = computeHit(autoAttack(attacker, false), { attacker, target, effects });
    expect(hits).toHaveLength(2);
    expect(hits[1]).toMatchObject({ type: 'magic', raw: 30, source: "Nashor's Tooth" });
    expect(hits[1].final).toBeCloseTo(15);
    expect(total).toBeCloseTo(60 / 1.3 + 15);
  });

  it('does not proc on abilities', () => {
    expect(computeHit(ability, { attacker, target, effects }).hits).toHaveLength(1);
  });
});

describe('Kraken Slayer', () => {
  const target = { stats: resolveStats(dummy, 1, { armor: -30 }) }; // 0 armor

  it('scales base damage from level 9', () => {
    expect(krakenBaseDamage(1)).toBe(150);
    expect(krakenBaseDamage(8)).toBe(150);
    expect(krakenBaseDamage(9)).toBe(155);
    expect(krakenBaseDamage(18)).toBe(200);
  });

  it('deals 80% damage when ranged', () => {
    const effects = [activate(kraken)];
    const ranged = resolveStats(dummy, 1);
    const meleeStats = resolveStats(melee, 1);
    expect(computeHit(autoAttack(ranged, false), { attacker: ranged, target, effects }).hits[1].final).toBeCloseTo(120);
    expect(computeHit(autoAttack(meleeStats, false), { attacker: meleeStats, target, effects }).hits[1].final).toBeCloseTo(150);
  });

  it('increases with target missing health, up to ×1.75', () => {
    const effects = [activate(kraken)];
    const attacker = resolveStats(melee, 1);
    const half = computeHit(autoAttack(attacker, false), { attacker, target: { ...target, currentHp: 300 }, effects });
    expect(half.hits[1].raw).toBeCloseTo(150 * 1.375);
    const empty = computeHit(autoAttack(attacker, false), { attacker, target: { ...target, currentHp: 0 }, effects });
    expect(empty.hits[1].raw).toBeCloseTo(150 * 1.75);
  });

  it('only procs on the third attack', () => {
    const effects = [activate(kraken, { proc: false })];
    const attacker = resolveStats(melee, 1);
    expect(computeHit(autoAttack(attacker, false), { attacker, target, effects }).hits).toHaveLength(1);
  });
});
