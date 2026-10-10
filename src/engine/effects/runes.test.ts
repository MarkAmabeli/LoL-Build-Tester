import { describe, expect, it } from 'vitest';
import {
  activate,
  adaptiveDamageType,
  autoAttack,
  byLevel,
  computeHit,
  gatheringStormForce,
  getEffect,
  lastStandAmp,
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

const rune = (id: string): Effect => {
  const e = getEffect(id);
  if (!e) throw new Error(`no effect ${id}`);
  return e;
};

// Level 1 target with 0 armor and 0 MR, so final damage equals raw damage.
const bare: TargetState = { stats: resolveStats(dummy, 1, { armor: -30, mr: -30 }) };
const ability: DamageInstance = { type: 'magic', raw: 100, source: 'Q', tags: ['ability'] };

/** Resolve an attacker with effects and run one hit against `target`. */
function hit(
  champ: ChampionBaseStats,
  level: number,
  bonuses: StatBonuses,
  effects: ActiveEffect[],
  instance: (attacker: ReturnType<typeof resolveStats>) => DamageInstance,
  target = bare,
) {
  const attacker = resolveStats(champ, level, bonuses, effects);
  return { attacker, ...computeHit(instance(attacker), { attacker, target, effects }) };
}
const auto = (a: ReturnType<typeof resolveStats>) => autoAttack(a, false);

describe('byLevel', () => {
  it('interpolates linearly from level 1 to 18', () => {
    expect(byLevel(70, 240, 1)).toBe(70);
    expect(byLevel(70, 240, 10)).toBe(160);
    expect(byLevel(70, 240, 18)).toBe(240);
  });
});

describe('adaptive damage type', () => {
  it('follows the higher bonus, then the tie-break', () => {
    expect(adaptiveDamageType(resolveStats(dummy, 1))).toBe('physical');
    expect(adaptiveDamageType(resolveStats({ ...dummy, adaptiveType: 'ap' }, 1))).toBe('magic');
    expect(adaptiveDamageType(resolveStats(dummy, 1, { ap: 10 }))).toBe('magic');
  });
});

describe('effect ordering', () => {
  it("runs Conqueror's adaptive force before Rabadon's multiplier, whatever the list order", () => {
    const effects = [activate(rune('3089')), activate(rune('8010'))];
    expect(resolveStats(dummy, 1, { ap: 100 }, effects).ap).toBeCloseTo((100 + 12 * 1.8) * 1.3);
  });
});

describe('Conqueror', () => {
  it('grants 1.8 adaptive force per stack at level 1, as AD by default', () => {
    const s = resolveStats(dummy, 1, {}, [activate(rune('8010'))]);
    expect(s.ad.bonus).toBeCloseTo(12 * 1.8 * 0.6);
  });

  it('grants 4 per stack at level 18, as AP when AP is higher', () => {
    expect(resolveStats(dummy, 18, { ap: 50 }, [activate(rune('8010'))]).ap).toBeCloseTo(50 + 48);
  });

  it('scales with the stack count', () => {
    expect(resolveStats(dummy, 1, {}, [activate(rune('8010'), { stacks: 0 })]).ad.bonus).toBe(0);
  });
});

describe('Electrocute', () => {
  const effects = [activate(rune('8112'))];

  it('deals 70 (+5% AP) magic damage at level 1 for an AP attacker', () => {
    const { hits } = hit(dummy, 1, { ap: 100 }, effects, auto);
    expect(hits[1]).toMatchObject({ type: 'magic', raw: 75, source: 'Electrocute' });
  });

  it('deals 240 (+10% bonus AD) physical damage at level 18', () => {
    const { hits } = hit(dummy, 18, { ad: 40 }, effects, () => ({ ...ability, type: 'physical' }));
    expect(hits[1]).toMatchObject({ type: 'physical' });
    expect(hits[1].raw).toBeCloseTo(244);
  });

  it('does nothing without the proc', () => {
    expect(hit(dummy, 1, {}, [activate(rune('8112'), { proc: false })], auto).hits).toHaveLength(1);
  });
});

describe('Dark Harvest', () => {
  const effects = [activate(rune('8128'), { souls: 5 })];

  it('only triggers below 50% health', () => {
    expect(hit(dummy, 1, {}, effects, auto).hits).toHaveLength(1);
    expect(hit(dummy, 1, {}, effects, auto, { ...bare, currentHp: 300 }).hits).toHaveLength(1);
    const { hits } = hit(dummy, 1, {}, effects, auto, { ...bare, currentHp: 299 });
    expect(hits[1]).toMatchObject({ type: 'physical', raw: 30 + 5 * 11, source: 'Dark Harvest' });
  });

  it('uses the champion tie-break for its damage type', () => {
    const { hits } = hit({ ...dummy, adaptiveType: 'ap' }, 1, {}, effects, auto, { ...bare, currentHp: 100 });
    expect(hits[1].type).toBe('magic');
  });
});

describe('Arcane Comet', () => {
  const effects = (distance = 0) => [activate(rune('8229'), { distance })];

  it('procs on abilities only', () => {
    expect(hit(dummy, 1, { ap: 100 }, effects(), auto).hits).toHaveLength(1);
    const { hits } = hit(dummy, 1, { ap: 100 }, effects(), () => ability);
    expect(hits[1]).toMatchObject({ type: 'magic', raw: 15 + 5, source: 'Arcane Comet' });
  });

  it('deals more damage with distance, up to double at 750', () => {
    expect(hit(dummy, 1, { ap: 100 }, effects(375), () => ability).hits[1].raw).toBeCloseTo(30);
    expect(hit(dummy, 1, { ap: 100 }, effects(750), () => ability).hits[1].raw).toBeCloseTo(40);
  });
});

describe('Lethal Tempo', () => {
  it('grants 6% attack speed per stack for melee and procs at 6 stacks', () => {
    const { attacker, hits } = hit(melee, 1, {}, [activate(rune('8008'))], auto);
    expect(attacker.bonusAttackSpeedPct).toBeCloseTo(36);
    expect(attacker.attackSpeed).toBeCloseTo(0.625 * 1.36);
    expect(hits[1]).toMatchObject({ type: 'physical', source: 'Lethal Tempo' });
    expect(hits[1].raw).toBeCloseTo(9 * 1.36);
  });

  it('uses the ranged values', () => {
    const { attacker, hits } = hit(dummy, 1, {}, [activate(rune('8008'))], auto);
    expect(attacker.bonusAttackSpeedPct).toBeCloseTo(24);
    expect(hits[1].raw).toBeCloseTo(6 * 1.24);
  });

  it('counts level-growth attack speed as bonus attack speed', () => {
    // Level 18: growth 2 × 17 = 34%, plus 36% from stacks.
    const { hits } = hit(melee, 18, {}, [activate(rune('8008'))], auto);
    expect(hits[1].raw).toBeCloseTo(30 * 1.7);
  });

  it('does not proc below max stacks', () => {
    const { attacker, hits } = hit(melee, 1, {}, [activate(rune('8008'), { stacks: 5 })], auto);
    expect(attacker.bonusAttackSpeedPct).toBeCloseTo(30);
    expect(hits).toHaveLength(1);
  });
});

describe('Press the Attack', () => {
  it('amplifies damage by 8% while the target is exposed', () => {
    expect(hit(dummy, 1, {}, [activate(rune('8005'))], auto).total).toBeCloseTo(60 * 1.08);
  });

  it('deals 40 adaptive damage on the proc, without amplifying that hit', () => {
    const { hits, total } = hit(dummy, 1, {}, [activate(rune('8005'), { proc: true })], auto);
    expect(hits[1]).toMatchObject({ type: 'physical', raw: 40, source: 'Press the Attack' });
    expect(total).toBeCloseTo(100);
  });

  it('deals 160 at level 18', () => {
    const { hits } = hit(dummy, 18, {}, [activate(rune('8005'), { proc: true })], auto);
    expect(hits[1].raw).toBeCloseTo(160);
  });
});

describe('First Strike', () => {
  it('amplifies every instance by 7%, including procs', () => {
    const effects = [activate(rune('8369')), activate(rune('8112'))];
    expect(hit(dummy, 1, { ap: 100 }, effects, () => ability).total).toBeCloseTo((100 + 75) * 1.07);
  });

  it('does nothing when inactive', () => {
    expect(hit(dummy, 1, {}, [activate(rune('8369'), { active: false })], auto).total).toBeCloseTo(60);
  });
});

describe('Coup de Grace', () => {
  const effects = [activate(rune('8014'))];

  it('amplifies damage by 8% below 40% target health', () => {
    expect(hit(dummy, 1, {}, effects, auto, { ...bare, currentHp: 239 }).total).toBeCloseTo(60 * 1.08);
    expect(hit(dummy, 1, {}, effects, auto, { ...bare, currentHp: 240 }).total).toBeCloseTo(60);
    expect(hit(dummy, 1, {}, effects, auto).total).toBeCloseTo(60);
  });
});

describe('Cut Down', () => {
  const effects = [activate(rune('8017'))];

  it('amplifies damage by 8% above 60% target health', () => {
    expect(hit(dummy, 1, {}, effects, auto).total).toBeCloseTo(60 * 1.08);
    expect(hit(dummy, 1, {}, effects, auto, { ...bare, currentHp: 361 }).total).toBeCloseTo(60 * 1.08);
    expect(hit(dummy, 1, {}, effects, auto, { ...bare, currentHp: 360 }).total).toBeCloseTo(60);
  });
});

describe('Last Stand', () => {
  it('rises from 5% below 60% health to 11% at 30%', () => {
    expect(lastStandAmp(1)).toBe(0);
    expect(lastStandAmp(0.6)).toBe(0);
    expect(lastStandAmp(0.59)).toBeCloseTo(0.05 + 0.06 * (0.01 / 0.3));
    expect(lastStandAmp(0.45)).toBeCloseTo(0.08);
    expect(lastStandAmp(0.3)).toBeCloseTo(0.11);
    expect(lastStandAmp(0.1)).toBeCloseTo(0.11);
  });

  it("uses the attacker's current health", () => {
    const effects = [activate(rune('8299'))];
    const hurt = resolveStats(dummy, 1, {}, effects, { currentHpPct: 0.45 });
    expect(computeHit(auto(hurt), { attacker: hurt, target: bare, effects }).total).toBeCloseTo(60 * 1.08);
    const healthy = resolveStats(dummy, 1, {}, effects);
    expect(computeHit(auto(healthy), { attacker: healthy, target: bare, effects }).total).toBeCloseTo(60);
  });
});

describe('Absolute Focus', () => {
  const effects = [activate(rune('8233'))];

  it('grants 3–30 adaptive force by level above 70% health', () => {
    expect(resolveStats(dummy, 1, {}, effects).ad.bonus).toBeCloseTo(1.8);
    expect(resolveStats(dummy, 18, { ap: 50 }, effects).ap).toBeCloseTo(80);
  });

  it('turns off at 70% health or lower', () => {
    expect(resolveStats(dummy, 1, {}, effects, { currentHpPct: 0.7 }).ad.bonus).toBe(0);
  });
});

describe('Gathering Storm', () => {
  it('grants 8 × (1 + 2 + … + n) adaptive force after n 10-minute steps', () => {
    expect([0, 9.9, 10, 20, 30, 60].map(gatheringStormForce)).toEqual([0, 0, 8, 24, 48, 168]);
  });

  it('matches the in-game table: 24 AP or ~14 AD at 20 minutes', () => {
    const effects = [activate(rune('8236'), { minutes: 20 })];
    expect(resolveStats(dummy, 1, { ap: 10 }, effects).ap).toBeCloseTo(34);
    expect(resolveStats(dummy, 1, {}, effects).ad.bonus).toBeCloseTo(14.4);
  });
});

describe('Cheap Shot and Sudden Impact', () => {
  it('add level-scaled true damage to attacks and abilities', () => {
    const cheap = [activate(rune('8126'))];
    expect(hit(dummy, 1, {}, cheap, auto).total).toBeCloseTo(60 + 10);
    expect(hit(dummy, 18, {}, cheap, () => ability).hits[1]).toMatchObject({ type: 'true', raw: 45 });
    const sudden = [activate(rune('8143'))];
    expect(hit(dummy, 18, {}, sudden, () => ability).total).toBeCloseTo(100 + 80);
  });

  it('do nothing when not proccing', () => {
    expect(hit(dummy, 1, {}, [activate(rune('8126'), { proc: false })], auto).total).toBeCloseTo(60);
  });
});

describe('Scorch', () => {
  it('adds 20–40 magic damage to abilities only', () => {
    const effects = [activate(rune('8237'))];
    expect(hit(dummy, 1, {}, effects, () => ability).total).toBeCloseTo(120);
    expect(hit(dummy, 18, {}, effects, () => ability).total).toBeCloseTo(140);
    expect(hit(dummy, 1, {}, effects, auto).total).toBeCloseTo(60);
  });
});

describe('Axiom Arcanist', () => {
  const effects = [activate(rune('8224'))];

  it('amplifies ultimates by 12%, or 8% for area damage', () => {
    const ult: DamageInstance = { ...ability, tags: ['ability', 'ultimate'] };
    expect(hit(dummy, 1, {}, effects, () => ult).total).toBeCloseTo(112);
    expect(hit(dummy, 1, {}, effects, () => ({ ...ult, tags: ['ability', 'ultimate', 'aoe'] })).total).toBeCloseTo(108);
  });

  it('leaves basic abilities alone', () => {
    expect(hit(dummy, 1, {}, effects, () => ability).total).toBeCloseTo(100);
  });
});

describe('Legend runes', () => {
  it('Alacrity grants 3% + 1.5% attack speed per stack', () => {
    expect(resolveStats(dummy, 1, {}, [activate(rune('9104'))]).attackSpeed).toBeCloseTo(0.625 * 1.18);
    expect(resolveStats(dummy, 1, {}, [activate(rune('9104'), { stacks: 0 })]).attackSpeed).toBeCloseTo(0.625 * 1.03);
  });

  it('Haste grants 1.5 ability haste per stack', () => {
    expect(resolveStats(dummy, 1, {}, [activate(rune('9105'))]).abilityHaste).toBeCloseTo(15);
    expect(resolveStats(dummy, 1, {}, [activate(rune('9105'), { stacks: 4 })]).abilityHaste).toBeCloseTo(6);
  });
});

describe('Transcendence', () => {
  it('grants 5 ability haste at level 5 and 5 more at level 8', () => {
    const effects = [activate(rune('8210'))];
    expect([4, 5, 7, 8, 18].map((l) => resolveStats(dummy, l, {}, effects).abilityHaste)).toEqual([0, 5, 5, 10, 10]);
  });
});

describe('Waterwalking', () => {
  it('grants 13–30 adaptive force and 10 move speed in the river', () => {
    const inRiver = resolveStats(dummy, 1, {}, [activate(rune('8232'))]);
    expect(inRiver.ad.bonus).toBeCloseTo(13 * 0.6);
    expect(inRiver.moveSpeed).toBe(340);
    expect(resolveStats(dummy, 18, { ap: 1 }, [activate(rune('8232'))]).ap).toBeCloseTo(31);
    expect(resolveStats(dummy, 1, {}, [activate(rune('8232'), { river: false })]).moveSpeed).toBe(330);
  });
});

describe('Jack of All Trades', () => {
  it('grants 1 ability haste per stack and 8 / 20 adaptive force at 5 / 10 stacks', () => {
    const at = (stacks: number) => resolveStats(dummy, 1, {}, [activate(rune('8316'), { stacks })]);
    expect(at(4)).toMatchObject({ abilityHaste: 4, ad: { bonus: 0 } });
    expect(at(5).abilityHaste).toBe(5);
    expect(at(5).ad.bonus).toBeCloseTo(8 * 0.6);
    expect(at(12).ad.bonus).toBeCloseTo(20 * 0.6);
  });
});

describe('Conditioning', () => {
  it('adds 8 armor and MR, then 3% more', () => {
    const stats = resolveStats(dummy, 1, { armor: 20 }, [activate(rune('8429'))]);
    expect(stats.armor.total).toBeCloseTo(58 * 1.03);
    expect(stats.mr.total).toBeCloseTo(38 * 1.03);
    expect(stats.armor.base).toBe(30);
  });

  it('reduces damage taken when on the target', () => {
    const target = { stats: resolveStats(dummy, 1, {}, [activate(rune('8429'))]) };
    expect(hit(dummy, 1, {}, [], auto, target).total).toBeCloseTo((60 * 100) / (100 + 38 * 1.03));
  });
});

describe('Overgrowth', () => {
  it('grants 3 health per 8 units, plus 3.5% max health at 120', () => {
    const hpAt = (units: number) => resolveStats(dummy, 1, {}, [activate(rune('8451'), { units })]).hp.total;
    expect(hpAt(7)).toBe(600);
    expect(hpAt(119)).toBe(642);
    expect(hpAt(120)).toBeCloseTo(645 * 1.035);
  });
});
