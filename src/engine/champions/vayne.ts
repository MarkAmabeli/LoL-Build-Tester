import { critFactor } from '../damage';
import { addBonus } from '../stats';
import type { Effect } from '../effects/types';
import { dataValue } from './spells';
import type { ChampionDefinition, ChampionSpells } from './types';

// Spell data: spells/Vayne.json (16.20). Mechanics cross-checked against the wiki: wiki-sources.json.

/** Silver Bolts: every third hit deals true damage, a % of the target's max health with a minimum. */
const silverBolts = (rank: number, spells: ChampionSpells): Effect => ({
  id: 'Vayne:W',
  name: 'Silver Bolts',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'proc', label: 'Third hit (proc)', scope: 'combat', kind: 'toggle', default: false }],
  // Three consecutive attacks; the marks last DebuffDuration 3.5 after each.
  cycles: [{ kind: 'proc', field: 'proc', counts: 'attack', hits: 3, window: { seconds: 3.5, from: 'last' } }],
  onHit: ({ target, state }) => {
    if (!state.proc) return [];
    const ratio = dataValue(spells, 'VayneSilveredBolts', 'MaxHealthRatio', rank);
    const floor = dataValue(spells, 'VayneSilveredBolts', 'DamageFloor', rank);
    return [{ type: 'true', raw: Math.max(floor, ratio * target.stats.hp.total), source: 'Silver Bolts', tags: ['proc'] }];
  },
});

/** Final Hour: bonus AD while active. Its stealth and Tumble cooldown changes aren't modeled. */
const finalHour = (rank: number, spells: ChampionSpells): Effect => ({
  id: 'Vayne:R',
  name: 'Final Hour',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'active', label: 'Final Hour active', scope: 'action', kind: 'toggle', default: false }],
  modifyStats: (stats, state) =>
    state.active
      ? { ...stats, ad: addBonus(stats.ad, dataValue(spells, 'VayneInquisition', 'BonusAttackDamage', rank)) }
      : stats,
});

export const vayne: ChampionDefinition = {
  id: 'Vayne',
  verifiedPatch: '16.20',
  abilities: [
    {
      // The attack is both basic and spell damage; the bonus is spell damage (wiki notes).
      id: 'Q',
      name: 'Tumble',
      slot: 'Q',
      hits: (ctx) => [
        { type: 'physical', raw: ctx.attacker.ad.total * critFactor(ctx.attacker, ctx.crit), source: 'Tumble attack', tags: ['auto', 'ability'] },
        { type: 'physical', raw: ctx.formula('VayneTumble', 'ADRatioBonus'), source: 'Tumble', tags: ['ability'] },
      ],
    },
    {
      id: 'E',
      name: 'Condemn',
      slot: 'E',
      state: [{ key: 'wall', label: 'Knocked into a wall', scope: 'action', kind: 'toggle', default: false }],
      hits: (ctx) => [
        { type: 'physical', raw: ctx.formula('VayneCondemn', 'TotalDamage'), source: 'Condemn', tags: ['ability'] },
        ...(ctx.state.wall
          ? [{ type: 'physical' as const, raw: ctx.formula('VayneCondemn', 'EmpoweredDamageTT'), source: 'Condemn (wall)', tags: ['ability' as const] }]
          : []),
      ],
    },
  ],
  effects: (spells, ranks) => [
    ...(ranks.W ? [silverBolts(ranks.W, spells)] : []),
    ...(ranks.R ? [finalHour(ranks.R, spells)] : []),
  ],
};
