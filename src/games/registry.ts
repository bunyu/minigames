import { BombTagScene, bombTagMeta } from './bomb-tag/BombTagScene';
import { LaserJumpScene, laserJumpMeta } from './laser-jump/LaserJumpScene';
import { LightTrailsScene, lightTrailsMeta } from './light-trails/LightTrailsScene';
import { MeteorDodgeScene, meteorDodgeMeta } from './meteor-dodge/MeteorDodgeScene';
import { SumoBumpScene, sumoBumpMeta } from './sumo-bump/SumoBumpScene';
import { TankTwirlScene, tankTwirlMeta } from './tank-twirl/TankTwirlScene';
import type { GameEntry, GameMeta } from './types';

/** Every playable game. Adding a game = new folder + one line here. */
export const GAMES: readonly GameEntry[] = [
  { meta: sumoBumpMeta, scene: SumoBumpScene },
  { meta: lightTrailsMeta, scene: LightTrailsScene },
  { meta: tankTwirlMeta, scene: TankTwirlScene },
  { meta: meteorDodgeMeta, scene: MeteorDodgeScene },
  { meta: laserJumpMeta, scene: LaserJumpScene },
  { meta: bombTagMeta, scene: BombTagScene },
];

export function gameMeta(id: string): GameMeta {
  const g = GAMES.find((e) => e.meta.id === id);
  if (!g) throw new Error(`Unknown game ${id}`);
  return g.meta;
}

export function gamesFor(players: number): GameEntry[] {
  return GAMES.filter((g) => players >= g.meta.minPlayers && players <= g.meta.maxPlayers);
}
