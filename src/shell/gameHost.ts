import Phaser from 'phaser';
import { gameMeta, GAMES } from '../games/registry';
import type { GameResult, GameSceneData, SeatPlayer } from '../games/types';

let game: Phaser.Game | null = null;

/**
 * The Phaser canvas (#game) always fills the screen underneath the DOM shell (#app),
 * so its size is always correct. While a mini game runs, the shell is hidden.
 */
function host(): Phaser.Game {
  if (game) return game;
  const g = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 6 },
    banner: false,
    scene: [],
  });
  for (const entry of GAMES) g.scene.add(entry.meta.id, entry.scene, false);
  // Save battery while the menus are showing.
  g.events.once(Phaser.Core.Events.READY, () => {
    if (!running) g.loop.sleep();
  });
  game = g;
  return g;
}

let running = false;

/** Create the Phaser game early so the first round starts instantly. */
export function initGameHost(): void {
  host();
}

/** Run one mini game full screen and resolve with its result (null = quit). */
export function playGame(gameId: string, players: SeatPlayer[]): Promise<GameResult | null> {
  const g = host();
  const app = document.getElementById('app')!;
  running = true;
  app.hidden = true;
  g.loop.wake();
  return new Promise((resolve) => {
    const data: GameSceneData = {
      meta: gameMeta(gameId),
      players,
      onFinish: (result) => {
        running = false;
        g.loop.sleep();
        app.hidden = false;
        resolve(result);
      },
    };
    g.scene.start(gameId, data);
  });
}
