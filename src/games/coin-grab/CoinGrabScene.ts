import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, emoji, label } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import { collide, keepInside, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const coinGrabMeta: GameMeta = {
  id: 'coin-grab',
  title: 'Coin Grab',
  icon: '💰',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 45,
  howToPlay: 'Your runner always goes round in circles. Tap to switch which way you turn. Grab coins, dodge bombs!',
  gesture: 'tap',
  tips: ['👆 Tap = turn the other way', '💰 +1   💎 +3', '💣 = lose coins'],
  background: '#3d2b1f',
};

const TIME_LIMIT = 45;
const MAX_COINS = 8;

interface Runner extends Body {
  seat: number;
  heading: number;
  turn: number;
  coins: number;
  stun: number;
  view: Phaser.GameObjects.Container;
  arrow: Phaser.GameObjects.Graphics;
  button: TouchButton;
  score: Phaser.GameObjects.Text;
}

interface Pickup {
  x: number;
  y: number;
  value: number; // negative = bomb
  ttl: number;
  view: Phaser.GameObjects.Container;
}

export class CoinGrabScene extends BaseGameScene {
  private runners: Runner[] = [];
  private pickups: Pickup[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private spawnIn = 0;
  private updateTimer!: () => void;

  constructor() {
    super(coinGrabMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.arena = this.drawArena(0x8d6346, 0xffe8d6);
    this.pickups = [];
    this.spawnIn = 0;
    this.updateTimer = this.addTimer(TIME_LIMIT);
    const r = u * 0.034;
    this.runners = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.55);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const arrow = this.add.graphics().setDepth(9);
      arrow.fillStyle(0xffffff, 1).fillTriangle(r * 1.15, -r * 0.4, r * 1.15, r * 0.4, r * 1.75, 0);
      const c = this.zoneContainer(i).setDepth(50);
      const br = u * 0.1;
      const pos = this.outerCorner(i, br);
      const turn = i % 2 === 0 ? 1 : -1;
      const button = new TouchButton(this, c, pos.x, pos.y, br, p.color, turn > 0 ? '↻' : '↺', 0.8);
      const score = label(this, pos.x, pos.y - br - u * 0.045, '💰 0', u * 0.045);
      c.add(score);
      const runner: Runner = { seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1, heading: s.facing, turn, coins: 0, stun: 0, view, arrow, button, score };
      button.onPress = () => {
        if (!this.playing) return;
        runner.turn *= -1;
        sfx('tap');
        button.setText(runner.turn > 0 ? '↻' : '↺');
      };
      return runner;
    });
  }

  protected startGame(): void {}

  private spawn(): void {
    const a = this.arena;
    const u = this.unit;
    const bombs = this.pickups.filter((p) => p.value < 0).length;
    const coins = this.pickups.length - bombs;
    const wantBomb = this.elapsed > 8 && bombs < 3 && Math.random() < 0.3;
    if (!wantBomb && coins >= MAX_COINS) return;
    // Not right on top of someone.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 10; tries++) {
      x = a.x + u * 0.05 + Math.random() * (a.width - u * 0.1);
      y = a.y + u * 0.05 + Math.random() * (a.height - u * 0.1);
      if (this.runners.every((r) => Math.hypot(r.x - x, r.y - y) > u * 0.12)) break;
    }
    const value = wantBomb ? -1 : Math.random() < 0.12 ? 3 : 1;
    const view = this.pickupView(x, y, value);
    this.tweens.add({ targets: view, scale: { from: 0, to: 1 }, duration: 250, ease: 'Back.Out' });
    this.pickups.push({ x, y, value, ttl: value < 0 ? 6 : 999, view });
  }

  /** Coins are drawn (the coin emoji is missing on older devices); gems and bombs are emoji. */
  private pickupView(x: number, y: number, value: number): Phaser.GameObjects.Container {
    const u = this.unit;
    const c = this.add.container(x, y).setDepth(5);
    if (value === 1) {
      const r = u * 0.02;
      c.add([
        this.add.circle(0, 0, r, 0xffd166).setStrokeStyle(r * 0.25, 0xe09f3e),
        this.add.circle(0, 0, r * 0.5, 0xffe8a3),
      ]);
    } else {
      c.add(emoji(this, 0, 0, value < 0 ? '💣' : '💎', u * 0.055));
    }
    return c;
  }

  protected tick(dt: number): void {
    this.updateTimer();
    const t = this.elapsed;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      this.spawnIn = 0.45;
    }

    const turnRate = 2.7;
    for (const r of this.runners) {
      const speed = this.unit * 0.3 * (1 + this.players[r.seat].handicap) * (r.stun > 0 ? 0.3 : 1);
      if (r.stun > 0) {
        r.stun -= dt;
        r.heading += 9 * dt;
      } else {
        r.heading += r.turn * turnRate * dt;
      }
      r.vx = Math.cos(r.heading) * speed;
      r.vy = Math.sin(r.heading) * speed;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      if (keepInside(r, this.arena, 1)) r.heading = Math.atan2(r.vy, r.vx);
    }
    for (let i = 0; i < this.runners.length; i++)
      for (let j = i + 1; j < this.runners.length; j++) {
        const a = this.runners[i];
        const b = this.runners[j];
        if (collide(a, b, 1)) {
          a.heading = Math.atan2(a.vy, a.vx);
          b.heading = Math.atan2(b.vy, b.vx);
        }
      }
    for (const r of this.runners) {
      r.view.setPosition(r.x, r.y);
      r.arrow.setPosition(r.x, r.y).setRotation(r.heading);
      for (const p of this.pickups) {
        if (p.ttl <= 0 || Math.hypot(p.x - r.x, p.y - r.y) > r.r + this.unit * 0.022) continue;
        p.ttl = 0;
        if (p.value > 0) this.addCoins(r, p.value, p.x, p.y);
        else this.boom(r, p);
      }
    }
    for (const p of this.pickups) {
      p.ttl -= dt;
      if (p.value < 0 && p.ttl < 1.5) p.view.setAlpha(Math.sin(t * 25) > 0 ? 1 : 0.3);
    }
    this.pickups = this.pickups.filter((p) => {
      if (p.ttl <= 0) p.view.destroy();
      return p.ttl > 0;
    });

    if (t >= TIME_LIMIT) this.end();
  }

  private addCoins(r: Runner, n: number, x: number, y: number): void {
    r.coins += n;
    sfx('coin');
    r.score.setText(`💰 ${r.coins}`);
    const pop = label(this, x, y, `+${n}`, this.unit * 0.04, '#ffd166').setDepth(30);
    this.tweens.add({ targets: pop, y: y - this.unit * 0.06, alpha: 0, duration: 600, onComplete: () => pop.destroy() });
  }

  private boom(r: Runner, bomb: Pickup): void {
    const u = this.unit;
    r.stun = 1;
    sfx('boom');
    this.cameras.main.shake(150, 0.006);
    const blast = this.add.circle(bomb.x, bomb.y, u * 0.02, 0xff9e00).setDepth(30);
    this.tweens.add({ targets: blast, radius: u * 0.1, alpha: 0, duration: 400, onComplete: () => blast.destroy() });
    // Drop up to 3 coins around the bomb for others to grab.
    const lost = Math.min(3, r.coins);
    r.coins -= lost;
    r.score.setText(`💰 ${r.coins}`);
    for (let i = 0; i < lost; i++) {
      const ang = Math.random() * Math.PI * 2;
      const x = Phaser.Math.Clamp(bomb.x + Math.cos(ang) * u * 0.1, this.arena.x + 20, this.arena.right - 20);
      const y = Phaser.Math.Clamp(bomb.y + Math.sin(ang) * u * 0.1, this.arena.y + 20, this.arena.bottom - 20);
      const view = this.pickupView(x, y, 1);
      this.pickups.push({ x, y, value: 1, ttl: 999, view });
    }
    this.toast(lost > 0 ? `💣 Ouch! −${lost} coins` : '💣 Ouch!', [r.seat], 900);
  }

  private end(): void {
    const scores = this.runners.map((r) => r.coins);
    this.finish(placementsFromScores(scores), this.runners.map((r) => `${r.coins} coins`));
  }
}
