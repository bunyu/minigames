import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, label } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import type { GameMeta } from '../types';

export const spikeClimbMeta: GameMeta = {
  id: 'spike-climb',
  title: 'Spike Climb',
  icon: '🧗',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 50,
  howToPlay: 'Climb up your tower! Tap JUMP to leap to the other wall and dodge the spikes. It gets faster and faster!',
  gesture: 'tap',
  tips: ['👆 Tap = other wall', '📌 Dodge the spikes', '🏆 Last climber wins'],
  background: '#22223b',
};

const TIME_LIMIT = 90;
const JUMP_TIME = 0.17;

interface Spike {
  travelled: number;
  side: -1 | 1;
}

interface Climber {
  seat: number;
  side: -1 | 1;
  jump: number; // seconds left in the current jump
  safe: number; // invulnerable after a hit
  lives: number;
  alive: boolean;
  outAt: number;
  laneW: number;
  y: number;
  view: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  button: TouchButton;
  heightText: Phaser.GameObjects.Text;
}

export class SpikeClimbScene extends BaseGameScene {
  private climbers: Climber[] = [];
  private spikes: Spike[] = [];
  private spawnIn = 0;
  private travel = 0; // total scroll distance, used for the moving bricks

  constructor() {
    super(spikeClimbMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.spikes = [];
    this.spawnIn = 1.8; // a moment to get ready before the first spike
    this.travel = 0;
    this.climbers = this.players.map((p, i) => {
      const z = this.zones[i];
      const c = this.zoneContainer(i).setDepth(5);
      const laneW = Math.min(z.w * 0.45, u * 0.32);
      const gfx = this.add.graphics();
      c.add(gfx);
      const y = z.h * 0.22;
      const size = u * 0.07;
      const view = addCharacter(this, -laneW / 2 + size * 0.75, y, p, size);
      c.add(view);
      const br = u * 0.1;
      const pos = this.outerCorner(i, br);
      const ui = this.zoneContainer(i).setDepth(50);
      const button = new TouchButton(this, ui, pos.x, pos.y, br, p.color, 'JUMP');
      const heightText = label(this, pos.x, pos.y - br - u * 0.045, '0 m', u * 0.04);
      ui.add(heightText);
      const climber: Climber = {
        seat: i, side: -1, jump: 0, safe: 0, lives: 1 + (p.handicap > 0 ? 1 : 0), alive: true, outAt: 0,
        laneW, y, view, gfx, button, heightText,
      };
      button.onPress = () => this.jump(climber);
      return climber;
    });
    this.draw();
  }

  protected startGame(): void {}

  /** Each tower starts a little away from the middle of the screen so the two sides don't merge. */
  private laneTop(seat: number): number {
    return -this.zones[seat].h / 2 + this.unit * 0.05;
  }

  private get speed(): number {
    return this.unit * (0.42 + Math.min(0.6, this.elapsed * 0.012));
  }

  private jump(c: Climber): void {
    if (!this.playing || !c.alive || c.jump > 0) return;
    c.jump = JUMP_TIME;
    sfx('tap');
  }

  protected tick(dt: number): void {
    const sp = this.speed;
    this.travel += sp * dt;
    // One spike at a time, on a random wall: always possible to dodge.
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spikes.push({ travelled: 0, side: Math.random() < 0.5 ? -1 : 1 });
      this.spawnIn = Math.max(0.32, 0.85 - this.elapsed * 0.01) + Math.random() * 0.25;
    }
    for (const s of this.spikes) s.travelled += sp * dt;
    const maxH = Math.max(...this.zones.map((z) => z.h));
    this.spikes = this.spikes.filter((s) => s.travelled < maxH + 100);

    const spikeH = this.unit * 0.06;
    for (const c of this.climbers) {
      if (!c.alive) continue;
      if (c.jump > 0) {
        c.jump -= dt;
        if (c.jump <= 0) c.side = c.side === -1 ? 1 : -1;
      }
      c.heightText.setText(`${Math.floor(this.elapsed * 3)} m`);
      c.safe = Math.max(0, c.safe - dt);
      if (c.jump > 0 || c.safe > 0) continue; // mid-air between the walls, or just hit
      for (const s of this.spikes) {
        const sy = this.laneTop(c.seat) + s.travelled;
        if (s.side === c.side && Math.abs(sy - c.y) < spikeH / 2 + this.unit * 0.022) {
          c.safe = 0.6;
          this.hurt(c);
          break;
        }
      }
    }
    this.draw();

    const alive = this.climbers.filter((c) => c.alive).length;
    if (alive <= 1 || this.elapsed >= TIME_LIMIT) this.end();
  }

  private hurt(c: Climber): void {
    c.lives--;
    this.cameras.main.shake(120, 0.005);
    if (c.lives > 0) {
      sfx('hit');
      this.toast('🩹 Ouch! Last life', [c.seat], 900);
      return;
    }
    sfx('out');
    c.alive = false;
    c.outAt = this.elapsed;
    c.button.setEnabled(false).setText('OUT');
    this.tweens.add({ targets: c.view, y: c.y + this.unit * 0.4, alpha: 0, angle: 180, duration: 700 });
    this.toast('📌 Spiked!', [c.seat]);
  }

  private draw(): void {
    const u = this.unit;
    const spikeH = u * 0.06;
    const wall = u * 0.03;
    for (const c of this.climbers) {
      const z = this.zones[c.seat];
      const g = c.gfx.clear();
      const half = c.laneW / 2;
      const top = this.laneTop(c.seat);
      const len = z.h / 2 - top;
      g.fillStyle(0x4a4e69, 1).fillRect(-half, top, c.laneW, len);
      // Bricks scrolling toward the player = climbing up.
      g.lineStyle(2, 0x22223b, 0.6);
      const gap = u * 0.06;
      const offset = this.travel % gap;
      for (let y = top + offset; y < z.h / 2; y += gap) g.lineBetween(-half, y, half, y);
      g.fillStyle(0x9a8c98, 1).fillRect(-half - wall, top, wall, len).fillRect(half, top, wall, len);
      // Tower top cap.
      g.fillStyle(0xc9ada7, 1).fillRect(-half - wall, top - wall * 0.6, c.laneW + wall * 2, wall * 0.6);
      g.fillStyle(0xf2e9e4, 1);
      for (const s of this.spikes) {
        const y = top + s.travelled;
        if (y > z.h / 2 + spikeH) continue;
        const x = s.side * half;
        g.fillTriangle(x, y - spikeH / 2, x, y + spikeH / 2, x - s.side * u * 0.07, y);
      }
      if (c.alive) {
        const size = u * 0.07;
        const restX = (side: number) => side * (half - size * 0.75);
        const x = c.jump > 0 ? Phaser.Math.Linear(restX(-c.side), restX(c.side), c.jump / JUMP_TIME) : restX(c.side);
        c.view.setPosition(x, c.y);
      }
    }
  }

  private end(): void {
    const scores = this.climbers.map((c) => (c.alive ? 1000 : c.outAt));
    const stats = this.climbers.map((c) => `${Math.floor((c.alive ? this.elapsed : c.outAt) * 3)} m climbed`);
    this.finish(placementsFromScores(scores), stats);
  }
}
