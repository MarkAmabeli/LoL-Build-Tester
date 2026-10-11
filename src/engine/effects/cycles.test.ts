import { describe, expect, it } from 'vitest';
import { CHAMPIONS } from '../champions/registry';
import type { ChampionSpells, Ranks } from '../champions/types';
import { combatStartValue, cycleStep, type CombatEvent, type CycleContext, type Cycled, type CycleTracker } from './cycles';
import { EFFECTS, getEffect } from './registry';
import type { EffectState } from './types';

const melee: CycleContext = { level: 1, ranged: false };
const ranged: CycleContext = { level: 1, ranged: true };

const attack = (time: number, extra: Partial<CombatEvent> = {}): CombatEvent => ({ time, type: 'hit', attack: true, physical: true, ...extra });
const ability = (time: number, extra: Partial<CombatEvent> = {}): CombatEvent => ({ time, type: 'hit', ability: true, ...extra });
const cast = (time: number, extra: Partial<CombatEvent> = {}): CombatEvent => ({ time, type: 'cast', ...extra });

/** The cycle-driven state for each event, in order. */
function run(owner: Cycled, events: CombatEvent[], ctx: CycleContext = melee): EffectState[] {
  let tracker: CycleTracker = {};
  return events.map((e) => {
    const r = cycleStep(owner, tracker, e, ctx);
    tracker = r.tracker;
    return r.state;
  });
}
const field = (states: EffectState[], key: string) => states.map((s) => s[key]);
const effect = (id: string) => {
  const e = getEffect(id);
  if (!e) throw new Error(`no effect ${id}`);
  return e;
};

describe('proc cycles', () => {
  it('Electrocute procs on the third hit within 3s of the first, then waits out its 20s cooldown', () => {
    const states = run(effect('8112'), [attack(0), ability(1), attack(2), attack(3), attack(4), attack(5)]);
    expect(field(states, 'proc')).toEqual([false, false, true, false, false, false]);
    // After the cooldown it needs three new hits.
    expect(field(run(effect('8112'), [attack(0), attack(1), attack(2), attack(22), attack(23), attack(24)]), 'proc'))
      .toEqual([false, false, true, false, false, true]);
  });

  it("Electrocute's window doesn't refresh: the third hit must land within 3s of the first", () => {
    expect(field(run(effect('8112'), [attack(0), attack(2), attack(3.5), attack(4), attack(5)]), 'proc'))
      .toEqual([false, false, false, false, true]);
  });

  it('Silver Bolts procs on every third attack, restarting if 3.5s pass between attacks', () => {
    const w = CHAMPIONS.Vayne.effects!({} as ChampionSpells, { W: 1 })[0];
    expect(field(run(w, [attack(0), attack(1), attack(2), attack(3), attack(4), attack(5)]), 'proc'))
      .toEqual([false, false, true, false, false, true]);
    expect(field(run(w, [attack(0), attack(1), attack(5), attack(6), attack(7)]), 'proc'))
      .toEqual([false, false, false, false, true]);
  });

  it('Spellblade: a cast arms it, the next attack procs, then 1.5s of cooldown', () => {
    const sheen = effect('3057');
    expect(field(run(sheen, [attack(0), cast(1), attack(1.5), cast(2), attack(2.5), cast(3.5), attack(4)]), 'proc'))
      .toEqual([false, false, true, false, false, false, true]);
    // A charge waits 10s for the attack.
    expect(field(run(sheen, [cast(0), attack(11)]), 'proc')).toEqual([false, false]);
  });

  it('Sundered Sky procs on the first attack of the fight, then every 10s', () => {
    expect(field(run(effect('6610'), [attack(0), attack(1), attack(9), attack(10)]), 'proc')).toEqual([true, false, false, true]);
  });

  it('Arcane Comet ignores attacks and recharges faster at higher level', () => {
    const comet = effect('8229');
    expect(field(run(comet, [attack(0), ability(1), ability(9), ability(21)]), 'proc')).toEqual([false, true, false, true]);
    expect(field(run(comet, [ability(0), ability(8)], { level: 18, ranged: false }), 'proc')).toEqual([true, true]);
  });

  it('procs with an outside condition only count events that carry it', () => {
    const cheapShot = effect('8126');
    const impaired = { conditions: ['targetImpaired' as const] };
    expect(field(run(cheapShot, [attack(0), attack(1, impaired), attack(2, impaired), attack(5, impaired)]), 'proc'))
      .toEqual([false, true, false, true]);
  });

  it('Energized items start charged (a deliberate exception), then need the simulator to report a full charge', () => {
    const energized = { conditions: ['energized' as const] };
    for (const id of ['3087', '3094', '6699']) {
      expect(field(run(effect(id), [attack(0), attack(1), attack(2), attack(3, energized), attack(4)]), 'proc'), id)
        .toEqual([true, false, false, true, false]);
    }
  });

  it("Voltaic Cyclosword's lethality follows the first Energized attack", () => {
    expect(field(run(effect('6699'), [attack(0), attack(1), attack(4), attack(4.5)]), 'lethality')).toEqual([false, true, true, false]);
  });

  it('First Strike lasts 3s, including the hit that triggers it', () => {
    expect(field(run(effect('8369'), [attack(0), ability(2), attack(3), attack(3.5)]), 'active')).toEqual([true, true, true, false]);
  });

  it('Experimental Hexplate: Overdrive starts on the ultimate cast, lasts 8s, 30s cooldown', () => {
    const hexplate = effect('3073');
    const events = [attack(0), cast(1, { ultimate: true }), attack(2), attack(9.5), cast(20, { ultimate: true }), attack(21)];
    expect(field(run(hexplate, events), 'overdrive')).toEqual([false, true, true, false, false, false]);
  });

  it("Noxian Might starts after Darius's fifth Hemorrhage stack", () => {
    const might = CHAMPIONS.Darius.effects!({} as ChampionSpells, {})[0];
    expect(field(run(might, [attack(0), ability(1), attack(2), attack(3), attack(4), attack(5), attack(10.5)]), 'active'))
      .toEqual([false, false, false, false, false, true, false]);
  });
});

describe('buff cycles', () => {
  it("Press the Attack exposes the target after the proc hit, refreshed by hits until 5s without one", () => {
    const pta = effect('8005');
    const states = run(pta, [attack(0), attack(1), attack(2), attack(3), ability(7.5), attack(13)]);
    expect(field(states, 'proc')).toEqual([false, false, true, false, false, false]);
    expect(field(states, 'exposed')).toEqual([false, false, false, true, true, false]);
  });

  it("Bloodsong's Maim follows its Spellblade proc", () => {
    const states = run(effect('3877'), [cast(0), attack(0.5), attack(1), attack(5)]);
    expect(field(states, 'proc')).toEqual([false, true, false, false]);
    expect(field(states, 'maim')).toEqual([false, false, true, false]);
  });
});

describe('stack cycles', () => {
  it('Conqueror: 2 stacks per hit, 1 per ranged attack, gained after the hit, gone after 5s', () => {
    const conq = effect('8010');
    expect(field(run(conq, [attack(0), attack(1), ability(2), attack(3)]), 'stacks')).toEqual([0, 2, 4, 6]);
    expect(field(run(conq, [attack(0), attack(1), ability(2), attack(3)], ranged), 'stacks')).toEqual([0, 1, 2, 4]);
    expect(field(run(conq, [attack(0), attack(1), attack(7)]), 'stacks')).toEqual([0, 2, 0]);
    expect(field(run(conq, Array.from({ length: 8 }, (_, i) => attack(i))), 'stacks').at(-1)).toBe(12);
  });

  it('Black Cleaver only counts physical hits', () => {
    expect(field(run(effect('3071'), [attack(0), ability(1), ability(2, { physical: true }), attack(3)]), 'stacks'))
      .toEqual([0, 1, 1, 2]);
  });

  it('Terminus gains a Dark stack every second attack', () => {
    expect(field(run(effect('3302'), [attack(0), attack(1), attack(2), attack(3), attack(4)]), 'dark')).toEqual([0, 0, 1, 1, 2]);
  });

  it("Liandry's counts whole seconds since the first hit, up to 3, resetting after 3s without one", () => {
    const states = run(effect('6653'), [ability(0), attack(1.5), attack(2.2), attack(5), attack(9), attack(10)]);
    expect(field(states, 'seconds')).toEqual([0, 1, 2, 3, 0, 1]);
  });
});

// Every effect and champion ability, with all ranks learned.
const ALL_RANKS: Ranks = { P: 1, Q: 5, W: 5, E: 5, R: 3 };
const owners: Array<[string, Cycled]> = [
  ...[...EFFECTS.values()].map((e): [string, Cycled] => [e.name, e]),
  ...Object.values(CHAMPIONS).flatMap((def) => [
    ...(def.effects?.({} as ChampionSpells, ALL_RANKS) ?? []).map((e): [string, Cycled] => [e.id, e]),
    ...def.abilities.map((a): [string, Cycled] => [`${def.id} ${a.id}`, a]),
  ]),
];

describe('state fields and cycles agree', () => {
  it.each(owners)('%s', (_, owner) => {
    const fields = owner.state ?? [];
    const cycles = owner.cycles ?? [];
    for (const f of fields) {
      const driving = cycles.filter((c) => c.field === f.key);
      if (f.scope !== 'combat') {
        expect(driving, `${f.key} is ${f.scope} but a cycle drives it`).toEqual([]);
        continue;
      }
      expect(driving, `combat field ${f.key} needs exactly one cycle`).toHaveLength(1);
      const [c] = driving;
      expect(f.kind, `${f.key}: ${c.kind} cycles drive ${c.kind === 'stacks' ? 'number' : 'toggle'} fields`)
        .toBe(c.kind === 'stacks' ? 'number' : 'toggle');
      expect(f.default, `${f.key} must default to its start-of-combat value`).toBe(combatStartValue(c));
    }
    for (const c of cycles) {
      expect(fields.some((f) => f.key === c.field), `cycle for unknown field ${c.field}`).toBe(true);
      if (c.kind === 'buff') {
        expect(cycles.some((p) => p.kind === 'proc' && p.field === c.startedBy), `${c.field} starts from unknown proc ${c.startedBy}`).toBe(true);
      }
    }
  });
});
