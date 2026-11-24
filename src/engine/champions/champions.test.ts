import { describe, expect, it } from 'vitest';
import {
  abilityCooldown,
  abilityCostAndRange,
  abilityHit,
  activate,
  autoAttack,
  championEffects,
  computeHit,
  getChampion,
  getEffect,
  resolveStats,
  type AbilityInput,
  type ActiveEffect,
  type ChampionBaseStats,
  type ChampionSpells,
  type Ranks,
  type StatBonuses,
  type TargetState,
} from '../index';

// Same synthetic champion as engine.test.ts (60 AD, 600 health at level 1). Ranged; `melee` is 125 range.
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

// Level 1 target with 0 armor and 0 MR (600 health), so final damage equals raw damage.
const bare: TargetState = { stats: resolveStats(dummy, 1, { armor: -30, mr: -30 }) };
const big = (hp: number): TargetState => ({ stats: resolveStats(dummy, 1, { hp: hp - 600, armor: -30, mr: -30 }) });

// The committed spell data for the latest patch (no Node APIs in src, so via Vite).
const manifest = import.meta.glob<{ latest: string }>('/public/data/manifest.json', { eager: true, import: 'default' });
const spellFiles = import.meta.glob<ChampionSpells>('/public/data/*/spells/{Darius,Nasus,Vayne,Veigar,Yunara}.json', {
  eager: true,
  import: 'default',
});
const { latest } = Object.values(manifest)[0];
const spellsOf = (id: string) => {
  const spells = spellFiles[`/public/data/${latest}/spells/${id}.json`];
  if (!spells) throw new Error(`no spell data for ${id} in ${latest}`);
  return spells;
};

/** A champion set up for tests: run abilities and get its effects with state overrides. */
function setup(id: string) {
  const def = getChampion(id);
  if (!def) throw new Error(`no champion ${id}`);
  const spells = spellsOf(id);
  const effects = (ranks: Ranks, state: Record<string, Record<string, number | boolean>> = {}): ActiveEffect[] =>
    championEffects(def, spells, ranks).map((a) => ({ ...a, state: { ...a.state, ...state[a.effect.id] } }));
  const cast = (
    abilityId: string,
    rank: number,
    opts: { champ?: ChampionBaseStats; level?: number; bonuses?: StatBonuses; effects?: ActiveEffect[]; target?: TargetState } & Partial<AbilityInput> = {},
  ) => {
    const attacker = resolveStats(opts.champ ?? dummy, opts.level ?? 1, opts.bonuses ?? {}, opts.effects ?? []);
    return abilityHit(def, spells, abilityId, {
      rank,
      attacker,
      target: opts.target ?? bare,
      effects: opts.effects,
      state: opts.state,
      crit: opts.crit ?? false,
    });
  };
  return { def, spells, effects, cast };
}

const parts = (r: { hits: Array<{ source: string; final: number }> }) => r.hits.map((h) => [h.source, Number(h.final.toFixed(3))]);

describe('Vayne', () => {
  const { cast, effects } = setup('Vayne');

  it('Tumble: the attack (basic and spell damage) plus 75% AD (+50% AP) bonus at rank 1', () => {
    const r = cast('Q', 1, { bonuses: { ap: 100 } });
    expect(parts(r)).toEqual([['Tumble attack', 60], ['Tumble', 45 + 50]]);
    expect(r.hits[0].tags).toEqual(['auto', 'ability']);
  });

  it('Silver Bolts: the third hit deals % max health true damage, with a minimum', () => {
    const w1 = effects({ W: 1 }, { 'Vayne:W': { proc: true } });
    expect(parts(computeHit(autoAttack(resolveStats(dummy, 1), false), { attacker: resolveStats(dummy, 1), target: bare, effects: w1 })))
      .toEqual([['Auto attack', 60], ['Silver Bolts', 40]]);
    const w5 = effects({ W: 5 }, { 'Vayne:W': { proc: true } });
    const attacker = resolveStats(dummy, 1);
    expect(computeHit(autoAttack(attacker, false), { attacker, target: big(3000), effects: w5 }).hits[1].raw).toBeCloseTo(300);
  });

  it("Tumble's attack applies on-hit effects like Silver Bolts", () => {
    expect(cast('Q', 1, { effects: effects({ W: 1 }, { 'Vayne:W': { proc: true } }) }).total).toBeCloseTo(60 + 45 + 40);
  });

  it('Condemn: 50 (+50% bonus AD), plus 150% more into a wall', () => {
    expect(cast('E', 1, { bonuses: { ad: 20 } }).total).toBeCloseTo(60);
    expect(cast('E', 1, { bonuses: { ad: 20 }, state: { wall: true } }).total).toBeCloseTo(60 + 90);
  });

  it('Final Hour: 35/50/65 bonus AD while active', () => {
    expect(resolveStats(dummy, 1, {}, effects({ R: 1 }, { 'Vayne:R': { active: true } })).ad.bonus).toBe(35);
    expect(resolveStats(dummy, 1, {}, effects({ R: 3 }, { 'Vayne:R': { active: true } })).ad.bonus).toBe(65);
    expect(resolveStats(dummy, 1, {}, effects({ R: 3 })).ad.bonus).toBe(0);
  });
});

describe('Darius', () => {
  const { cast, effects } = setup('Darius');

  it('Hemorrhage: 13–30 (+30% bonus AD) per stack over 5s', () => {
    expect(cast('P', 1).total).toBeCloseTo(13);
    expect(cast('P', 1, { state: { stacks: 5 } }).total).toBeCloseTo(5 * 13);
    expect(cast('P', 1, { level: 18, bonuses: { ad: 100 }, state: { stacks: 2 } }).total).toBeCloseTo(2 * (30 + 30));
  });

  it('Decimate: 50 (+100% AD) with the blade, 35% of that with the handle', () => {
    expect(cast('Q', 1).total).toBeCloseTo(110);
    expect(cast('Q', 1, { state: { handle: true } }).total).toBeCloseTo(38.5);
  });

  it('Crippling Strike: an attack for 140% AD that can crit', () => {
    const r = cast('W', 1, { champ: melee });
    expect(r.total).toBeCloseTo(84);
    expect(r.hits[0].tags).toEqual(['auto', 'ability']);
    expect(cast('W', 1, { champ: melee, crit: true }).total).toBeCloseTo(84 * 2);
  });

  it('Noxian Guillotine: true damage, +20% per Hemorrhage stack, tagged ultimate', () => {
    const armored: TargetState = { stats: resolveStats(dummy, 18) };
    const r = cast('R', 1, { bonuses: { ad: 40 }, target: armored, state: { stacks: 5 } });
    expect(r.total).toBeCloseTo((125 + 30) * 2);
    expect(r.hits[0].tags).toContain('ultimate');
    expect(cast('R', 1, { state: { stacks: 0 } }).total).toBeCloseTo(125);
  });

  it('Axiom Arcanist amplifies Noxian Guillotine', () => {
    const axiom = [activate(getEffect('8224')!)];
    expect(cast('R', 1, { effects: axiom, state: { stacks: 0 } }).total).toBeCloseTo(125 * 1.12);
  });

  it('Noxian Might: 30 bonus AD at level 1, 230 at 18', () => {
    const on = { 'Darius:P': { active: true } };
    expect(resolveStats(dummy, 1, {}, effects({}, on)).ad.bonus).toBe(30);
    expect(resolveStats(dummy, 18, {}, effects({}, on)).ad.bonus).toBe(230);
  });

  it('Apprehend passive: 20–40% armor penetration', () => {
    expect(resolveStats(dummy, 1, {}, effects({ E: 1 })).armorPenPct).toBeCloseTo(0.2);
    expect(resolveStats(dummy, 1, { armorPenPct: 0.3 }, effects({ E: 5 })).armorPenPct).toBeCloseTo(1 - 0.7 * 0.6);
  });
});

describe('Veigar', () => {
  const { cast, effects } = setup('Veigar');

  it('Baleful Strike and Dark Matter at rank 1', () => {
    expect(cast('Q', 1, { bonuses: { ap: 100 } }).total).toBeCloseTo(80 + 50);
    expect(cast('W', 1, { bonuses: { ap: 100 } }).total).toBeCloseTo(85 + 70);
  });

  it("Primordial Burst: +1.5% per 1% missing health, doubling at two-thirds missing", () => {
    const at = (hp: number) => cast('R', 1, { bonuses: { ap: 100 }, target: { ...bare, currentHp: hp } }).total;
    expect(at(600)).toBeCloseTo(240);
    expect(at(300)).toBeCloseTo(240 * 1.75);
    expect(at(200)).toBeCloseTo(480);
    expect(at(50)).toBeCloseTo(480);
  });

  it('Phenomenal Evil: 1 AP per stack', () => {
    expect(resolveStats(dummy, 1, { ap: 10 }, effects({}, { 'Veigar:P': { stacks: 250 } })).ap).toBe(260);
  });
});

describe('Nasus', () => {
  const { cast, effects } = setup('Nasus');

  it('Siphoning Strike: the attack plus 30 and 1 per stack, all of it can crit', () => {
    expect(cast('Q', 1, { champ: melee, state: { stacks: 100 } }).total).toBeCloseTo(60 + 30 + 100);
    expect(cast('Q', 1, { champ: melee, crit: true }).total).toBeCloseTo((60 + 30) * 2);
  });

  it('Spirit Fire: the impact, plus the burn for the seconds spent in it', () => {
    expect(cast('E', 1, { bonuses: { ap: 100 } }).total).toBeCloseTo(50 + 60);
    expect(parts(cast('E', 1, { state: { seconds: 5 } }))).toEqual([['Spirit Fire', 50], ['Spirit Fire (burn)', 50]]);
  });

  it('Spirit Fire reduces armor by 30–50% for targets in it', () => {
    const armored: TargetState = { stats: resolveStats(dummy, 1, { armor: 70 }) };
    const shred = effects({ E: 1 }, { 'Nasus:E': { active: true } });
    const attacker = resolveStats(melee, 1);
    expect(computeHit(autoAttack(attacker, false), { attacker, target: armored, effects: shred }).hits[0].effectiveResist).toBeCloseTo(70);
  });

  it('Fury of the Sands: 3% max health per second as magic damage, capped at 240', () => {
    expect(cast('R', 1).total).toBeCloseTo(18);
    expect(cast('R', 1, { target: big(10000), state: { seconds: 2 } }).total).toBeCloseTo(480);
    expect(cast('R', 1).hits[0].tags).toContain('ultimate');
  });

  it('Fury of the Sands: bonus health and resistances while active', () => {
    const stats = resolveStats(dummy, 1, {}, effects({ R: 1 }, { 'Nasus:R': { active: true } }));
    expect([stats.hp.bonus, stats.armor.bonus, stats.mr.bonus]).toEqual([300, 40, 40]);
  });
});

describe('Yunara', () => {
  const { cast, effects } = setup('Yunara');
  const autoWith = (fx: ActiveEffect[], bonuses: StatBonuses = {}, crit: boolean | 'expected' = false) => {
    const attacker = resolveStats(dummy, 1, bonuses, fx);
    return { attacker, ...computeHit(autoAttack(attacker, crit), { attacker, target: bare, effects: fx }) };
  };

  it('Cultivation of Spirit: on-hit magic damage, doubled up and with attack speed while active', () => {
    expect(parts(autoWith(effects({ Q: 1 }), { ap: 50 }))).toEqual([['Auto attack', 60], ['Cultivation of Spirit', 13]]);
    const active = autoWith(effects({ Q: 1 }, { 'Yunara:Q': { active: true } }));
    expect(active.total).toBeCloseTo(60 + 3 + 3);
    expect(active.attacker.attackSpeed).toBeCloseTo(0.625 * 1.2);
  });

  it('Vow of the First Lands: crits deal 10% (+10% per 100 AP) as bonus magic damage', () => {
    expect(autoWith(effects({}), {}, true).hits[1].raw).toBeCloseTo(120 * 0.1);
    expect(autoWith(effects({}), { critChance: 0.5, ap: 100 }, 'expected').hits[1].raw).toBeCloseTo(0.5 * 120 * 0.2);
    expect(autoWith(effects({}), {}, false).hits).toHaveLength(1);
  });

  it('Arc of Judgment: the impact, plus 60% of it per second lingering', () => {
    expect(cast('W', 1, { bonuses: { ad: 20, ap: 100 } }).total).toBeCloseTo(55 + 17 + 50);
    expect(cast('W', 1, { state: { seconds: 1 } }).total).toBeCloseTo(55 + 33);
  });

  it('Arc of Ruin: uses the R rank and counts as ultimate damage', () => {
    const r = cast('RW', 1, { bonuses: { ad: 10, ap: 100 } });
    expect(r.total).toBeCloseTo(160 + 12 + 75);
    expect(r.hits[0].tags).toContain('ultimate');
  });
});

describe('ability cooldown, cost and range', () => {
  const ability = (champ: string, id: string) => getChampion(champ)!.abilities.find((a) => a.id === id)!;

  it('reads per-rank cooldowns and applies the right haste', () => {
    const condemn = ability('Vayne', 'E');
    expect(abilityCooldown(spellsOf('Vayne'), condemn, 1, resolveStats(dummy, 1))).toBe(20);
    expect(abilityCooldown(spellsOf('Vayne'), condemn, 5, resolveStats(dummy, 1))).toBe(12);
    const hasted = resolveStats(dummy, 1, { abilityHaste: 20, basicHaste: 10, ultimateHaste: 30 });
    expect(abilityCooldown(spellsOf('Vayne'), condemn, 1, hasted)).toBeCloseTo((20 * 100) / 130);
    expect(abilityCooldown(spellsOf('Veigar'), ability('Veigar', 'R'), 1, hasted)).toBeCloseTo((120 * 100) / 150);
  });

  it('is unknown when the data has no usable cooldown', () => {
    // Arc of Ruin uses W's spell record, which has no cooldown in the data.
    expect(abilityCooldown(spellsOf('Yunara'), ability('Yunara', 'RW'), 1, resolveStats(dummy, 1))).toBeUndefined();
  });

  it('reads cost (no placeholder entry) and range, dropping placeholder ranges', () => {
    expect(abilityCostAndRange(spellsOf('Veigar'), ability('Veigar', 'Q'), 5)).toEqual({ cost: 50, range: undefined });
    expect(abilityCostAndRange(spellsOf('Vayne'), ability('Vayne', 'E'), 1)).toEqual({ cost: 90, range: 550 });
    expect(abilityCostAndRange(spellsOf('Vayne'), ability('Vayne', 'Q'), 1)).toEqual({ cost: 30, range: undefined });
  });
});
