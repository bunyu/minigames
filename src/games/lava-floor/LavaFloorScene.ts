import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter } from '../../engine/character';
import type { TouchButton } from '../../engine/controls';
import type { Joystick } from '../../engine/joystick';
import { collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const lavaFloorMeta: GameMeta = {
  id: 'lava-floor',
  title: 'Lava Floor',
  icon: '🌋',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Floor tiles crack and fall into the lava! Keep moving, tap JUMP to hop over gaps, and push the others in.',
  gesture: 'joystick-button',
  tips: ['🕹️ Keep moving', '👆 JUMP over lava', '🔥 Lava = out'],
  background: '#370617',
};

const TIME_LIMIT = 120;
const AIR = 0.55;
const JUMP_COOLDOWN = 1;
const CRACK_TIME = 1.1;

interface Tile {
  state: 0 | 1 | 2; // solid, cracking, lava
  t: number;
  view: Phaser.GameObjects.Rectangle;
}

interface Hopper extends Body {
  seat: number;
  alive: boolean;
  outAt: number;
  air: number;
  cooldown: number;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
  button: TouchButton;
}

export class LavaFloorScene extends BaseGameScene {
  private tiles: Tile[] = [];
  private cols = 0;
  private rows = 0;
  private tile = 0;
  private hoppers: Hopper[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private crackIn = 0;
  private waveIn = 0;

  constructor() {
    super(lavaFloorMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const a = (this.arena = this.drawArena(0xff4800, 0xffba08));
    this.cols = 10;
    this.tile = a.width / this.cols;
    this.rows = Math.max(4, Math.round(a.height / this.tile));
    const th = a.height / this.rows;
    this.crackIn = 1.5;
    this.waveIn = 20;
    this.tiles = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const view = this.add
          .rectangle(a.x + c * this.tile + 2, a.y + r * th + 2, this.tile - 4, th - 4, (r + c) % 2 ? 0x6c584c : 0x7f6a5d)
          .setOrigin(0)
          .setDepth(1);
        this.tiles.push({ state: 0, t: 0, view });
      }

    const r = u * 0.034;
    this.hoppers = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.55);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const { joy, button } = this.addJoystickAndButton(i, c, 'JUMP');
      const h: Hopper = { seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1 + p.handicap, alive: true, outAt: 0, air: 0, cooldown: 0, view, joy, button };
      button.onPress = () => this.jump(h);
      return h;
    });
  }

  protected startGame(): void {}

  private tileAt(x: number, y: number): Tile | undefined {
    const a = this.arena;
    const c = Math.floor((x - a.x) / this.tile);
    const r = Math.floor((y - a.y) / (a.height / this.rows));
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return undefined;
    return this.tiles[r * this.cols + c];
  }

  private jump(h: Hopper): void {
    if (!this.playing || !h.alive || h.air > 0 || h.cooldown > 0) return;
    h.air = AIR * (1 + this.players[h.seat].handicap);
    h.cooldown = JUMP_COOLDOWN;
    sfx('tap');
    this.tweens.add({ targets: h.view, scale: 1.4, duration: (h.air * 1000) / 2, yoyo: true, ease: 'Sine.Out' });
  }

  private crack(t: Tile): void {
    if (t.state !== 0) return;
    t.state = 1;
    t.t = CRACK_TIME;
    t.view.setFillStyle(0xe85d04);
    this.tweens.add({ targets: t.view, alpha: { from: 1, to: 0.6 }, yoyo: true, repeat: 4, duration: 110 });
  }

  protected tick(dt: number): void {
    const elapsed = this.elapsed;
    // Random cracks, faster and faster…
    this.crackIn -= dt;
    if (this.crackIn <= 0) {
      const solid = this.tiles.filter((t) => t.state === 0);
      if (solid.length > 4) this.crack(Phaser.Utils.Array.GetRandom(solid));
      this.crackIn = Math.max(0.12, 0.6 - elapsed * 0.009);
    }
    // …plus a whole row or column every few seconds later on.
    this.waveIn -= dt;
    if (this.waveIn <= 0) {
      this.waveIn = 7;
      if (Math.random() < 0.5) {
        const r = Phaser.Math.Between(0, this.rows - 1);
        for (let c = 0; c < this.cols; c++) this.crack(this.tiles[r * this.cols + c]);
      } else {
        const c = Phaser.Math.Between(0, this.cols - 1);
        for (let r = 0; r < this.rows; r++) this.crack(this.tiles[r * this.cols + c]);
      }
      this.toast('⚠️ Watch out!', undefined, 900);
    }
    for (const t of this.tiles) {
      if (t.state !== 1) continue;
      t.t -= dt;
      if (t.t <= 0) {
        t.state = 2;
        this.tweens.killTweensOf(t.view);
        t.view.setAlpha(1).setFillStyle(0xff7b00, 0.25);
      }
    }

    const speed = this.unit * 0.38;
    const alive = this.hoppers.filter((h) => h.alive);
    for (const h of alive) {
      h.cooldown = Math.max(0, h.cooldown - dt);
      h.air = Math.max(0, h.air - dt);
      h.button.setCharge(1 - h.cooldown / JUMP_COOLDOWN);
      steer(h, h.joy.vec.x, h.joy.vec.y, speed, dt, h.air > 0 ? 3 : 10);
      keepInside(h, this.arena, 0.3);
    }
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++)
        // Only players at the same height can bump.
        if ((alive[i].air > 0) === (alive[j].air > 0)) collide(alive[i], alive[j], 1.3);
    for (const h of alive) {
      h.view.setPosition(h.x, h.y);
      if (h.air <= 0 && this.tileAt(h.x, h.y)?.state === 2) this.fall(h);
    }

    if (alive.length <= 1 || elapsed >= TIME_LIMIT) this.end();
  }

  private fall(h: Hopper): void {
    h.alive = false;
    h.outAt = this.elapsed;
    sfx('out');
    h.joy.setEnabled(false);
    h.button.setEnabled(false).setText('OUT');
    this.tweens.add({ targets: h.view, scale: 0.1, alpha: 0, angle: 200, duration: 700 });
    this.toast('🔥 Into the lava!', [h.seat]);
  }

  private end(): void {
    const scores = this.hoppers.map((h) => (h.alive ? 1000 : h.outAt));
    const stats = this.hoppers.map((h) => (h.alive ? 'stayed dry!' : `fell after ${h.outAt.toFixed(0)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
