/**
 * Single source of truth for every external data source: how it's accessed (settings the
 * scripts read from here), every explicit change we make to its data (modifications), and
 * what we've learned about it (notes). Read this before refreshing data or investigating
 * a source, so the same ground isn't covered twice.
 *
 * Rules:
 *   - A script that reads a source takes its URL, paths and access settings from here.
 *   - Any change the import makes to a source's data gets a `modifications` entry naming
 *     the code that does it (`where`). sources.test.ts checks those files exist.
 *   - Anything learned about a source that isn't a change (quirks, mismatches checked and
 *     accepted, dead ends) goes in `notes`, with the patch it was checked on.
 *   - Hand-entered gameplay constants in the engine are declared through src/engine/hand.ts,
 *     each with its source and the value it was checked against; src/engine/hand-entered.test.ts
 *     flags any whose source changed in the latest data (game-values.json, spell files,
 *     descriptions). This file covers how the import reads and changes each source.
 */

export interface Modification {
  /** Short stable key, e.g. "items-dedupe". */
  readonly id: string;
  /** What changes in the data. */
  readonly what: string;
  /** Why the source's data can't be used as is. */
  readonly why: string;
  /** Files that implement it (repo-relative). */
  readonly where: readonly string[];
}

export interface Source {
  readonly name: string;
  /** What we read from it. */
  readonly provides: readonly string[];
  readonly modifications: readonly Modification[];
  readonly notes: readonly string[];
}

export const DATA_DRAGON: Source & { baseUrl: string; locale: string; summonersRiftMap: string } = {
  name: 'Data Dragon (Riot)',
  baseUrl: 'https://ddragon.leagueoflegends.com',
  locale: 'en_US',
  /** `maps` key for Summoner's Rift in item.json. */
  summonersRiftMap: '11',
  provides: [
    'api/versions.json: patch list; the newest is the default data version',
    'champion.json: base stats, tags, resource, icons',
    'champion/<id>.json: Q/W/E/R spell IDs and max ranks',
    'item.json: items, gold, recipes, stats, descriptions',
    'runesReforged.json: rune trees',
    "summoner.json: summoner spell names, IDs, icons and modes (its tooltips and values have no numbers)",
  ],
  modifications: [
    {
      id: 'champion-ad-per-level',
      what: "attackdamageperlevel is replaced by the champion bin's damagePerLevelModifiable when Data Dragon's is 0",
      why: 'Data Dragon 16.20.1 ships 0 for all 173 champions. The bin values match the wiki for 172; Senna is genuinely 0',
      where: ['scripts/fetch-data.ts', 'scripts/champion-data.test.ts'],
    },
    {
      id: 'champion-adaptive-type',
      what: 'stats.adaptiveType added (adaptive force tie-break), AP for the champions listed in the overrides file',
      why: "Data Dragon doesn't have it",
      where: ['scripts/fetch-data.ts', 'scripts/overrides/adaptive-magic.json', 'scripts/overrides.test.ts'],
    },
    {
      id: 'items-store-filter',
      what: "Only items on Summoner's Rift that are purchasable, in store, and not champion- or ally-locked",
      why: 'item.json holds every mode and internal item',
      where: ['scripts/fetch-data.ts'],
    },
    {
      id: 'items-dedupe',
      what: 'One entry per item name: the one on the most maps, then the lowest ID. Dropped IDs are printed in the build log',
      why: "26 names appear twice (32xxxx/66xxxx variants, jungle pets 1105–1107), all passing the store filter. What unlocks the variants is unconfirmed; this is an assumption pending manual review",
      where: ['scripts/item-dedupe.ts', 'scripts/item-dedupe.test.ts', 'scripts/item-data.test.ts'],
    },
    {
      id: 'items-recipe-links',
      what: 'from/into only keep IDs that are in the written item list',
      why: 'Recipes point at dropped variants, other-mode items (Atma\'s Reckoning) and unbuyable ones (Trailblazer)',
      where: ['scripts/fetch-data.ts', 'scripts/item-data.test.ts'],
    },
    {
      id: 'role-quest-items',
      what: "role-quests.json: boots (shop group), tier 2 → tier 3 boots (a tier 3 is built from exactly one tier 2, which has its own recipe), Bounty of Worlds' upgrades (built from item 3867), jungle pets (shop group) and the support starting item (World Atlas, 3865, named by ID since its upgrade path is outside the store), from the full recipes before items.json filters them",
      why: 'Role quest rewards decide which items a build can hold; Bounty of Worlds is not in the store, so only the raw recipes link its upgrades',
      where: ['scripts/role-quests.ts', 'scripts/role-quests.test.ts', 'scripts/role-quests-data.test.ts', 'scripts/fetch-data.ts', 'src/engine/role-quests.ts'],
    },
    {
      id: 'items-description-stats',
      what: 'Ability haste, lethality, penetration and crit damage are parsed from the description <stats> block; percentages are converted to the engine units',
      why: "The structured `stats` field doesn't include them",
      where: ['scripts/item-stats.ts', 'scripts/item-stats.test.ts'],
    },
    {
      id: 'spell-slots',
      what: "Spells get a Q/W/E/R slot and max rank from champion/<id>.json; others get 'P' if the name contains 'passive', and max rank 5",
      why: 'The bins have no slot or rank count',
      where: ['scripts/fetch-data.ts'],
    },
  ],
  notes: [
    'No attack speed ratio, windup or missile speed; those are in the CommunityDragon champion bins.',
    'Ability tooltips no longer carry usable numbers; spell values come from the CommunityDragon bins.',
    'Base stats other than AD per level matched the wiki for Vayne, Darius, Veigar, Nasus and Yunara (16.20).',
    'Symbiotic Soles, Synchronized Souls and Forever Forward are in item.json but not purchasable (16.20), so items.json leaves them out; the user reports Symbiotic Soles is no longer in the game.',
    'Role quest items (1200–1211, 1220–1222, 1090–1094) are in item.json but not purchasable; their reward values are in the items bin (game-values.json).',
  ],
};

export const COMMUNITY_DRAGON: Source & { baseUrl: string; fallbackFolder: string; clientDataPath: string } = {
  name: 'CommunityDragon (raw game files)',
  baseUrl: 'https://raw.communitydragon.org',
  /** Used when the patch folder ("16.20") isn't published yet. */
  fallbackFolder: 'latest',
  clientDataPath: 'plugins/rcp-be-lol-game-data/global/default/v1',
  provides: [
    'game/data/characters/<id>/<id>.bin.json: spell DataValues and SpellCalculations; CharacterRecords/Root base stats',
    'game/items.cdtb.bin.json: shop limit groups, and item values for game-values.json',
    'game/perks.cdtb.bin.json: rune values for game-values.json',
    'game/shared.cdtb.bin.json: summoner spell values (Shared/Spells/<id>), ~8.6 MB',
    'game/items.cdtb.bin.json: role quest reward values (items 1206 mid, 1207 bot, 1221 top) in game-values.json',
    '<clientDataPath>/perks.json and perkstyles.json: stat shard rows and text',
  ],
  modifications: [
    {
      id: 'spell-formulas',
      what: 'SpellCalculations are translated into engine formulas; untranslatable ones are listed per spell with a reason',
      why: 'The game format is a tree of calculation parts, not a damage formula',
      where: ['scripts/spell-formulas.ts', 'scripts/spell-formulas.test.ts', 'scripts/spell-data.test.ts'],
    },
    {
      id: 'spell-ranks',
      what: 'Spell cooldown, cost and range become one value per rank (index 0 = rank 1). Missing or all-zero cooldowns and costs are omitted; ranges are omitted when any rank is a placeholder (≤ 1 or ≥ 10000). Slotted abilities without a cooldown are listed in the build log',
      why: 'cooldownTime and castRange have a placeholder entry 0 (rank N = entry N) but mana does not (rank N = entry N − 1); ranges like 0, 1, 10000 and 25000 stand for self-cast or global',
      where: ['scripts/spell-ranks.ts', 'scripts/spell-ranks.test.ts', 'scripts/fetch-data.ts', 'scripts/spell-data.test.ts'],
    },
    {
      id: 'summoner-spells',
      what: "summoners.json: Summoner's Rift spells (Data Dragon mode CLASSIC) with names and icons from Data Dragon and data values, cooldown, range and translated formulas from Shared/Spells/<id>",
      why: "Data Dragon's summoner values are placeholders",
      where: ['scripts/fetch-data.ts', 'scripts/summoner-data.test.ts', 'src/engine/summoners.ts'],
    },
    {
      id: 'game-values',
      what: 'game-values.json snapshots item data values and calculation numbers (4-digit IDs), rune effect amounts and champion Root values, rounded to 7 significant digits',
      why: 'Hand-entered engine constants (src/engine/hand.ts) are checked against it in npm test, without network access',
      where: ['scripts/game-values.ts', 'scripts/game-values.test.ts', 'scripts/fetch-data.ts', 'src/engine/hand-entered.test.ts'],
    },
    {
      id: 'item-group-names',
      what: 'Four hashed group keys get readable names (Spellblade, SpellShield, Thorns, HydraItems); limits above 10 are treated as unlimited',
      why: 'Some group keys and IDs are only hashes; Arena groups use 99',
      where: ['scripts/item-groups.ts', 'scripts/item-groups.test.ts', 'scripts/item-groups-data.test.ts'],
    },
    {
      id: 'shard-text',
      what: "Stat shard values are parsed from perks.json description text; the first rune tree's shard rows are used",
      why: 'Shard values only exist as text; every tree lists the same rows (checked, warns if not)',
      where: ['scripts/shard-stats.ts', 'scripts/shard-stats.test.ts', 'scripts/shard-data.test.ts'],
    },
  ],
  notes: [
    'The folder is the patch without its last part: Data Dragon 16.20.1 → "16.20".',
    'Spell data values use name/values in current files; older files use mName/mValues. Both are read.',
    'Entry 0 of each data value list is a placeholder: rank N is entry N.',
    'Stat codes (inferred): 0 AP, 1 armor, 2 AD, 4 AS, 6 MR, 7 MS, 8 crit chance, 9 crit damage, 12 health, 13 current health, 29 lethality. mStatFormula: 0 total, 1 base, 2 bonus. {a8cb9c14} marks a target stat; {f3cbe7b2} is a reference to another calculation.',
    'Root record (16.20): baseDamageModifiable, damagePerLevelModifiable, attackSpeedModifiable, attackSpeedRatioModifiable, attackSpeedPerLevelModifiable, critDamageMultiplier (2.0 for the five MVP champions; the engine uses a constant 2).',
    'Attack speed ratio is not imported; the engine uses base AS. Vayne is the known exception (bin 0.67, wiki 0.658, base 0.658); left for the per-champion review.',
    'Windup: Root basicAttack.mAttackDelayCastOffsetPercent (windup = 0.3 + offset), or mAttackCastTime / mAttackTotalTime for newer champions (Yunara). mAttackDelayCastOffsetPercentAttackSpeedRatio is the windup modifier (Darius 0.5). Not imported yet.',
    "Missile speed: use the attack spell's mMissileSpec.movementComponent.mSpeed. The top-level missileSpeed field disagrees with the wiki (Veigar 1100 vs 1500, Yunara 2000 vs 2500). Melee attacks have 0.",
    'Vi damagePerLevelModifiable is 3.9; the wiki says 3.5 (16.20). Game data used.',
    '31 Q/W/E/R spells have no usable cooldown (16.20), e.g. Veigar W, Lux Q, Morgana Q, Yunara Q/W; some are passives (Vayne W), others keep it elsewhere. Shown as unknown, pending the per-champion review.',
  ],
};

export const LOL_WIKI: Source & { apiUrl: string; userAgent: string; championDataModule: string } = {
  name: 'League of Legends Wiki (wiki.leagueoflegends.com)',
  apiUrl: 'https://wiki.leagueoflegends.com/en-us/api.php',
  /** The wiki blocks browser-like user agents from scripts; MediaWiki asks for a descriptive one. */
  userAgent: 'LoL-Build-Tester/0.1 (wiki source check)',
  /** Per-champion stats and the last-changed patch. */
  championDataModule: 'Module:ChampionData/data',
  provides: [
    'Mechanics the game data lacks (damage types, what crits, conditions), per page in src/engine/champions/wiki-sources.json',
    'Module:ChampionData/data: base stats, as_ratio, attack_delay_offset, windup_modifier, missile_speed, attack_cast_time/total_time, changes (last-changed patch)',
  ],
  modifications: [],
  notes: [
    'Use this wiki, not leagueoflegends.fandom.com (stale, and it blocks fetches).',
    'Patch names: Data Dragon 16.20.1 = wiki V26.20 (year-based names; inferred from edit summaries).',
    'Read pages through the API (action=parse or query+revisions). Revision IDs pin the text used; `npm run wiki:check` flags changed pages and `changes` values before a refresh.',
    'Values are often rounded (Vayne as_ratio 0.658 vs game 0.67; an edit correcting it was reverted for that reason). Game data wins on mismatches unless noted.',
    "Crits are 200% again since V26.01 (were 175% from V10.23). Sundered Sky's crit became 80% of crit damage in the same patch.",
    'The attack speed cap is 1/0.333 (≈3.003).',
  ],
};

export const SOURCES: Record<string, Source> = { dataDragon: DATA_DRAGON, communityDragon: COMMUNITY_DRAGON, wiki: LOL_WIKI };
