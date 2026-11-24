/** Shapes and helpers for src/engine/champions/wiki-sources.json (see wiki-check.ts). */

export interface WikiPageSource {
  page: string;
  revision: number;
  facts: string[];
  matched: string[];
  conflicts?: string[];
}

export interface WikiSources {
  champions: Record<string, { checkedPatch: string; changes: string; pages: WikiPageSource[] }>;
  /** General pages (not one champion's) used by hand-entered engine values. */
  pages?: WikiPageSource[];
}

/**
 * Data Dragon "16.20.1" → wiki "V26.20". Riot's year-based patch names put the year in
 * the wiki's major number while Data Dragon kept counting from 15/16 (inferred from the
 * wiki tagging its 16.20.1-week edits [[V26.20]]).
 */
export function dataPatchToWiki(version: string): string {
  const [major, minor] = version.split('.').map(Number);
  return `V${major + 10}.${String(minor).padStart(2, '0')}`;
}

/** Compare wiki patches like "V26.07" and "V26.20": negative, 0 or positive. */
export function compareWikiPatch(a: string, b: string): number {
  const parse = (v: string) => {
    const m = /^V(\d+)\.(\d+)/.exec(v);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  };
  const [am, an] = parse(a);
  const [bm, bn] = parse(b);
  return am - bm || an - bn;
}

/** Champion name → `changes` value from Module:ChampionData/data's Lua source. */
export function parseChampionChanges(lua: string): Map<string, string> {
  const out = new Map<string, string>();
  const entry = /\["([^"]+)"\]\s*=\s*\{\s*\["id"\]([\s\S]*?)\["changes"\]\s*=\s*"([^"]*)"/g;
  for (const m of lua.matchAll(entry)) out.set(m[1], m[3]);
  return out;
}
