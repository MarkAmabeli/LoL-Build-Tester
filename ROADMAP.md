# Roadmap

## Next up (in order)
From the engine review before starting the UI. Work these top to bottom.

1. [x] **Duplicate items.** 26 items appeared twice in `items.json` (e.g. Frozen Heart `3110` and `323110`). `scripts/item-dedupe.ts` keeps one per name by assumption (the entry on the most maps, then the lowest ID); the build log lists what was dropped. Recipes (`from`/`into`) now only link items in the list. A manual review of the item list follows.
2. [x] **Proc state starts unstacked.** Every state field has a scope: `setup` (before the fight), `combat` (driven by a cycle; defaults to its start-of-combat value) or `action` (set by the combo). Effects and abilities declare cycles (`src/engine/effects/cycles.ts`): procs (hit counts, windows, cooldowns by level, arming like Spellblade, lasting buffs like First Strike, outside conditions like Energized), stacks (per hit, melee/ranged, expiry) and buffs started by a proc (Press the Attack's exposure). `cycleStep` applies them to a fight's events for the combo simulator; a test checks every combat field has one cycle and the right default. Not modeled yet: Arcane Comet's cooldown refunds, Dark Harvest's reset on takedown, First Strike's out-of-combat requirement, and the Energized charge itself (reported by the simulator). Deliberate exception: Energized items start charged (`startsReady`), since the stacks build while walking into the fight.
3. [x] **Engine helpers for the UI.** `resolveLoadout` (`src/engine/loadout.ts`) resolves one champion's setup (level, ranks, items, runes, shards, state overrides) into stats and effects, with warnings instead of errors: shop limits, more than 6 items, rune page structure, shards, and skill ranks against the level. Trinkets and consumables are skipped. Spell files now hold cooldown, cost and range per rank (`scripts/spell-ranks.ts`); `abilityCooldown` applies ability/basic/ultimate haste. Role quests (bot lane's separate boots slot) aren't modeled until they're implemented deliberately.
4. [ ] **Tracked hand-entered values.** Every hand-entered value or override (item/rune/champion constants, data interpretations, overrides files) is declared in one consistent, findable way so none lingers untracked. Each records the source value it was checked against; after a data fetch, flag any whose source value changed and now conflicts. Conflicts that existed before and didn't change with the update aren't flagged.
5. [ ] **Summoner spells.** Ignite (true damage over time) first, then the others that affect damage (e.g. Exhaust once defence exists).
6. [x] **Fix the stale comment** in `src/engine/types.ts` (`critDamageBonus` said base 175%). Also fixed Sundered Sky, which used a fixed 150% crit instead of 80% of crit damage.

Damage is calculated against a **target dummy**: max health, current health, armor and magic resist only, with no defensive items or effects. Defence comes in phase 2.

## Phase 2: Defence
- [ ] Target-side hook for incoming damage, run inside `computeHit`, fed by the target's own loadout
- [ ] Target items: Plated Steelcaps (−10% damage from attacks), Randuin's Omen (−30% crit damage), Frozen Heart (attack speed slow), Thornmail
- [ ] Bone Plating (flat reduction per hit; see section 4)
- [ ] Shields (Sterak's Gage, Maw of Malmortius, Kaenic Rookern) and damage reduction (see section 3)

## Later
- [ ] Healing and sustain: life steal and omnivamp stats, healing from items, runes and abilities (Conqueror, BotRK, Darius), for duels and time-to-kill
- [ ] Move speed soft caps (above 415 and 490), for move-speed-scaling effects
- [ ] Yunara's passive under expected crits estimates the crit from total AD, ignoring earlier `modifyHit` changes (e.g. Sundered Sky)

## 1. Data pipeline
- [x] Fetch Data Dragon champions, items and runes per patch
- [x] Parse item stats that only exist in description text (ability haste, lethality, penetration)
- [x] Pull CommunityDragon spell DataValues and SpellCalculations per champion
- [x] Translate SpellCalculations into `Formula`s (base per rank and by level + ratios), with Q/W/E/R slots and max ranks from Data Dragon; 90.5% of calculations translate, the rest are listed per spell as unsupported with a reason
- [ ] Raise formula coverage: crit damage (stat 9), cooldown multipliers, conditional calculations, `ByCharLevelFormula`, `EffectValue`, clamps, stat × stat
- [ ] Hand-maintained overrides file for cases the raw data gets wrong (started: `scripts/overrides/adaptive-magic.json`)
- [x] `scripts/sources.ts`: per-source settings, every modification the import makes (with the code that does it) and notes, as the single place to check before a refresh
- [ ] Schema validation on generated output

## 2. Stat engine
- [x] Base stats by level, base/bonus split
- [x] Attack speed with ratio and cap
- [x] Bonus aggregation (% pen stacks multiplicatively)
- [x] Rune stat shards, including level-scaling ones (from CommunityDragon perks)
- [x] Adaptive force (0.6 AD or 1 AP, by higher bonus; per-champion tie-break)
- [ ] Conditional/stacking stats (e.g. stack counts set by the user)

## 3. Damage engine
- [x] Resist multiplier incl. negative resist
- [x] Reduction → penetration ordering
- [x] Ratios incl. target max/current/missing HP
- [x] Crit (expected and guaranteed)
- [x] Execute thresholds (`executedBy` on hit results)
- [ ] Damage reduction effects, shields

## 4. Effects layer
- [x] Effect hooks: `modifyStats`, `onHit`, `onAbilityHit`, `preMitigation`, `targetResist` (pilot items: Rabadon's, Black Cleaver, Nashor's, Kraken)
- [x] Damage items on existing hooks: Wit's End, Terminus, BotRK, Guinsoo's, Hullbreaker, Titanic Hydra, Lord Dominik's, Shadowflame, Liandry's, Riftmaker, Manamune/Muramana, Archangel's/Seraph's, Blackfire Torch, Hubris, Voltaic Cyclosword, Experimental Hexplate, Luden's, Malignance, Stormsurge
- [x] Spellblade items (Sheen, Trinity Force, Lich Bane, Essence Reaver, Iceborn Gauntlet, Bloodsong, Dusk and Dawn), Energized items (Statikk Shiv, Rapid Firecannon), The Collector (`executeThreshold` hook), Sundered Sky (`modifyHit` hook)
- [x] Ultimate haste stat (Malignance, Experimental Hexplate)
- [ ] Guinsoo's double on-hit (needs combo simulator)
- [x] Keystone runes (Conqueror, Electrocute, Press the Attack, Lethal Tempo, Arcane Comet, Dark Harvest, First Strike)
- [x] Minor runes: Coup de Grace, Cut Down, Last Stand, Absolute Focus, Gathering Storm
- [x] More minor runes: Cheap Shot, Sudden Impact, Scorch, Axiom Arcanist (needs `ultimate` tag on R hits), Legend: Alacrity, Legend: Haste, Transcendence, Waterwalking, Jack of All Trades
- [x] Defensive stat runes for the target's loadout: Conditioning, Overgrowth
- [ ] Bone Plating: needs a target-side, post-mitigation damage hook (flat reduction per hit)

## 4b. Champions
- [x] Champion definitions (`src/engine/champions/`): damage type, tags, empowered attacks (basic + spell damage), passives and self-buffs as effects; `abilityHit` runs abilities through the item/rune pipeline, R-rank abilities deal ultimate damage
- [x] MVP champions: Vayne, Darius, Veigar, Nasus, Yunara
- [x] Wiki sources (wiki.leagueoflegends.com) recorded per page with revision and `changes` patch; `npm run wiki:check` flags changed pages before a new patch
- [ ] Yunara's spread attacks and other multi-target effects; Vayne/Yunara movement; Nasus/Veigar stack gain over a fight (combo simulator)
- [ ] More champions

## 5. Combo simulator
- [ ] Ordered action list (Q, AA, E, R…) with stateful stacks, procs and shred
- [ ] Burn over time for Liandry's, Blackfire Torch and Malignance (and similar damage over time): today each burn is one full-duration hit. How ticks, durations and refreshes feed into calculations is still to be decided
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
