/**
 * Data pipeline: fetches League data for a patch and writes normalized JSON to public/data/<version>/.
 *
 *   npm run data              # latest patch
 *   npm run data -- 16.19.1   # a specific Data Dragon version
 *
 * Sources
 *   - Data Dragon: champion base stats, items, runes (official Riot static data)
 *   - CommunityDragon: per-champion game .bin data, which holds the actual spell
 *     values (DataValues) and formulas (SpellCalculations). Data Dragon tooltips no
 *     longer carry usable ability numbers.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseItemDescriptionStats, toStatBonuses } from './item-stats.ts';

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const CDRAGON = 'https://raw.communitydragon.org';
const LOCALE = 'en_US';
const CONCURRENCY = 8;
const OUT_ROOT = path.resolve('public/data');

async function getJson<T>(url: string, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    if (attempt >= retries || res.status === 404) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

/** "16.19.1" -> "16.19", the patch format CommunityDragon uses. */
function cdragonPatch(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}

// ---- Data Dragon shapes (only the fields we use) ----
interface DDChampionSummary {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  partype: string;
  image: { full: string };
  stats: Record<string, number>;
}
interface DDItem {
  name: string;
  description: string;
  plaintext: string;
  gold: { total: number; purchasable: boolean };
  maps: Record<string, boolean>;
  stats: Record<string, number>;
  tags: string[];
  into?: string[];
  from?: string[];
  inStore?: boolean;
  requiredChampion?: string;
  requiredAlly?: string;
  image: { full: string };
}

// ---- CommunityDragon bin shapes (loose; the format is not officially documented) ----
interface BinDataValue {
  mName: string;
  mValues?: number[];
}
interface BinSpellObject {
  __type?: string;
  mScriptName?: string;
  mSpell?: {
    DataValues?: BinDataValue[];
    mDataValues?: BinDataValue[];
    mSpellCalculations?: Record<string, unknown>;
    cooldownTime?: number[];
    mana?: number[];
    castRange?: number[];
  };
}

const SUMMONERS_RIFT = '11';

async function buildChampions(version: string) {
  const { data } = await getJson<{ data: Record<string, DDChampionSummary> }>(
    `${DDRAGON}/cdn/${version}/data/${LOCALE}/champion.json`,
  );
  const champions = Object.values(data)
    .map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      title: c.title,
      tags: c.tags,
      resource: c.partype,
      icon: `${DDRAGON}/cdn/${version}/img/champion/${c.image.full}`,
      stats: c.stats,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return champions;
}

/**
 * Pull each champion's spell DataValues + SpellCalculations from CommunityDragon.
 * Stored mostly raw for now; turning SpellCalculations into our DamageComponent
 * model is the next milestone (see ROADMAP.md).
 */
async function buildSpells(version: string, championIds: string[], outDir: string) {
  const patch = cdragonPatch(version);
  const failures: string[] = [];

  await mapLimit(championIds, CONCURRENCY, async (id) => {
    const alias = id.toLowerCase();
    const url = `${CDRAGON}/${patch}/game/data/characters/${alias}/${alias}.bin.json`;
    let bin: Record<string, BinSpellObject>;
    try {
      bin = await getJson(url);
    } catch (err) {
      // Fall back to "latest" in case CommunityDragon hasn't published this patch's folder yet.
      try {
        bin = await getJson(url.replace(`/${patch}/`, '/latest/'));
      } catch {
        failures.push(`${id}: ${(err as Error).message}`);
        return;
      }
    }

    const spells: Record<string, unknown> = {};
    for (const [binPath, obj] of Object.entries(bin)) {
      const spell = obj?.mSpell;
      if (!spell) continue;
      const dataValues = spell.DataValues ?? spell.mDataValues ?? [];
      if (dataValues.length === 0 && !spell.mSpellCalculations) continue;
      spells[obj.mScriptName ?? binPath] = {
        path: binPath,
        cooldown: spell.cooldownTime,
        cost: spell.mana,
        range: spell.castRange,
        dataValues: Object.fromEntries(dataValues.map((d) => [d.mName, d.mValues ?? []])),
        calculations: spell.mSpellCalculations ?? {},
      };
    }
    await writeJson(path.join(outDir, 'spells', `${id}.json`), spells);
  });

  return failures;
}

async function buildItems(version: string) {
  const { data } = await getJson<{ data: Record<string, DDItem> }>(
    `${DDRAGON}/cdn/${version}/data/${LOCALE}/item.json`,
  );
  return Object.entries(data)
    .filter(([, item]) => item.maps?.[SUMMONERS_RIFT] && item.gold?.purchasable && item.inStore !== false)
    .filter(([, item]) => !item.requiredChampion && !item.requiredAlly)
    .map(([id, item]) => {
      const textStats = parseItemDescriptionStats(item.description);
      return {
        id,
        name: item.name,
        plaintext: item.plaintext,
        gold: item.gold.total,
        tags: item.tags,
        from: item.from ?? [],
        into: item.into ?? [],
        icon: `${DDRAGON}/cdn/${version}/img/item/${item.image.full}`,
        stats: toStatBonuses(item.stats, textStats),
        // Kept so passives can be modeled (and audited) later.
        description: item.description,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function buildRunes(version: string) {
  return getJson<unknown>(`${DDRAGON}/cdn/${version}/data/${LOCALE}/runesReforged.json`);
}

async function main() {
  const requested = process.argv[2];
  const versions = await getJson<string[]>(`${DDRAGON}/api/versions.json`);
  const version = requested ?? versions[0];
  if (!versions.includes(version)) {
    throw new Error(`Unknown Data Dragon version "${version}". Latest is ${versions[0]}.`);
  }

  const outDir = path.join(OUT_ROOT, version);
  console.log(`Building data for ${version} -> ${path.relative(process.cwd(), outDir)}`);

  const [champions, items, runes] = await Promise.all([
    buildChampions(version),
    buildItems(version),
    buildRunes(version),
  ]);
  await writeJson(path.join(outDir, 'champions.json'), champions);
  await writeJson(path.join(outDir, 'items.json'), items);
  await writeJson(path.join(outDir, 'runes.json'), runes);
  console.log(`  ${champions.length} champions, ${items.length} items`);

  const failures = await buildSpells(version, champions.map((c) => c.id), outDir);
  console.log(`  spells: ${champions.length - failures.length}/${champions.length} champions`);
  for (const f of failures) console.warn(`  ! ${f}`);

  await writeJson(path.join(OUT_ROOT, 'manifest.json'), {
    latest: version,
    generatedAt: new Date().toISOString(),
  });
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
