import type { EffectState, StateField } from './types';

/**
 * Proc and stack cycles: how an effect's combat state changes over a fight. Effects and
 * abilities declare them as data; `cycleStep` applies them to the fight's events in
 * time order. The combo simulator (ROADMAP section 5) drives this; the static
 * calculator uses each field's default, which is its value at the start of combat
 * (see `combatStartValue`).
 */

/** What a cycle counts. Empowered attacks (Vayne Q, Nasus Q) are both attacks and abilities. */
export type Trigger =
  | 'attack'
  /** Ability damage landing. */
  | 'ability'
  /** An attack or ability landing. */
  | 'hit'
  | 'physicalHit'
  /** Casting any ability (damaging or not). */
  | 'cast'
  | 'ultimateCast'
  /** A dash, leap, blink, teleport or leaving stealth. */
  | 'dash'
  /** Casting Ignite on a champion (it counts for Electrocute and Conqueror; wiki). */
  | 'igniteCast';

/**
 * Conditions the combo simulator decides and reports on an event. A cycle that
 * `requires` one only counts events that carry it.
 */
export type CycleCondition =
  /** Target's movement or actions are impaired (Cheap Shot). */
  | 'targetImpaired'
  /** Target below 50% health (Dark Harvest). */
  | 'targetBelowHalfHealth'
  /** Energized stacks are full; they come from moving and attacking (Statikk Shiv, RFC, Voltaic). */
  | 'energized'
  /** 25% of the target's max health dealt within 2.5s (Stormsurge). */
  | 'damageThreshold';

/**
 * Conditions the effect's own damage code already checks from the target's state, so a
 * proc can start ready even though the condition isn't met yet (Dark Harvest checks
 * the target's health itself).
 */
const CHECKED_BY_EFFECT: readonly CycleCondition[] = ['targetBelowHalfHealth'];

/** A cooldown in seconds, fixed or growing linearly from level 1 to 18. */
export type Seconds = number | { from: number; to: number };

/**
 * A proc (toggle field): true on the event that procs. Counted events build to `hits`;
 * the last one procs. With `consumedBy`, counting arms the proc instead and the next
 * `consumedBy` event procs (Spellblade: a cast arms it, the next attack procs).
 */
export interface ProcCycle {
  kind: 'proc';
  field: string;
  /** One trigger, or several that each count. */
  counts: Trigger | readonly Trigger[];
  /** Counted events needed; the last one procs. */
  hits: number;
  /** All the hits must land within `seconds` of the first one, or of the previous one. */
  window?: { seconds: number; from: 'first' | 'last' };
  /** After a proc, nothing counts until this has passed. */
  cooldown?: Seconds;
  consumedBy?: Trigger;
  /** How long an armed proc waits for its `consumedBy` event. */
  armedFor?: number;
  /** The field stays true this long after the proc (a buff, e.g. First Strike). */
  lasts?: number;
  /** With `lasts`: the buff starts after the proc event, not on it (Noxian Might). */
  fromNext?: boolean;
  requires?: CycleCondition;
  /**
   * A deliberate exception to "unstacked at the start of combat": the first counted event of
   * the fight procs without `requires`; after that the condition applies again. Only for
   * charges that build before a fight (Energized stacks build while walking in).
   */
  startsReady?: boolean;
}

/** A stack count (number field). Gains from an event apply from the next event on. */
export interface StackCycle {
  kind: 'stacks';
  field: string;
  /** 'second': one stack per second in combat (since the first hit), e.g. Liandry's. */
  counts: Trigger | readonly Trigger[] | 'second';
  /** Stacks per counted event (default 1), or by melee/ranged. */
  perHit?: number | { melee: number; ranged: number };
  /** Stacks per counted event that isn't a basic attack (abilities, Ignite), when it differs from `perHit` (Conqueror). */
  perNonAttackHit?: number;
  /** Gain on every `every`-th counted event only (Terminus: every other attack is Dark). */
  every?: number;
  max: number;
  /** All stacks drop after this many seconds without a counted event. */
  expiresAfter?: number;
}

/** A buff (toggle field) started by another field's proc on the same effect. */
export interface BuffCycle {
  kind: 'buff';
  field: string;
  /** The proc field that starts it. The buff starts after the proc event. */
  startedBy: string;
  lasts: number;
  /** Events that restart `lasts` while it's active (Press the Attack's exposure). */
  refreshedBy?: Trigger;
}

export type Cycle = ProcCycle | StackCycle | BuffCycle;

/** An item, rune or ability that has state and may declare cycles for it. */
export interface Cycled {
  state?: StateField[];
  cycles?: Cycle[];
}

/** Something that happened in the fight, as the combo simulator reports it. */
export interface CombatEvent {
  /** Seconds since the start of combat. */
  time: number;
  /** 'summoner': a summoner spell cast (`spell` is its Data Dragon ID). */
  type: 'hit' | 'cast' | 'dash' | 'summoner';
  spell?: string;
  /** A hit that is (or includes) a basic attack. */
  attack?: boolean;
  /** A hit that is (or includes) ability damage. */
  ability?: boolean;
  /** A cast or ability hit from the ultimate. */
  ultimate?: boolean;
  /** The hit deals physical damage. */
  physical?: boolean;
  conditions?: readonly CycleCondition[];
}

export interface CycleContext {
  level: number;
  ranged: boolean;
}

/** Per-field progress between events. */
export interface FieldTrack {
  count: number;
  firstAt?: number;
  lastAt?: number;
  /** Proc cycles: counting resumes at this time (cooldown). */
  readyAt: number;
  armedUntil?: number;
  /** Buffs and lasting procs: active until this time, starting at `startedAt`. */
  activeUntil?: number;
  startedAt?: number;
  /** Stack cycles: current stacks. */
  stacks: number;
  /** Proc cycles: whether it has procced this fight (ends `startsReady`). */
  procced?: boolean;
}

export type CycleTracker = Readonly<Record<string, FieldTrack>>;

const EMPTY: FieldTrack = { count: 0, readyAt: 0, stacks: 0 };

function matches(trigger: Trigger | readonly Trigger[], e: CombatEvent): boolean {
  if (typeof trigger !== 'string') return trigger.some((t) => matches(t, e));
  switch (trigger) {
    case 'attack': return e.type === 'hit' && !!e.attack;
    case 'ability': return e.type === 'hit' && !!e.ability;
    case 'hit': return e.type === 'hit';
    case 'physicalHit': return e.type === 'hit' && !!e.physical;
    case 'cast': return e.type === 'cast';
    case 'ultimateCast': return e.type === 'cast' && !!e.ultimate;
    case 'dash': return e.type === 'dash';
    case 'igniteCast': return e.type === 'summoner' && e.spell === 'SummonerDot';
  }
}

const isHitTrigger = (t: Trigger | readonly Trigger[]): boolean =>
  typeof t === 'string' ? t === 'attack' || t === 'ability' || t === 'hit' || t === 'physicalHit' : t.some(isHitTrigger);

export function secondsAt(s: Seconds, level: number): number {
  if (typeof s === 'number') return s;
  const lvl = Math.min(18, Math.max(1, Math.round(level)));
  return s.from + ((s.to - s.from) * (lvl - 1)) / 17;
}

/**
 * A combat field's value at the start of a fight, on the first hit that cycle counts:
 * a one-hit proc with nothing to arm and no outside condition (or marked `startsReady`)
 * is ready; every other proc, buff and stack count starts at false/0. State field
 * defaults must match this.
 */
export function combatStartValue(cycle: Cycle): number | boolean {
  if (cycle.kind === 'stacks') return 0;
  if (cycle.kind === 'buff') return false;
  const condition = !cycle.requires || CHECKED_BY_EFFECT.includes(cycle.requires) || !!cycle.startsReady;
  return cycle.hits === 1 && !cycle.consumedBy && isHitTrigger(cycle.counts) && condition;
}

function stepProc(c: ProcCycle, t0: FieldTrack, e: CombatEvent, ctx: CycleContext): { value: boolean; fired: boolean; track: FieldTrack } {
  const t = e.time;
  const track = { ...t0 };
  const conditionMet = !c.requires || (e.conditions ?? []).includes(c.requires) || (!!c.startsReady && !track.procced);
  let fired = false;

  if (c.consumedBy) {
    if (track.armedUntil !== undefined && t <= track.armedUntil && matches(c.consumedBy, e)) {
      fired = true;
      track.armedUntil = undefined;
    } else if (matches(c.counts, e) && t >= track.readyAt && conditionMet) {
      track.armedUntil = t + (c.armedFor ?? Infinity);
    }
  } else if (matches(c.counts, e) && t >= track.readyAt && conditionMet) {
    if (track.count > 0 && c.window) {
      const since = c.window.from === 'first' ? track.firstAt : track.lastAt;
      if (since !== undefined && t - since > c.window.seconds) track.count = 0;
    }
    track.count += 1;
    if (track.count === 1) track.firstAt = t;
    track.lastAt = t;
    if (track.count >= c.hits) {
      fired = true;
      track.count = 0;
    }
  }

  if (fired) {
    track.procced = true;
    track.readyAt = t + (c.cooldown === undefined ? 0 : secondsAt(c.cooldown, ctx.level));
    if (c.lasts !== undefined) {
      track.startedAt = t;
      track.activeUntil = t + c.lasts;
    }
  }
  if (c.lasts === undefined) return { value: fired, fired, track };
  const active = track.activeUntil !== undefined && t <= track.activeUntil;
  const startsLater = c.fromNext && track.startedAt === t;
  return { value: active && !startsLater, fired, track };
}

function stepStacks(c: StackCycle, t0: FieldTrack, e: CombatEvent, ctx: CycleContext): { value: number; track: FieldTrack } {
  const t = e.time;
  const track = { ...t0 };
  if (c.expiresAfter !== undefined && track.lastAt !== undefined && t - track.lastAt > c.expiresAfter) {
    track.stacks = 0;
    track.count = 0;
    track.firstAt = undefined;
  }

  if (c.counts === 'second') {
    if (e.type !== 'hit') return { value: track.stacks, track };
    if (track.firstAt === undefined) track.firstAt = t;
    track.lastAt = t;
    track.stacks = Math.min(c.max, Math.floor(t - track.firstAt));
    return { value: track.stacks, track };
  }

  const value = track.stacks;
  if (matches(c.counts, e)) {
    track.count += 1;
    track.lastAt = t;
    if (track.count % (c.every ?? 1) === 0) {
      const perHit = typeof c.perHit === 'object' ? (ctx.ranged ? c.perHit.ranged : c.perHit.melee) : (c.perHit ?? 1);
      const nonAttack = !e.attack && (e.ability || e.type === 'summoner');
      const gain = nonAttack && c.perNonAttackHit !== undefined ? c.perNonAttackHit : perHit;
      track.stacks = Math.min(c.max, track.stacks + gain);
    }
  }
  return { value, track };
}

function stepBuff(c: BuffCycle, t0: FieldTrack, e: CombatEvent, procFired: boolean): { value: boolean; track: FieldTrack } {
  const t = e.time;
  const track = { ...t0 };
  const active = track.activeUntil !== undefined && t <= track.activeUntil;
  const value = active && track.startedAt !== t;
  if (procFired) {
    track.startedAt = t;
    track.activeUntil = t + c.lasts;
  } else if (active && c.refreshedBy && matches(c.refreshedBy, e)) {
    track.activeUntil = t + c.lasts;
  }
  return { value, track };
}

/**
 * Apply one event to an effect's cycles. Returns the combat state to use for this
 * event's damage (only cycle-driven fields) and the tracker for the next event.
 * Events must come in time order. Procs run first, so buffs see this event's procs.
 */
export function cycleStep(
  owner: Cycled,
  tracker: CycleTracker,
  event: CombatEvent,
  ctx: CycleContext,
): { state: EffectState; tracker: CycleTracker } {
  const state: EffectState = {};
  const next: Record<string, FieldTrack> = { ...tracker };
  const cycles = owner.cycles ?? [];
  const fired = new Set<string>();
  for (const c of cycles.filter((x): x is ProcCycle => x.kind === 'proc')) {
    const r = stepProc(c, next[c.field] ?? EMPTY, event, ctx);
    next[c.field] = r.track;
    state[c.field] = r.value;
    if (r.fired) fired.add(c.field);
  }
  for (const c of cycles.filter((x): x is BuffCycle => x.kind === 'buff')) {
    const r = stepBuff(c, next[c.field] ?? EMPTY, event, fired.has(c.startedBy));
    next[c.field] = r.track;
    state[c.field] = r.value;
  }
  for (const c of cycles.filter((x): x is StackCycle => x.kind === 'stacks')) {
    const r = stepStacks(c, next[c.field] ?? EMPTY, event, ctx);
    next[c.field] = r.track;
    state[c.field] = r.value;
  }
  return { state, tracker: next };
}
