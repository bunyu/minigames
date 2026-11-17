import Phaser from 'phaser';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import type { GameMeta } from '../types';

export const lightTrailsMeta: GameMeta = {
  id: 'light-trails',
  title: 'Light Trails',
  icon: '🏍️',
  controls: 'L/R',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 45,
  howToPlay: 'Steer with ◀ and ▶. Do not hit the walls or any light trail. Last rider wins!',
  background: '#10002b',
};

// Directions: 0 up, 1 right, 2 down, 3 left (screen space).
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

interface Bike {
  seat: number;
  col: number;
  row: number;
  dir: number;
  turns: number[];
  alive: boolean;
  diedAtStep: number;
  trail: Phaser.GameObjects.Graphics;
  head: Phaser.GameObjects.Container;
  left: TouchButton;
  right: TouchButton;
}

export class LightTrailsScene extends BaseGameScene {
  private bikes: Bike[] = [];
  private grid!: Uint8Array;
  private cols = 0;
  private rows = 0;
  private cell = 0;
  private ox = 0;
  private oy = 0;
  private stepCount = 0;
  private acc = 0;

  constructor() {
    super(lightTrailsMeta.id);
  }

  protected buildGame(): void {
    const { width, height } = this.scale;
    const u = this.unit;
    this.cell = Math.max(6, Math.floor(u / 70));
    this.cols = Math.floor((width * 0.98) / this.cell);
    this.rows = Math.floor((height * 0.62) / this.cell);
    this.ox = Math.floor((width - this.cols * this.cell) / 2);
    this.oy = Math.floor((height - this.rows * this.cell) / 2);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.stepCount = 0;
    this.acc = 0;

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.55).fillRect(this.ox, this.oy, this.cols * this.cell, this.rows * this.cell);
    g.lineStyle(1, 0x3c096c, 0.6);
    for (let c = 0; c <= this.cols; c += 5) g.lineBetween(this.ox + c * this.cell, this.oy, this.ox + c * this.cell, this.oy + this.rows * this.cell);
    for (let r = 0; r <= this.rows; r += 5) g.lineBetween(this.ox, this.oy + r * this.cell, this.ox + this.cols * this.cell, this.oy + r * this.cell);
    g.lineStyle(Math.max(3, this.cell * 0.4), 0xe0aaff, 1).strokeRect(this.ox, this.oy, this.cols * this.cell, this.rows * this.cell);

    this.bikes = this.players.map((p, i) => {
      const z = this.zones[i];
      // Bottom players start low heading up, top players start high heading down,
      // shifted sideways so nobody starts head-on.
      const x = z.side === 'bottom' ? z.cx - z.w * 0.15 : z.cx + z.w * 0.15;
      const col = Phaser.Math.Clamp(Math.floor((x - this.ox) / this.cell), 1, this.cols - 2);
      const row = z.side === 'bottom' ? this.rows - 3 : 2;
      const trail = this.add.graphics().setDepth(5);
      trail.fillStyle(p.color, 1);
      const head = addCharacter(this, 0, 0, p, this.cell * 3.2).setDepth(10);

      const c = this.zoneContainer(i).setDepth(50);
      const r = u * 0.075;
      const y = z.h / 2 - r - u * 0.02;
      const bx = Math.min(z.w / 2 - r - u * 0.03, r * 3.2);
      const left = new TouchButton(this, c, -bx, y, r, p.color, '◀', 0.9);
      const right = new TouchButton(this, c, bx, y, r, p.color, '▶', 0.9);
      const bike: Bike = { seat: i, col, row, dir: z.side === 'bottom' ? 0 : 2, turns: [], alive: true, diedAtStep: 0, trail, head, left, right };
      left.onPress = () => this.queueTurn(bike, -1);
      right.onPress = () => this.queueTurn(bike, 1);
      this.occupy(bike);
      return bike;
    });
  }

  protected startGame(): void {}

  private queueTurn(b: Bike, delta: number): void {
    if (!this.playing || !b.alive || b.turns.length >= 2) return;
    b.turns.push(delta);
  }

  private occupy(b: Bike): void {
    this.grid[b.row * this.cols + b.col] = b.seat + 1;
    b.trail.fillRect(this.ox + b.col * this.cell, this.oy + b.row * this.cell, this.cell, this.cell);
    b.head.setPosition(this.ox + (b.col + 0.5) * this.cell, this.oy + (b.row + 0.5) * this.cell);
  }

  protected tick(dt: number): void {
    // Speeds up over time: 12 → 28 cells per second.
    const interval = Math.max(0.036, 0.085 - this.elapsed * 0.0011);
    this.acc += dt;
    while (this.acc >= interval && this.playing) {
      this.acc -= interval;
      this.step();
    }
  }

  private step(): void {
    this.stepCount++;
    const alive = this.bikes.filter((b) => b.alive);
    const next = alive.map((b) => {
      const turn = b.turns.shift();
      if (turn !== undefined) b.dir = (b.dir + turn + 4) % 4;
      return { b, col: b.col + DX[b.dir], row: b.row + DY[b.dir] };
    });
    const crashed = new Set<Bike>();
    for (const n of next) {
      const outside = n.col < 0 || n.row < 0 || n.col >= this.cols || n.row >= this.rows;
      if (outside || this.grid[n.row * this.cols + n.col] !== 0) crashed.add(n.b);
      // Two bikes entering the same cell crash together.
      if (next.some((o) => o !== n && o.col === n.col && o.row === n.row)) crashed.add(n.b);
    }
    for (const n of next) {
      if (crashed.has(n.b)) continue;
      n.b.col = n.col;
      n.b.row = n.row;
      this.occupy(n.b);
    }
    crashed.forEach((b) => this.crash(b));

    if (this.bikes.filter((b) => b.alive).length <= 1) this.end();
  }

  private crash(b: Bike): void {
    b.alive = false;
    b.diedAtStep = this.stepCount;
    b.left.setEnabled(false);
    b.right.setEnabled(false);
    const boom = this.add.circle(b.head.x, b.head.y, this.cell, 0xffffff).setDepth(20);
    this.tweens.add({ targets: boom, radius: this.cell * 6, alpha: 0, duration: 450, onComplete: () => boom.destroy() });
    this.tweens.add({ targets: b.head, alpha: 0.35, duration: 300 });
    this.cameras.main.shake(120, 0.006);
    this.toast('💥 Crash!', [b.seat]);
  }

  private end(): void {
    const scores = this.bikes.map((b) => (b.alive ? Number.MAX_SAFE_INTEGER : b.diedAtStep));
    const seconds = (step: number) => ((step / this.stepCount) * this.elapsed).toFixed(1);
    const stats = this.bikes.map((b) => (b.alive ? 'last rider' : `crashed after ${seconds(b.diedAtStep)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
