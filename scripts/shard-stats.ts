import type { StatShard } from '../src/engine/types.ts';

type ParsedShard = Pick<StatShard, 'stats' | 'scaling' | 'unmodeled'>;

const NUM = String.raw`(\d+(?:\.\d+)?)`;

/**
 * Stat shard values only exist in CommunityDragon's perk description text,
 * e.g. "+9 <lol-uikit-tooltipped-keyword ...>Adaptive Force</...>" or "+10-180 Health (based on level)".
 * Anything that doesn't match a known pattern is returned in `unmodeled`, so a
 * new or reworded shard shows up as a pipeline warning instead of silently becoming 0.
 */
const PATTERNS: Array<[RegExp, (m: RegExpExecArray) => ParsedShard]> = [
  [new RegExp(String.raw`^\+?${NUM}\s*-\s*${NUM} Health \(based on level\)$`, 'i'),
    (m) => ({ stats: {}, scaling: [{ stat: 'hp', from: Number(m[1]), to: Number(m[2]) }] })],
  [new RegExp(String.raw`^\+?${NUM} Health$`, 'i'), (m) => ({ stats: { hp: Number(m[1]) } })],
  [new RegExp(String.raw`^\+?${NUM} Adaptive Force$`, 'i'), (m) => ({ stats: { adaptiveForce: Number(m[1]) } })],
  [new RegExp(String.raw`^\+?${NUM}% Attack Speed$`, 'i'), (m) => ({ stats: { attackSpeedPct: Number(m[1]) } })],
  [new RegExp(String.raw`^\+?${NUM} Ability Haste$`, 'i'), (m) => ({ stats: { abilityHaste: Number(m[1]) } })],
  [new RegExp(String.raw`^\+?${NUM}% Move Speed$`, 'i'), (m) => ({ stats: { moveSpeedPct: Number(m[1]) / 100 } })],
];

export function cleanText(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function parseShardText(html: string): ParsedShard {
  const text = cleanText(html);
  for (const [re, build] of PATTERNS) {
    const m = re.exec(text);
    if (m) return build(m);
  }
  return { stats: {}, unmodeled: [text] };
}
