import { describe, expect, it } from 'vitest';
import {
  activate,
  autoAttack,
  computeHit,
  cooldownWithHaste,
  getEffect,
  hasteFor,
  resolveStats,
  type ActiveEffect,
  type ChampionBaseStats,
  type DamageInstance,
  type Effect,
  type StatBonuses,
  type TargetState,
} from '../index';

// Same synthetic champion as engine.test.ts. Ranged (550 range); `melee` is the 125-range copy.
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

// Level 1 target with 0 armor and 0 MR (600 health), so final damage equals raw damage.
const bare: TargetState = { stats: resolveStats(dummy, 1, { armor: -30, mr: -30 }) };
const ability: DamageInstance = { type: 'magic', raw: 100, source: 'Q', tags: ['ability'] };
const ult: DamageInstance = { ...ability, source: 'R', tags: ['ability', 'ultimate'] };
const auto = (a: ReturnType<typeof resolveStats>) => autoAttack(a, false);

function hit(
  champ: ChampionBaseStats,
  bonuses: StatBonuses,
  effects: ActiveEffect[],
  instance: (attacker: ReturnType<typeof resolveStats>) => DamageInstance,
  target = bare,
) {
  const attacker = resolveStats(champ, 1, bonuses, effects);
  return { attacker, ...computeHit(instance(attacker), { attacker, target, effects }) };
}
const procs = (r: ReturnType<typeof hit>) => r.hits.slice(1).map((h) => [h.source, h.type, h.raw]);

describe('on-hit items', () => {
  it("Wit's End adds 45 magic damage", () => {
    expect(procs(hit(dummy, {}, [activate(item('3091'))], auto))).toEqual([["Wit's End", 'magic', 45]]);
  });

  it('Terminus adds 30 + 10% bonus AD + 10% AP magic, and 10% armor and magic pen per Dark stack', () => {
    const r = hit(dummy, { ad: 20, ap: 50 }, [activate(item('3302'), { dark: 3 })], auto);
    expect(r.hits[1]).toMatchObject({ type: 'magic', raw: 30 + 2 + 5 });
    expect(r.attacker.armorPenPct).toBeCloseTo(0.3);
    const withLdr = resolveStats(dummy, 1, { armorPenPct: 0.3 }, [activate(item('3302'), { dark: 1 })]);
    expect(withLdr.armorPenPct).toBeCloseTo(1 - 0.7 * 0.9);
  });

  it("Blade of The Ruined King deals 9% (ranged 6%) of the target's current health", () => {
    const effects = [activate(item('3153'))];
    expect(hit(melee, {}, effects, auto, { ...bare, currentHp: 400 }).hits[1].raw).toBeCloseTo(36);
    expect(hit(dummy, {}, effects, auto).hits[1].raw).toBeCloseTo(36);
  });

  it("Guinsoo's Rageblade adds 30 magic and 8% attack speed per stack", () => {
    const r = hit(dummy, {}, [activate(item('3124'), { stacks: 4 })], auto);
    expect(r.hits[1]).toMatchObject({ type: 'magic', raw: 30 });
    expect(r.attacker.attackSpeed).toBeCloseTo(0.625 * 1.32);
  });

  it('Hullbreaker deals 120% base AD + 5% max health every fifth attack (ranged × 0.7)', () => {
    expect(hit(melee, { hp: 400 }, [activate(item('3181'), { proc: true })], auto).hits[1].raw).toBeCloseTo(72 + 50);
    expect(hit(dummy, { hp: 400 }, [activate(item('3181'), { proc: true })], auto).hits[1].raw).toBeCloseTo((72 + 50) * 0.7);
    expect(hit(melee, {}, [activate(item('3181'), { proc: false })], auto).hits).toHaveLength(1);
  });

  it('Titanic Hydra deals 1% max health (ranged 50%)', () => {
    expect(hit(melee, { hp: 400 }, [activate(item('3748'))], auto).hits[1].raw).toBeCloseTo(10);
    expect(hit(dummy, { hp: 400 }, [activate(item('3748'))], auto).hits[1].raw).toBeCloseTo(5);
  });

  it('Voltaic Cyclosword deals 9% (ranged 7%) current health, and grants lethality after', () => {
    expect(hit(melee, {}, [activate(item('6699'), { proc: true })], auto).hits[1].raw).toBeCloseTo(54);
    expect(hit(dummy, {}, [activate(item('6699'), { proc: true })], auto).hits[1].raw).toBeCloseTo(42);
    expect(resolveStats(melee, 1, {}, [activate(item('6699'), { lethality: true })]).lethality).toBe(15);
  });
});

describe('damage amps', () => {
  it("Lord Dominik's Regards scales to 15% at 1500 target bonus health", () => {
    const effects = [activate(item('3036'))];
    const tanky = (bonusHp: number): TargetState => ({ stats: resolveStats(dummy, 1, { hp: bonusHp, armor: -30, mr: -30 }) });
    expect(hit(dummy, {}, effects, auto).total).toBeCloseTo(60);
    expect(hit(dummy, {}, effects, auto, tanky(750)).total).toBeCloseTo(60 * 1.075);
    expect(hit(dummy, {}, effects, auto, tanky(3000)).total).toBeCloseTo(60 * 1.15);
  });

  it('Shadowflame amplifies magic and true damage by 20% below 40% health', () => {
    const effects = [activate(item('4645'))];
    const low = { ...bare, currentHp: 200 };
    expect(hit(dummy, {}, effects, () => ability, low).total).toBeCloseTo(120);
    expect(hit(dummy, {}, effects, auto, low).total).toBeCloseTo(60);
    expect(hit(dummy, {}, effects, () => ability).total).toBeCloseTo(100);
  });

  it("Liandry's burns for 6% max health over 3s and amplifies up to 6%", () => {
    const r = hit(dummy, {}, [activate(item('6653'), { seconds: 3 })], () => ability);
    expect(r.hits.map((h) => h.final)).toEqual([expect.closeTo(106), expect.closeTo(36 * 1.06)]);
    expect(hit(dummy, {}, [activate(item('6653'), { burn: false, seconds: 1 })], auto).total).toBeCloseTo(60 * 1.02);
  });

  it('Riftmaker converts 2% bonus health to AP and amplifies up to 8%', () => {
    const r = hit(dummy, { hp: 1000 }, [activate(item('4633'), { seconds: 4 })], () => ability);
    expect(r.attacker.ap).toBeCloseTo(20);
    expect(r.total).toBeCloseTo(108);
  });
});

describe('stats from stats', () => {
  it('Manamune grants 2% max mana as AD', () => {
    expect(resolveStats(dummy, 1, { mana: 500 }, [activate(item('3004'))]).ad.bonus).toBeCloseTo(16);
  });

  it('Muramana adds Shock: 1.2% max mana on attacks, 4% (ranged 3%) on abilities', () => {
    const effects = [activate(item('3042'))];
    expect(hit(dummy, { mana: 700 }, effects, auto).hits[1]).toMatchObject({ type: 'physical', raw: 12 });
    expect(hit(melee, { mana: 700 }, effects, () => ability).hits[1].raw).toBeCloseTo(40);
    expect(hit(dummy, { mana: 700 }, effects, () => ability).hits[1].raw).toBeCloseTo(30);
  });

  it("Archangel's and Seraph's grant 1% and 2% bonus mana as AP, before Rabadon's", () => {
    expect(resolveStats(dummy, 1, { mana: 1000 }, [activate(item('3003'))]).ap).toBeCloseTo(10);
    const seraph = [activate(item('3089')), activate(item('3040'))];
    expect(resolveStats(dummy, 1, { mana: 1000 }, seraph).ap).toBeCloseTo(20 * 1.3);
  });

  it('Blackfire Torch burns for 3 × (20 + 2% AP) and grants 4% AP per enemy burning', () => {
    const r = hit(dummy, { ap: 100 }, [activate(item('2503'), { burning: 2 })], () => ability);
    expect(r.attacker.ap).toBeCloseTo(108);
    expect(r.hits[1].raw).toBeCloseTo(3 * (20 + 0.02 * 108));
    expect(hit(dummy, {}, [activate(item('2503'))], auto).hits).toHaveLength(1);
  });

  it('Hubris grants 12 AD plus 3 per stack while active', () => {
    expect(resolveStats(dummy, 1, {}, [activate(item('6697'), { stacks: 4 })]).ad.bonus).toBe(24);
    expect(resolveStats(dummy, 1, {}, [activate(item('6697'), { active: false })]).ad.bonus).toBe(0);
  });

  it('Experimental Hexplate grants 50% (ranged 25%) attack speed during Overdrive', () => {
    expect(resolveStats(melee, 1, {}, [activate(item('3073'), { overdrive: true })]).attackSpeed).toBeCloseTo(0.625 * 1.5);
    expect(resolveStats(dummy, 1, {}, [activate(item('3073'), { overdrive: true })]).attackSpeed).toBeCloseTo(0.625 * 1.25);
  });
});

describe('ability procs', () => {
  it("Luden's Echo deals 2 × (75 + 5% AP) to a lone target", () => {
    expect(procs(hit(dummy, { ap: 100 }, [activate(item('6655'))], () => ability))).toEqual([["Luden's Echo", 'magic', 160]]);
    expect(hit(dummy, {}, [activate(item('6655'))], auto).hits).toHaveLength(1);
  });

  it('Malignance burns for (60 + 5% AP) per second on ultimate hits only, and shreds 10 MR', () => {
    const effects = [activate(item('3118'))];
    expect(procs(hit(dummy, { ap: 100 }, effects, () => ult))).toEqual([['Hatefog', 'magic', 195]]);
    expect(hit(dummy, {}, effects, () => ability).hits).toHaveLength(1);
    const target: TargetState = { stats: resolveStats(dummy, 1) };
    expect(hit(dummy, {}, effects, () => ability, target).hits[0].effectiveResist).toBe(20);
  });

  it('Stormsurge Squall deals 125 + 10% AP', () => {
    expect(procs(hit(dummy, { ap: 100 }, [activate(item('4646'), { proc: true })], () => ability))).toEqual([['Squall', 'magic', 135]]);
  });
});

describe('Spellblade items', () => {
  const proc = (id: string, bonuses: StatBonuses = {}, champ = dummy) =>
    hit(champ, bonuses, [activate(item(id), { proc: true })], auto).hits.slice(1).map((h) => [h.type, h.raw]);

  it('scale with base AD (and AP for the magic ones)', () => {
    expect(proc('3057')).toEqual([['physical', 60]]);
    expect(proc('3078', { ad: 40 })).toEqual([['physical', 120]]);
    expect(proc('6662')).toEqual([['physical', 90]]);
    expect(proc('3100', { ap: 100 })).toEqual([['magic', 45 + 45]]);
    expect(proc('2510', { ap: 100 })).toEqual([['magic', 45 + 10]]);
  });

  it('Essence Reaver adds 50 per 100% crit chance', () => {
    expect(proc('3508', { critChance: 0.5 })[0][1]).toBeCloseTo(75 + 25);
  });

  it('only proc on attacks, when ready', () => {
    expect(hit(dummy, {}, [activate(item('3078'), { proc: true })], () => ability).hits).toHaveLength(1);
    expect(hit(dummy, {}, [activate(item('3078'), { proc: false })], auto).hits).toHaveLength(1);
  });

  it('Bloodsong Maim amplifies all damage by 8% (ranged 5%)', () => {
    expect(hit(melee, {}, [activate(item('3877'), { maim: true })], () => ability).total).toBeCloseTo(108);
    expect(hit(dummy, {}, [activate(item('3877'), { proc: true, maim: true })], auto).total).toBeCloseTo(120 * 1.05);
  });
});

describe('Energized items', () => {
  it('Statikk Shiv and Rapid Firecannon both add to the same Energized attack', () => {
    const effects = [activate(item('3087'), { proc: true }), activate(item('3094'), { proc: true })];
    expect(procs(hit(dummy, {}, effects, auto))).toEqual([['Statikk Shiv', 'magic', 60], ['Rapid Firecannon', 'magic', 40]]);
    expect(hit(dummy, {}, [activate(item('3087'), { proc: false })], auto).hits).toHaveLength(1);
  });
});

describe('The Collector', () => {
  const effects = [activate(item('6676'))];

  it('executes a target left below 5% health', () => {
    // 600 max health: 29 left is below 30 (5%).
    expect(hit(dummy, {}, effects, auto, { ...bare, currentHp: 89 }).executedBy).toBe('The Collector');
  });

  it("doesn't execute above the threshold, or a target already killed", () => {
    expect(hit(dummy, {}, effects, auto, { ...bare, currentHp: 90 }).executedBy).toBeUndefined();
    expect(hit(dummy, {}, effects, auto, { ...bare, currentHp: 50 }).executedBy).toBeUndefined();
    expect(hit(dummy, {}, [], auto, { ...bare, currentHp: 89 }).executedBy).toBeUndefined();
  });
});

describe('Sundered Sky', () => {
  it('makes the attack a crit for 80% of crit damage (160%), whatever the crit chance', () => {
    const r = hit(dummy, { critChance: 0.5 }, [activate(item('6610'))], auto);
    expect(r.hits[0].tags).toEqual(['auto', 'crit']);
    expect(r.hits[0].raw).toBeCloseTo(60 * 1.6);
  });

  it("is affected by crit damage modifiers (Infinity Edge's +30%)", () => {
    const r = hit(dummy, { critDamageBonus: 0.3 }, [activate(item('6610'))], auto);
    expect(r.hits[0].raw).toBeCloseTo(60 * 0.8 * 2.3);
  });

  it('leaves abilities and spent procs alone', () => {
    expect(hit(dummy, {}, [activate(item('6610'))], () => ability).total).toBeCloseTo(100);
    expect(hit(dummy, {}, [activate(item('6610'), { proc: false })], auto).total).toBeCloseTo(60);
  });

  it('procs see the modified hit', () => {
    const effects = [activate(item('6610')), activate(item('3087'), { proc: true })];
    expect(hit(dummy, {}, effects, auto).total).toBeCloseTo(96 + 60);
  });
});

describe('ultimate haste', () => {
  it('Malignance and Experimental Hexplate add 20 and 30 ultimate haste on top of ability haste', () => {
    const stats = resolveStats(dummy, 1, { abilityHaste: 20 }, [activate(item('3118')), activate(item('3073'), { overdrive: false })]);
    expect(stats.ultimateHaste).toBe(50);
    expect(hasteFor(stats, 'basic')).toBe(20);
    expect(hasteFor(stats, 'ultimate')).toBe(70);
    expect(cooldownWithHaste(100, hasteFor(stats, 'ultimate'))).toBeCloseTo(100 / 1.7);
  });

  it('defaults to 0 and can come from flat bonuses', () => {
    expect(resolveStats(dummy, 1).ultimateHaste).toBe(0);
    expect(resolveStats(dummy, 1, { ultimateHaste: 15 }).ultimateHaste).toBe(15);
    expect(resolveStats(dummy, 1).basicHaste).toBe(0);
    expect(hasteFor(resolveStats(dummy, 1, { basicHaste: 25, ultimateHaste: 15 }), 'basic')).toBe(25);
  });
});
