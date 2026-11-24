import { byLevel, sumBonuses } from './stats';
import type { LevelScaledStat, ShardData, StatBonuses, StatShard } from './types';

export function scaledStatAt(s: LevelScaledStat, level: number): number {
  return byLevel(s.from, s.to, level);
}

/** Bonuses from one shard at a level. */
export function shardBonuses(shard: StatShard, level: number): StatBonuses {
  const scaled = (shard.scaling ?? []).map((s) => ({ [s.stat]: scaledStatAt(s, level) }) as StatBonuses);
  return sumBonuses(shard.stats, ...scaled);
}

/**
 * Bonuses from a full shard selection, one ID per row. The same shard can be
 * picked in two rows (e.g. adaptive force in Offense and Flex), so IDs are summed, not de-duplicated.
 * Throws if an ID isn't allowed in its row.
 */
export function shardPageBonuses(data: ShardData, selection: number[], level: number): StatBonuses {
  if (selection.length > data.rows.length) {
    throw new Error(`${selection.length} shards selected, but there are only ${data.rows.length} rows`);
  }
  return sumBonuses(
    ...selection.map((id, i) => {
      const row = data.rows[i];
      const shard = data.shards[id];
      if (!shard || !row.options.includes(id)) {
        throw new Error(`Shard ${id} is not an option in the ${row.label} row`);
      }
      return shardBonuses(shard, level);
    }),
  );
}
