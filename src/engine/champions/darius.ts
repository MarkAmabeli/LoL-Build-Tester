import { critFactor } from '../damage';
import { addBonus, stackPct } from '../stats';
import type { Effect } from '../effects/types';
import { dataValue, selfFormula } from './spells';
import type { ChampionDefinition, ChampionSpells } from './types';

// Spell data: spells/Darius.json (16.20). Mechanics cross-checked against the wiki: wiki-sources.json.

const MAX_STACKS = 5;

/** Noxian Might: at 5 Hemorrhage stacks on a champion, bonus AD by level for 5s. */
const noxianMight = (spells: ChampionSpells): Effect => ({
  id: 'Darius:P',
  name: 'Noxian Might',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'active', label: 'Noxian Might active', scope: 'combat', kind: 'toggle', default: false }],
  // Fifth Hemorrhage stack (MaxStacks 5, each lasting BleedDuration 5), then 5s of bonus AD from the next hit.
  cycles: [{ kind: 'proc', field: 'active', counts: 'hit', hits: MAX_STACKS, window: { seconds: 5, from: 'last' }, lasts: 5, fromNext: true }],
  modifyStats: (stats, state) =>
    state.active
      ? { ...stats, ad: addBonus(stats.ad, selfFormula(spells, 'DariusHemoMarker', 'NoxianMightBonusAD', 1, stats)) }
      : stats,
});

/** Apprehend's passive: percent armor penetration by rank (stored in percent). */
const apprehendPassive = (rank: number, spells: ChampionSpells): Effect => ({
  id: 'Darius:E',
  name: 'Apprehend (passive)',
  kind: 'champion',
  verifiedPatch: '16.20',
  modifyStats: (stats) => ({
    ...stats,
    armorPenPct: stackPct(stats.armorPenPct, dataValue(spells, 'DariusAxeGrabCone', 'PassivePercentArmorPen', rank) / 100),
  }),
});

export const darius: ChampionDefinition = {
  id: 'Darius',
  verifiedPatch: '16.20',
  abilities: [
    {
      // Each stack deals its damage over 5s; counted as one hit, like item burns.
      id: 'P',
      name: 'Hemorrhage',
      slot: 'P',
      // How many stacks' bleed to show; the target's stacks over a fight are R's 'stacks'.
      state: [{ key: 'stacks', label: 'Hemorrhage stacks', scope: 'action', kind: 'number', default: 1, min: 1, max: MAX_STACKS }],
      hits: (ctx) => [{
        type: 'physical',
        raw: Math.min(MAX_STACKS, Number(ctx.state.stacks)) * ctx.formula('DariusHemoMarker', 'BleedDamagePerStack'),
        source: 'Hemorrhage',
        tags: ['dot'],
      }],
    },
    {
      id: 'Q',
      name: 'Decimate',
      slot: 'Q',
      state: [{ key: 'handle', label: 'Hit by the handle (inner circle)', scope: 'action', kind: 'toggle', default: false }],
      hits: (ctx) => [{
        type: 'physical',
        raw: ctx.formula('DariusCleave', ctx.state.handle ? 'HandleDamage' : 'BladeDamage'),
        source: 'Decimate',
        tags: ['ability', 'aoe'],
      }],
    },
    {
      // The empowered attack replaces the attack's damage and can crit (wiki).
      id: 'W',
      name: 'Crippling Strike',
      slot: 'W',
      hits: (ctx) => [{
        type: 'physical',
        raw: ctx.formula('DariusNoxianTacticsONH', 'EmpoweredAttackDamage') * critFactor(ctx.attacker, ctx.crit),
        source: 'Crippling Strike',
        tags: ['auto', 'ability'],
      }],
    },
    {
      id: 'R',
      name: 'Noxian Guillotine',
      slot: 'R',
      state: [{ key: 'stacks', label: 'Hemorrhage stacks on target', scope: 'combat', kind: 'number', default: 0, min: 0, max: MAX_STACKS }],
      // Attacks and damaging abilities apply a stack; BleedDuration 5.
      cycles: [{ kind: 'stacks', field: 'stacks', counts: 'hit', max: MAX_STACKS, expiresAfter: 5 }],
      hits: (ctx) => {
        const amp = ctx.value('DariusExecute', 'RDamagePercentPerHemoStack') * Math.min(MAX_STACKS, Number(ctx.state.stacks));
        return [{ type: 'true', raw: ctx.formula('DariusExecute', 'Damage') * (1 + amp), source: 'Noxian Guillotine', tags: ['ability'] }];
      },
    },
  ],
  effects: (spells, ranks) => [noxianMight(spells), ...(ranks.E ? [apprehendPassive(ranks.E, spells)] : [])],
};
