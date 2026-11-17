import type Phaser from 'phaser';
import type { Look } from '../core/profiles';
import type { Gesture } from '../engine/demo';
import type { Placements } from '../core/scoring';

export type Controls = '1-button' | 'L/R' | 'joystick' | 'drag' | 'swipe';

export interface GameMeta {
  id: string;
  title: string;
  icon: string;
  controls: Controls;
  minPlayers: 2 | 3;
  maxPlayers: 4;
  approxSeconds: number;
  howToPlay: string;
  /** Gesture animated on the intro screen. */
  gesture: Gesture;
  /** 2–3 very short picture tips for kids who don't read yet, e.g. '💣 = out'. */
  tips: string[];
  /** Background colour of the scene. */
  background: string;
}

export interface SeatPlayer extends Look {
  seat: number;
  /** 0 = none. A small advantage for younger players, e.g. 0.15 = +15%. */
  handicap: number;
}

export interface GameResult {
  placements: Placements;
  /** Optional short line per seat, e.g. "survived 42 s". */
  stats?: string[];
}

export interface GameSceneData {
  meta: GameMeta;
  players: SeatPlayer[];
  /** null = players quit the tournament. */
  onFinish: (result: GameResult | null) => void;
}

export interface GameEntry {
  meta: GameMeta;
  scene: new () => Phaser.Scene;
}
