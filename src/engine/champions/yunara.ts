import { addBonusAttackSpeed } from '../stats';
import type { Effect } from '../effects/types';
import { selfFormula } from './spells';
import type { ChampionDefinition, ChampionSpells } from './types';

// Spell data: spells/Yunara.json (16.20). Mechanics cross-checked against the wiki: wiki-sources.json.

/**
 * Vow of the First Lands: crits deal 10% (+10% per 100 AP) of the crit's damage as bonus
 * magic damage. With expected crits, that's crit chance × a full crit's damage × the amp.
 */
const vow = (spells: ChampionSpells): Effect => ({
  id: 'Yunara:P',
  name: 'Vow of the First Lands',
  kind: 'champion',
  verifiedPatch: '16.20',
  onHit: ({ attacker, hit }) => {
    if (!hit?.tags?.includes('auto')) return [];
    const amp = selfFormula(spells, 'YunaraPassive', 'Calc_Damage_Amp', 1, attacker);
    const crit = hit.tags.includes('crit') ? hit.raw : attacker.critChance * attacker.ad.total * attacker.critMultiplier;
    return crit > 0 ? [{ type: 'magic', raw: amp * crit, source: 'Vow of the First Lands', tags: ['proc'] }] : [];
  },
});

/**
 * Cultivation of Spirit: attacks deal bonus magic damage on-hit. While active (5s, or all of
 * Transcend One's Self), bonus attack speed and more on-hit magic damage. The spread to
 * nearby enemies isn't modeled (single target).
 */
const cultivation = (rank: number, spells: ChampionSpells): Effect => ({
  id: 'Yunara:Q',
  name: 'Cultivation of Spirit',
  kind: 'champion',
  verifiedPatch: '16.20',
  state: [{ key: 'active', label: 'Cultivation of Spirit active', scope: 'action', kind: 'toggle', default: false }],
  modifyStats: (stats, state) =>
    state.active ? addBonusAttackSpeed(stats, 100 * selfFormula(spells, 'YunaraQ', 'Calc_Attack_Speed', rank, stats)) : stats,
  onHit: ({ attacker, state }) => [
    { type: 'magic', raw: selfFormula(spells, 'YunaraQ', 'Calc_Passive_Damage', rank, attacker), source: 'Cultivation of Spirit', tags: ['onhit'] },
    ...(state.active
      ? [{ type: 'magic' as const, raw: selfFormula(spells, 'YunaraQ', 'Calc_Damage', rank, attacker), source: 'Cultivation of Spirit (active)', tags: ['onhit' as const] }]
      : []),
  ],
});

export const yunara: ChampionDefinition = {
  id: 'Yunara',
  verifiedPatch: '16.20',
  abilities: [
    {
      id: 'W',
      name: 'Arc of Judgment',
      slot: 'W',
      state: [{ key: 'seconds', label: 'Seconds in the lingering bead', scope: 'action', kind: 'number', default: 0, min: 0, max: 5 }],
      hits: (ctx) => {
        const seconds = Math.max(0, Number(ctx.state.seconds));
        return [
          { type: 'magic', raw: ctx.formula('YunaraW', 'Calc_Damage_Initial'), source: 'Arc of Judgment', tags: ['ability', 'aoe'] },
          ...(seconds > 0
            ? [{ type: 'magic' as const, raw: ctx.formula('YunaraW', 'Calc_Damage_Per_Second') * seconds, source: 'Arc of Judgment (linger)', tags: ['ability' as const, 'aoe' as const, 'dot' as const] }]
            : []),
        ];
      },
    },
    {
      // W during Transcend One's Self; uses the R rank and counts as ultimate damage (wiki).
      id: 'RW',
      name: 'Arc of Ruin',
      slot: 'R',
      // Assumes it shares W's cooldown, not Transcend One's Self's (W has no usable cooldown in the data).
      spell: 'YunaraW',
      hits: (ctx) => [{ type: 'magic', raw: ctx.formula('YunaraR', 'Calc_RW_Damage'), source: 'Arc of Ruin', tags: ['ability', 'aoe'] }],
    },
  ],
  effects: (spells, ranks) => [vow(spells), ...(ranks.Q ? [cultivation(ranks.Q, spells)] : [])],
};
