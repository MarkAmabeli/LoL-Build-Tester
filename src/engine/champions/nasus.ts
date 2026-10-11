import { critFactor } from '../damage';
import { addBonus } from '../stats';
import type { Effect } from '../effects/types';
import { dataValue } from './spells';
import type { ChampionDefinition, ChampionSpells } from './types';

// Spell data: spells/Nasus.json (16.20). Mechanics cross-checked against the wiki: wiki-sources.json.

const R_DAMAGE_CAP_PER_SECOND = 240; // NasusR MaxDamageCap; wiki: "capped at 240 per second"
const R_MAX_SECONDS = 15;

/** Fury of the Sands: bonus health, armor and MR while active. */
const furyOfTheSands = (rank: number, spells: ChampionSpells): Effect => ({
  id: 'Nasus:R',
  name: 'Fury of the Sands',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'active', label: 'Fury of the Sands active', scope: 'action', kind: 'toggle', default: false }],
  modifyStats: (stats, state) => {
    if (!state.active) return stats;
    const resist = dataValue(spells, 'NasusR', 'InitialResistGain', rank);
    return {
      ...stats,
      hp: addBonus(stats.hp, dataValue(spells, 'NasusR', 'BonusHealth', rank)),
      armor: addBonus(stats.armor, resist),
      mr: addBonus(stats.mr, resist),
    };
  },
});

/** Spirit Fire's armor reduction on enemies standing in it (stored negative). */
const spiritFireShred = (rank: number, spells: ChampionSpells): Effect => ({
  id: 'Nasus:E',
  name: 'Spirit Fire (armor reduction)',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'active', label: 'Target in Spirit Fire', scope: 'action', kind: 'toggle', default: false }],
  targetResist: ({ state }) =>
    state.active ? { armor: { pct: -dataValue(spells, 'NasusE', 'ArmorShredPercent', rank) } } : {},
});

export const nasus: ChampionDefinition = {
  id: 'Nasus',
  verifiedPatch: '16.20',
  abilities: [
    {
      // The data's TotalDamage includes the attack (AD) and stacks; the flat bonus can crit (wiki).
      id: 'Q',
      name: 'Siphoning Strike',
      slot: 'Q',
      state: [{ key: 'stacks', label: 'Siphoning Strike stacks', scope: 'setup', kind: 'number', default: 0, min: 0, max: 10000 }],
      hits: (ctx) => [{
        type: 'physical',
        raw: ctx.formula('NasusQ', 'TotalDamage', { stacks: Number(ctx.state.stacks) }) * critFactor(ctx.attacker, ctx.crit),
        source: 'Siphoning Strike',
        tags: ['auto', 'ability'],
      }],
    },
    {
      // The wiki gives the total over time as 10 ticks; the data's TotalDotDamage is
      // Duration (5) × per tick, which is used here.
      id: 'E',
      name: 'Spirit Fire',
      slot: 'E',
      state: [{ key: 'seconds', label: 'Seconds in the fire', scope: 'action', kind: 'number', default: 0, min: 0, max: 5 }],
      hits: (ctx) => {
        const seconds = Math.min(ctx.value('NasusE', 'Duration'), Math.max(0, Number(ctx.state.seconds)));
        const dot = (ctx.formula('NasusE', 'TotalDotDamage') * seconds) / ctx.value('NasusE', 'Duration');
        return [
          { type: 'magic', raw: ctx.formula('NasusE', 'InitialDamage'), source: 'Spirit Fire', tags: ['ability', 'aoe'] },
          ...(seconds > 0 ? [{ type: 'magic' as const, raw: dot, source: 'Spirit Fire (burn)', tags: ['ability' as const, 'aoe' as const, 'dot' as const] }] : []),
        ];
      },
    },
    {
      // Data: % of target max health per second (+0.01% per AP); wiki shows it per 0.5s tick.
      id: 'R',
      name: 'Fury of the Sands (aura)',
      slot: 'R',
      state: [{ key: 'seconds', label: 'Seconds of aura damage', scope: 'action', kind: 'number', default: 1, min: 0, max: R_MAX_SECONDS }],
      hits: (ctx) => {
        const seconds = Math.min(R_MAX_SECONDS, Math.max(0, Number(ctx.state.seconds)));
        const perSecond = Math.min(R_DAMAGE_CAP_PER_SECOND, ctx.formula('NasusR', 'DamageCalc') * ctx.target.stats.hp.total);
        return [{ type: 'magic', raw: perSecond * seconds, source: 'Fury of the Sands', tags: ['ability', 'aoe', 'dot'] }];
      },
    },
  ],
  effects: (spells, ranks) => [
    ...(ranks.E ? [spiritFireShred(ranks.E, spells)] : []),
    ...(ranks.R ? [furyOfTheSands(ranks.R, spells)] : []),
  ],
};
