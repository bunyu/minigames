import { BalloonJoustScene, balloonJoustMeta } from './balloon-joust/BalloonJoustScene';
import { BombTagScene, bombTagMeta } from './bomb-tag/BombTagScene';
import { ChairDashScene, chairDashMeta } from './chair-dash/ChairDashScene';
import { FruitSlashScene, fruitSlashMeta } from './fruit-slash/FruitSlashScene';
import { GemMinerScene, gemMinerMeta } from './gem-miner/GemMinerScene';
import { HoopShotScene, hoopShotMeta } from './hoop-shot/HoopShotScene';
import { LavaFloorScene, lavaFloorMeta } from './lava-floor/LavaFloorScene';
import { SpikeClimbScene, spikeClimbMeta } from './spike-climb/SpikeClimbScene';
import { BumperSoccerScene, bumperSoccerMeta } from './bumper-soccer/BumperSoccerScene';
import { CoinGrabScene, coinGrabMeta } from './coin-grab/CoinGrabScene';
import { KartRallyScene, kartRallyMeta } from './kart-rally/KartRallyScene';
import { KingOfTheHillScene, kingOfTheHillMeta } from './king-of-the-hill/KingOfTheHillScene';
import { LaserJumpScene, laserJumpMeta } from './laser-jump/LaserJumpScene';
import { LightTrailsScene, lightTrailsMeta } from './light-trails/LightTrailsScene';
import { MeteorDodgeScene, meteorDodgeMeta } from './meteor-dodge/MeteorDodgeScene';
import { PingSquareScene, pingSquareMeta } from './ping-square/PingSquareScene';
import { ShowdownScene, showdownMeta } from './showdown/ShowdownScene';
import { SnowballFightScene, snowballFightMeta } from './snowball-fight/SnowballFightScene';
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
  { meta: bumperSoccerMeta, scene: BumperSoccerScene },
  { meta: pingSquareMeta, scene: PingSquareScene },
  { meta: snowballFightMeta, scene: SnowballFightScene },
  { meta: coinGrabMeta, scene: CoinGrabScene },
  { meta: kartRallyMeta, scene: KartRallyScene },
  { meta: kingOfTheHillMeta, scene: KingOfTheHillScene },
  { meta: showdownMeta, scene: ShowdownScene },
  { meta: lavaFloorMeta, scene: LavaFloorScene },
  { meta: fruitSlashMeta, scene: FruitSlashScene },
  { meta: balloonJoustMeta, scene: BalloonJoustScene },
  { meta: gemMinerMeta, scene: GemMinerScene },
  { meta: spikeClimbMeta, scene: SpikeClimbScene },
  { meta: hoopShotMeta, scene: HoopShotScene },
  { meta: chairDashMeta, scene: ChairDashScene },
];

export function gameMeta(id: string): GameMeta {
  const g = GAMES.find((e) => e.meta.id === id);
  if (!g) throw new Error(`Unknown game ${id}`);
  return g.meta;
}

export function gamesFor(players: number): GameEntry[] {
  return GAMES.filter((g) => players >= g.meta.minPlayers && players <= g.meta.maxPlayers);
}
