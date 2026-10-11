import { targetHpPct } from '../damage';
import type { Effect } from '../effects/types';
import type { ChampionDefinition } from './types';
import { hand, sourced, spell, wiki } from '../hand';

// Spell data: spells/Veigar.json (16.20). Mechanics cross-checked against the wiki: wiki-sources.json.

// R deals 1.5% more per 1% of the target's missing health, up to 2× (at 66.66% missing).
const R_AMP_PER_MISSING = hand('veigar.rAmpPerMissing', 1.5, wiki('Template:Data Veigar/Primordial Burst', '1.5% per 1%'));
const R_MAX_MULT = sourced('veigar.rMaxMult', spell('Veigar', 'VeigarR', 'MaxExecuteMult', 2));

/** Phenomenal Evil: 1 AP per stack. */
const phenomenalEvil: Effect = {
  id: 'Veigar:P',
  name: 'Phenomenal Evil',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'stacks', label: 'Phenomenal Evil stacks', scope: 'setup', kind: 'number', default: 0, min: 0, max: 10000 }],
  modifyStats: (stats, state) => ({ ...stats, ap: stats.ap + Math.max(0, Number(state.stacks)) }),
};

export const veigar: ChampionDefinition = {
  id: 'Veigar',
  verifiedPatch: '16.20',
  abilities: [
    {
      id: 'Q',
      name: 'Baleful Strike',
      slot: 'Q',
      hits: (ctx) => [{ type: 'magic', raw: ctx.formula('VeigarBalefulStrike', 'TotalDamage'), source: 'Baleful Strike', tags: ['ability'] }],
    },
    {
      id: 'W',
      name: 'Dark Matter',
      slot: 'W',
      hits: (ctx) => [{ type: 'magic', raw: ctx.formula('VeigarDarkMatter', 'TotalDamage'), source: 'Dark Matter', tags: ['ability', 'aoe'] }],
    },
    {
      id: 'R',
      name: 'Primordial Burst',
      slot: 'R',
      hits: (ctx) => {
        const missing = 1 - targetHpPct(ctx.target);
        const amp = Math.min(R_MAX_MULT - 1, R_AMP_PER_MISSING * Math.max(0, missing));
        return [{ type: 'magic', raw: ctx.formula('VeigarR', 'MinDamage') * (1 + amp), source: 'Primordial Burst', tags: ['ability'] }];
      },
    },
  ],
  effects: () => [phenomenalEvil],
};
