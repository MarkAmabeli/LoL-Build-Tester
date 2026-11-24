/**
 * Checks the wiki pages recorded in src/engine/champions/wiki-sources.json against the
 * live wiki, so wiki-derived mechanics get reviewed before data for a new patch is used.
 *
 *   npm run wiki:check
 *
 * Flags (exit code 1):
 *   - a page has a newer revision than the one recorded
 *   - a champion's `changes` patch differs from the recorded one
 *   - the wiki's `changes` patch is newer than our data's patch (the wiki is ahead)
 * Needs network access, so it isn't part of `npm test`.
 */
import { readFile } from 'node:fs/promises';
import { LOL_WIKI } from './sources.ts';
import { compareWikiPatch, dataPatchToWiki, parseChampionChanges, type WikiSources } from './wiki-sources.ts';

const API = LOL_WIKI.apiUrl;
const HEADERS = { 'User-Agent': LOL_WIKI.userAgent, Accept: 'application/json' };

interface Revision {
  revid: number;
  timestamp: string;
  comment?: string;
  slots?: { main: { '*': string } };
}

async function latestRevisions(titles: string[], withContent = false): Promise<Map<string, Revision>> {
  const out = new Map<string, Revision>();
  for (let i = 0; i < titles.length; i += 40) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'revisions',
      rvprop: withContent ? 'ids|timestamp|comment|content' : 'ids|timestamp|comment',
      rvslots: 'main',
      format: 'json',
      titles: titles.slice(i, i + 40).join('|'),
    });
    const res = await fetch(`${API}?${params}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} from the wiki API`);
    const body = (await res.json()) as {
      query: { normalized?: Array<{ from: string; to: string }>; pages: Record<string, { title: string; revisions?: Revision[] }> };
    };
    const original = new Map((body.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(body.query.pages)) {
      if (page.revisions?.[0]) out.set(original.get(page.title) ?? page.title, page.revisions[0]);
    }
  }
  return out;
}

async function main() {
  const sources = JSON.parse(await readFile('src/engine/champions/wiki-sources.json', 'utf8')) as WikiSources;
  const { latest } = JSON.parse(await readFile('public/data/manifest.json', 'utf8')) as { latest: string };
  const dataPatch = dataPatchToWiki(latest);

  const module = (await latestRevisions([LOL_WIKI.championDataModule], true)).get(LOL_WIKI.championDataModule);
  if (!module?.slots) throw new Error(`Could not read ${LOL_WIKI.championDataModule}`);
  const changes = parseChampionChanges(module.slots.main['*']);
  console.log(`Data patch ${latest} (wiki ${dataPatch}); Module:ChampionData/data last edited ${module.timestamp} "${module.comment ?? ''}"`);

  const general = sources.pages ?? [];
  const titles = [...Object.values(sources.champions).flatMap((c) => c.pages.map((p) => p.page)), ...general.map((p) => p.page)];
  const revisions = await latestRevisions(titles);
  const problems: string[] = [];

  for (const [champion, entry] of Object.entries(sources.champions)) {
    const now = changes.get(champion);
    if (!now) problems.push(`${champion}: not found in Module:ChampionData/data`);
    else {
      if (now !== entry.changes) problems.push(`${champion}: changes is now ${now} (recorded ${entry.changes})`);
      if (compareWikiPatch(now, dataPatch) > 0) problems.push(`${champion}: wiki is ahead of our data (${now} > ${dataPatch})`);
    }
    for (const page of entry.pages) {
      const rev = revisions.get(page.page);
      if (!rev) problems.push(`${page.page}: page not found`);
      else if (rev.revid !== page.revision) {
        problems.push(`${page.page}: revision ${rev.revid} (${rev.timestamp} "${rev.comment ?? ''}"), recorded ${page.revision}`);
      }
    }
  }

  for (const page of general) {
    const rev = revisions.get(page.page);
    if (!rev) problems.push(`${page.page}: page not found`);
    else if (rev.revid !== page.revision) {
      problems.push(`${page.page}: revision ${rev.revid} (${rev.timestamp} "${rev.comment ?? ''}"), recorded ${page.revision}`);
    }
  }

  if (problems.length === 0) {
    console.log(`All ${titles.length} pages and ${Object.keys(sources.champions).length} champions match the recorded sources.`);
    return;
  }
  console.log(`${problems.length} to review:`);
  for (const p of problems) console.log(`  ! ${p}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
