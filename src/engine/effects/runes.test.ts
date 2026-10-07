import { describe, expect, it } from 'vitest';
import {
  activate,
  adaptiveDamageType,
  autoAttack,
  byLevel,
  computeHit,
  getEffect,
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
