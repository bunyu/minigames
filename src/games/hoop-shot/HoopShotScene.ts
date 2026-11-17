import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { emoji, label } from '../../engine/character';
import type { GameMeta } from '../types';

export const hoopShotMeta: GameMeta = {
  id: 'hoop-shot',
  title: 'Hoop Shot',
  icon: '🏀',
  controls: 'swipe',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 45,
  howToPlay: 'Put your finger on your ball and flick it toward the moving hoop. Longer flick = longer throw. Far shots score 3!',
  gesture: 'flick',
  tips: ['👆 Flick the ball', '🏀 Into the hoop!', '⭐ Far away = 3 points'],
  background: '#6f1d1b',
};

const TIME_LIMIT = 45;
const FLIGHT = 0.6;
const POWER = 2.7;

interface Shooter {
  seat: number;
  restX: number;
  restY: number;
  state: 'ready' | 'flying' | 'reload';
  t: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  aiming: boolean;
  score: number;
  ball: Phaser.GameObjects.Text;
  aim: Phaser.GameObjects.Graphics;
  scoreText: Phaser.GameObjects.Text;
}

export class HoopShotScene extends BaseGameScene {
  private shooters: Shooter[] = [];
  private hoop = { x: 0, y: 0, r: 0 };
  private hoopGfx!: Phaser.GameObjects.Graphics;
  private updateTimer!: () => void;

  constructor() {
    super(hoopShotMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const { width, height } = this.scale;
    this.updateTimer = this.addTimer(TIME_LIMIT);
    // Court floor.
    const g = this.add.graphics();
    g.fillStyle(0xbc6c25, 1).fillRect(0, 0, width, height);
    g.lineStyle(u * 0.006, 0xffffff, 0.5).strokeCircle(width / 2, height / 2, u * 0.16).lineBetween(0, height / 2, width, height / 2);
    this.hoop = { x: width / 2, y: height / 2, r: u * 0.065 };
    this.hoopGfx = this.add.graphics().setDepth(5);

    this.shooters = this.players.map((p, i) => {
      const z = this.zones[i];
      const rest = this.zonePoint(i, 0, z.h * 0.32);
      const ball = emoji(this, rest.x, rest.y, '🏀', u * 0.07).setDepth(20);
      this.add.circle(rest.x, rest.y, u * 0.06, p.color, 0.35).setStrokeStyle(3, p.color).setDepth(2);
      const aim = this.add.graphics().setDepth(15);
      const hud = this.zoneContainer(i).setDepth(60);
      const scoreText = label(this, -z.w * 0.3, z.h * 0.32, '0', u * 0.07, p.colorCss);
      hud.add(scoreText);
      return {
        seat: i, restX: rest.x, restY: rest.y, state: 'ready' as const, t: 0, fromX: 0, fromY: 0, toX: 0, toY: 0,
        aiming: false, score: 0, ball, aim, scoreText,
      };
    });

    const reach = u * 0.13;
    this.trackTouches({
      down: (seat, p) => {
        const s = this.shooters[seat];
        if (s.state !== 'ready' || Math.hypot(p.x - s.restX, p.y - s.restY) > reach) return false;
        s.aiming = true;
      },
      move: (seat, p) => {
        const s = this.shooters[seat];
        if (!s.aiming) return;
        const t = this.target(s, p.x, p.y);
        s.aim.clear().lineStyle(3, 0xffffff, 0.6);
        // Dotted guide to where the ball will land.
        for (let k = 0; k < 1; k += 0.1) {
          const x = Phaser.Math.Linear(s.restX, t.x, k);
          const y = Phaser.Math.Linear(s.restY, t.y, k);
          s.aim.fillStyle(0xffffff, 0.7).fillCircle(x, y, 3);
        }
        s.aim.strokeCircle(t.x, t.y, u * 0.02);
      },
      up: (seat, p) => {
        const s = this.shooters[seat];
        s.aim.clear();
        if (!s.aiming) return;
        s.aiming = false;
        if (!this.playing || Math.hypot(p.x - s.restX, p.y - s.restY) < u * 0.03) return;
        const t = this.target(s, p.x, p.y);
        s.state = 'flying';
        s.t = 0;
        s.fromX = s.restX;
        s.fromY = s.restY;
        s.toX = t.x;
        s.toY = t.y;
        sfx('shoot');
      },
    });
  }

  protected startGame(): void {}

  private target(s: Shooter, x: number, y: number): { x: number; y: number } {
    const { width, height } = this.scale;
    return {
      x: Phaser.Math.Clamp(s.restX + (x - s.restX) * POWER, 0, width),
      y: Phaser.Math.Clamp(s.restY + (y - s.restY) * POWER, 0, height),
    };
  }

  protected tick(dt: number): void {
    this.updateTimer();
    const { width, height } = this.scale;
    const t = this.elapsed;
    // The hoop drifts around the middle, a bit faster over time.
    const sp = 1 + Math.min(0.8, t * 0.015);
    this.hoop.x = width / 2 + Math.sin(t * 0.7 * sp) * width * 0.22;
    this.hoop.y = height / 2 + Math.sin(t * 1.1 * sp + 1) * height * 0.09;
    const h = this.hoop;
    this.hoopGfx.clear();
    this.hoopGfx.fillStyle(0xffffff, 0.25).fillCircle(h.x, h.y, h.r);
    this.hoopGfx.lineStyle(this.unit * 0.012, 0xff5400, 1).strokeCircle(h.x, h.y, h.r);
    this.hoopGfx.lineStyle(2, 0xffffff, 0.6);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6)
      this.hoopGfx.lineBetween(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r, h.x + Math.cos(a) * h.r * 0.5, h.y + Math.sin(a) * h.r * 0.5);

    for (const s of this.shooters) {
      if (s.state === 'flying') {
        s.t += dt / FLIGHT;
        const k = Math.min(1, s.t);
        s.ball.setPosition(Phaser.Math.Linear(s.fromX, s.toX, k), Phaser.Math.Linear(s.fromY, s.toY, k));
        s.ball.setScale(1 + Math.sin(k * Math.PI) * 0.9);
        if (k >= 1) this.land(s);
      } else if (s.state === 'reload') {
        s.t -= dt;
        if (s.t <= 0) {
          s.state = 'ready';
          s.ball.setPosition(s.restX, s.restY).setScale(1).setAlpha(1);
        }
      }
    }
    if (t >= TIME_LIMIT) this.end();
  }

  private land(s: Shooter): void {
    const h = this.hoop;
    const inside = Math.hypot(s.toX - h.x, s.toY - h.y) < h.r * 0.95;
    if (inside) {
      const far = Math.hypot(s.fromX - h.x, s.fromY - h.y) > this.unit * 0.45;
      const pts = far ? 3 : 2;
      s.score += pts;
      s.scoreText.setText(String(s.score));
      sfx('goal');
      const pop = label(this, h.x, h.y - h.r, `+${pts}`, this.unit * 0.06, '#ffd166').setDepth(30);
      this.tweens.add({ targets: pop, y: h.y - h.r * 2.5, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
      this.toast(far ? '🏀 3 POINTS!' : '🏀 Swish!', [s.seat], 800);
      this.tweens.add({ targets: s.ball, scale: 0.4, alpha: 0, duration: 250 });
    } else {
      sfx('bounce');
      this.tweens.add({ targets: s.ball, alpha: 0, duration: 300 });
    }
    s.state = 'reload';
    s.t = 0.45;
  }

  private end(): void {
    this.finish(placementsFromScores(this.shooters.map((s) => s.score)), this.shooters.map((s) => `${s.score} points`));
  }
}
