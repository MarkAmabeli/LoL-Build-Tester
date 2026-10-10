import { darius } from './darius';
import { nasus } from './nasus';
import type { ChampionDefinition } from './types';
import { vayne } from './vayne';
import { veigar } from './veigar';
import { yunara } from './yunara';

/** Champions with hand-written ability definitions, by Data Dragon ID. */
export const CHAMPIONS: Record<string, ChampionDefinition> = Object.fromEntries(
  [darius, nasus, vayne, veigar, yunara].map((c) => [c.id, c]),
);

export function getChampion(id: string): ChampionDefinition | undefined {
  return CHAMPIONS[id];
}
