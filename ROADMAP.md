# Roadmap

## 1. Data pipeline
- [x] Fetch Data Dragon champions, items and runes per patch
- [x] Parse item stats that only exist in description text (ability haste, lethality, penetration)
- [x] Pull CommunityDragon spell DataValues and SpellCalculations per champion
- [ ] Translate SpellCalculations into `DamageComponent`s (base per rank + ratios)
- [ ] Hand-maintained overrides file for cases the raw data gets wrong
- [ ] Schema validation on generated output

## 2. Stat engine
- [x] Base stats by level, base/bonus split
- [x] Attack speed with ratio and cap
- [x] Bonus aggregation (% pen stacks multiplicatively)
- [ ] Rune stat shards, including level-scaling ones
- [ ] Conditional/stacking stats (e.g. stack counts set by the user)

## 3. Damage engine
- [x] Resist multiplier incl. negative resist
- [x] Reduction → penetration ordering
- [x] Ratios incl. target max/current/missing HP
- [x] Crit (expected and guaranteed)
- [ ] Execute thresholds, damage reduction effects, shields

## 4. Effects layer
- [ ] Modifier hooks: `modifyStats`, `onHit`, `preMitigation`, `postMitigation`
- [ ] The 20–30 most-built damage items
- [ ] Keystone runes (Conqueror, Electrocute, Press the Attack, Lethal Tempo, Arcane Comet, Dark Harvest, First Strike)

## 5. Combo simulator
- [ ] Ordered action list (Q, AA, E, R…) with stateful stacks, procs and shred
- [ ] Total damage, per-source breakdown, time-to-kill, effective HP

## 6. UI
- [ ] Shared "loadout" component for attacker and target: champion, level, skill ranks, items, runes
- [ ] Per-ability table with expandable ratio breakdown
- [ ] Combo builder
- [ ] Damage across levels 1–18 chart
- [ ] A/B build comparison
- [ ] Shareable state in the URL

## 7. Validation
- [ ] Practice Tool reference numbers for ~5 champions as snapshot tests

## 8. Automation
- [x] CI: type-check, lint, test, build
- [ ] Scheduled workflow: detect new patch, regenerate data, open a PR
- [ ] Deploy to GitHub Pages

### MVP slice
Steps 1–3 and 6 for ~5 champions (including a stacker and an on-hit carry), ~10 items and auto attacks.
