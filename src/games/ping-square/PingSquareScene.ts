import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { label } from '../../engine/character';
import type { GameMeta } from '../types';

export const pingSquareMeta: GameMeta = {
  id: 'ping-square',
  title: 'Ping Square',
  icon: '🏓',
  controls: 'drag',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: "Slide your finger in your area to move your paddle. Don't let a ball past your side! 3 misses and you are out.",
  gesture: 'drag',
  tips: ['👆 Slide your paddle', '🏓 Hit the balls back', '❤️ 3 misses = out'],
  background: '#0d1b2a',
};

const MAX_ANGLE = 0.95; // radians from vertical after a paddle hit

interface Side {
  seat: number;
  side: 'bottom' | 'top';
  x1: number;
  x2: number;
  edgeY: number;
  paddleY: number;
  width: number;
  x: number;
  targetX: number;
  lives: number;
  alive: boolean;
  outAt: number;
  paddle: Phaser.GameObjects.Rectangle;
  line: Phaser.GameObjects.Rectangle;
  livesText: Phaser.GameObjects.Text;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wait: number;
  dot: Phaser.GameObjects.Arc;
}

export class PingSquareScene extends BaseGameScene {
  private sides: Side[] = [];
  private balls: Ball[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private ballR = 0;
  private paddleH = 0;
  private touches = new Map<number, number>(); // pointer id → seat

  constructor() {
    super(pingSquareMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const { width, height } = this.scale;
    const m = u * 0.03;
    const a = (this.arena = new Phaser.Geom.Rectangle(m, m, width - m * 2, height - m * 2));
    this.ballR = u * 0.016;
    this.paddleH = u * 0.024;
    this.balls = [];
    this.touches.clear();

    const g = this.add.graphics();
    g.fillStyle(0x1b263b, 1).fillRect(a.x, a.y, a.width, a.height);
    g.lineStyle(u * 0.012, 0xe0e1dd, 1).lineBetween(a.x, a.y, a.x, a.bottom).lineBetween(a.right, a.y, a.right, a.bottom);
    g.lineStyle(u * 0.004, 0x415a77, 1).lineBetween(a.x, a.centerY, a.right, a.centerY);

    this.sides = this.players.map((p, i) => {
      const z = this.zones[i];
      const x1 = Math.max(a.x, z.x) + (z.x > a.x ? u * 0.004 : 0);
      const x2 = Math.min(a.right, z.x + z.w) - (z.x + z.w < a.right ? u * 0.004 : 0);
      const edgeY = z.side === 'bottom' ? a.bottom : a.y;
      const paddleY = z.side === 'bottom' ? edgeY - u * 0.06 : edgeY + u * 0.06;
      const w = (x2 - x1) * 0.3 * (1 + p.handicap * 1.5);
      const mid = (x1 + x2) / 2;
      const line = this.add.rectangle(mid, edgeY, x2 - x1, u * 0.01, p.color, 0.9);
      const paddle = this.add.rectangle(mid, paddleY, w, this.paddleH, p.color).setStrokeStyle(3, 0xffffff).setDepth(5);
      const c = this.zoneContainer(i).setDepth(50);
      const livesText = label(this, -z.w / 2 + u * 0.1, z.h / 2 - u * 0.13, '❤️❤️❤️', u * 0.032);
      c.add(livesText);
      return {
        seat: i, side: z.side, x1, x2, edgeY, paddleY, width: w, x: mid, targetX: mid,
        lives: 3, alive: true, outAt: 0, paddle, line, livesText,
      };
    });

    // Drag anywhere in your own zone to move your paddle.
    const seatAt = (x: number, y: number) => this.zones.findIndex((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
    const onDown = (p: Phaser.Input.Pointer) => {
      const seat = seatAt(p.x, p.y);
      if (seat < 0) return;
      this.touches.set(p.id, seat);
      this.sides[seat].targetX = p.x;
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      const seat = this.touches.get(p.id);
      if (seat !== undefined && p.isDown) this.sides[seat].targetX = p.x;
    };
    const onUp = (p: Phaser.Input.Pointer) => this.touches.delete(p.id);
    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', onUp);
    });
  }

  protected startGame(): void {
    this.addBall(0.3);
  }

  private addBall(wait: number): void {
    const a = this.arena;
    const dot = this.add.circle(a.centerX, a.centerY, this.ballR, 0xffffff).setDepth(10);
    const ball: Ball = { x: a.centerX, y: a.centerY, vx: 0, vy: 0, wait, dot };
    this.serve(ball);
    ball.wait = wait;
    this.balls.push(ball);
  }

  /** Put the ball in the middle, aimed at a random living player's side. */
  private serve(b: Ball): void {
    const a = this.arena;
    b.x = a.centerX;
    b.y = a.centerY;
    b.wait = 1;
    const targets = this.sides.filter((s) => s.alive);
    const t = Phaser.Utils.Array.GetRandom(targets);
    const ang = Math.atan2(t.edgeY - b.y, (t.x1 + t.x2) / 2 - b.x) + (Math.random() - 0.5) * 0.4;
    const speed = this.unit * (0.45 + Math.min(0.25, this.elapsed * 0.004));
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    this.limitAngle(b, Math.hypot(b.vx, b.vy));
    b.dot.setPosition(b.x, b.y);
  }

  private limitAngle(b: Ball, speed: number): void {
    // Keep balls mostly vertical so they don't bounce between the side walls forever.
    const ang = Math.atan2(b.vx, Math.abs(b.vy));
    const clamped = Phaser.Math.Clamp(ang, -MAX_ANGLE, MAX_ANGLE);
    const dirY = b.vy >= 0 ? 1 : -1;
    b.vx = Math.sin(clamped) * speed;
    b.vy = Math.cos(clamped) * speed * dirY;
  }

  protected tick(dt: number): void {
    if ((this.elapsed > 12 && this.balls.length === 1) || (this.elapsed > 28 && this.balls.length === 2)) {
      this.addBall(0.5);
      this.toast('🏓 Another ball!');
    }
    for (const s of this.sides) {
      if (!s.alive) continue;
      const half = s.width / 2;
      s.x = Phaser.Math.Clamp(s.targetX, s.x1 + half, s.x2 - half);
      s.paddle.setX(s.x);
    }

    const a = this.arena;
    const r = this.ballR;
    for (const b of this.balls) {
      if (b.wait > 0) {
        b.wait -= dt;
        b.dot.setAlpha(0.4);
        continue;
      }
      b.dot.setAlpha(1);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x - r < a.x) {
        b.x = a.x + r;
        b.vx = Math.abs(b.vx);
      } else if (b.x + r > a.right) {
        b.x = a.right - r;
        b.vx = -Math.abs(b.vx);
      }
      for (const s of this.sides) {
        if (!s.alive) continue;
        const towards = s.side === 'bottom' ? b.vy > 0 : b.vy < 0;
        const half = s.width / 2;
        const hitY = Math.abs(b.y - s.paddleY) < r + this.paddleH / 2;
        if (towards && hitY && b.x > s.x - half - r && b.x < s.x + half + r) {
          const rel = Phaser.Math.Clamp((b.x - s.x) / half, -1, 1);
          const speed = Math.min(this.unit * 1.3, Math.hypot(b.vx, b.vy) * 1.05);
          const ang = rel * MAX_ANGLE;
          b.vx = Math.sin(ang) * speed;
          b.vy = Math.cos(ang) * speed * (s.side === 'bottom' ? -1 : 1);
          b.y = s.paddleY + (s.side === 'bottom' ? -1 : 1) * (r + this.paddleH / 2);
          sfx('bounce');
          this.tweens.add({ targets: s.paddle, scaleY: { from: 1.8, to: 1 }, duration: 120 });
        }
      }
      for (const side of ['bottom', 'top'] as const) {
        const past = side === 'bottom' ? b.y - r > a.bottom : b.y + r < a.y;
        const touching = side === 'bottom' ? b.y + r > a.bottom : b.y - r < a.y;
        if (!touching) continue;
        const owner = this.sides.find((s) => s.alive && s.side === side && b.x >= s.x1 && b.x <= s.x2);
        if (!owner) {
          // Wall where nobody (or an eliminated player) defends.
          b.y = side === 'bottom' ? a.bottom - r : a.y + r;
          b.vy = side === 'bottom' ? -Math.abs(b.vy) : Math.abs(b.vy);
        } else if (past) {
          this.miss(owner);
          this.serve(b);
        }
      }
      b.dot.setPosition(b.x, b.y);
    }

    if (this.sides.filter((s) => s.alive).length <= 1) this.end();
  }

  private miss(s: Side): void {
    s.lives--;
    sfx('out');
    s.livesText.setText('❤️'.repeat(Math.max(0, s.lives)));
    this.cameras.main.shake(120, 0.005);
    this.tweens.add({ targets: s.line, alpha: { from: 0.1, to: 0.9 }, duration: 120, repeat: 2 });
    if (s.lives <= 0) {
      s.alive = false;
      s.outAt = this.elapsed;
      s.paddle.setVisible(false);
      s.line.setFillStyle(0xe0e1dd, 1);
      this.toast('❌ Out! Your side is a wall now', [s.seat], 1600);
    } else {
      this.toast('😬 Missed!', [s.seat], 800);
    }
  }

  private end(): void {
    const scores = this.sides.map((s) => (s.alive ? 1000 + s.lives : s.outAt));
    const stats = this.sides.map((s) => (s.alive ? `${s.lives} ❤️ left` : `out after ${s.outAt.toFixed(0)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
