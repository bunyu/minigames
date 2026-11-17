import { LightTrailsScene, lightTrailsMeta } from './light-trails/LightTrailsScene';
import { SumoBumpScene, sumoBumpMeta } from './sumo-bump/SumoBumpScene';
import type { GameEntry, GameMeta } from './types';

/** Every playable game. Adding a game = new folder + one line here. */
export const GAMES: readonly GameEntry[] = [
  { meta: sumoBumpMeta, scene: SumoBumpScene },
  { meta: lightTrailsMeta, scene: LightTrailsScene },
];

export function gameMeta(id: string): GameMeta {
  const g = GAMES.find((e) => e.meta.id === id);
  if (!g) throw new Error(`Unknown game ${id}`);
  return g.meta;
}

export function gamesFor(players: number): GameEntry[] {
  return GAMES.filter((g) => players >= g.meta.minPlayers && players <= g.meta.maxPlayers);
}
