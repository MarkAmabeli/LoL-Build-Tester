# LoL Build Tester

A League of Legends damage calculator: pick an attacker and a target, set their levels, items and runes, and see what each ability, auto attack and combo actually does after resistances.

It builds on two references: the matchup/combo sandbox of [lolcalculator.gg](https://www.lolcalculator.gg), and the per-ratio breakdowns of [ChooChooShoe/lol-damage-calculator](https://github.com/ChooChooShoe/lol-damage-calculator). Unlike that second one, it uses Riot's structured game data instead of scraping wiki HTML.

## Status

Early development. See [ROADMAP.md](ROADMAP.md).

- [x] Stat engine (level scaling, attack speed, item/rune bonuses)
- [x] Mitigation engine (armor/MR, reduction and penetration order, true damage)
- [x] Data pipeline (Data Dragon + CommunityDragon → versioned JSON)
- [ ] Spell formula parsing
- [ ] Item passives and runes
- [ ] Combo simulator
- [ ] Full UI

## Stack

React 19, TypeScript, Vite and Vitest. It's a static app with no backend: game data is generated per patch into `public/data/<version>/`.

## Getting started

```bash
npm install
npm run data     # fetch the latest patch's data (or: npm run data -- 16.19.1)
npm run dev
npm test
```

## Project layout

```
src/engine/      Pure, framework-free damage math (fully unit tested)
  stats.ts       Level scaling, attack speed, bonus aggregation
  mitigation.ts  Resist multipliers, penetration/reduction pipeline, effective HP
  damage.ts      Ability components, ratios, auto attacks
scripts/         Data pipeline (run with Node via tsx)
public/data/     Generated game data, one folder per patch
```

## Formulas

| What | Formula |
| --- | --- |
| Stat at level *n* | `base + growth × (n−1) × (0.7025 + 0.0175 × (n−1))` |
| Attack speed | `baseAS + ratio × (levelGrowth% + bonusAS%) / 100`, capped at 2.5 |
| Damage multiplier | `100 / (100 + R)` if R ≥ 0, otherwise `2 − 100 / (100 − R)` |
| Resist order | flat reduction → % reduction → % penetration → flat penetration |
| Cooldown | `cd × 100 / (100 + ability haste)` |

## Data sources

- [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon): champion stats, items, runes.
- [CommunityDragon](https://communitydragon.org): spell values and calculations from game files.

This project isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
