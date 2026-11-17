import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, emoji, label } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import { collide, keepInside, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const gemMinerMeta: GameMeta = {
  id: 'gem-miner',
  title: 'Gem Miner',
  icon: '💎',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Your ship spins. HOLD to fly forward. Grab gems, dodge asteroids, and ram other ships to steal their gems!',
  gesture: 'hold',
  tips: ['✋ Hold = fly', '💎 Grab gems', '☄️ Avoid the rocks'],
  background: '#03071e',
};

const TIME_LIMIT = 60;

interface Ship extends Body {
  seat: number;
  angle: number;
  gems: number;
  stun: number;
  safe: number;
  stealCool: number;
  hull: Phaser.GameObjects.Container;
  rider: Phaser.GameObjects.Container;
  flame: Phaser.GameObjects.Graphics;
  button: TouchButton;
  score: Phaser.GameObjects.Text;
}

interface Rock extends Body {
  view: Phaser.GameObjects.Graphics;
}

interface Gem {
  x: number;
  y: number;
  view: Phaser.GameObjects.Text;
}

export class GemMinerScene extends BaseGameScene {
  private ships: Ship[] = [];
  private rocks: Rock[] = [];
  private gems: Gem[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private updateTimer!: () => void;

  constructor() {
    super(gemMinerMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const a = (this.arena = this.drawArena(0x10002b, 0x7b2cbf));
    this.updateTimer = this.addTimer(TIME_LIMIT);
    this.rocks = [];
    this.gems = [];
    const stars = this.add.graphics().setDepth(1);
    for (let i = 0; i < 60; i++) {
      stars.fillStyle(0xffffff, Math.random() * 0.6 + 0.2).fillCircle(a.x + Math.random() * a.width, a.y + Math.random() * a.height, Math.random() * 1.8 + 0.4);
    }

    const r = u * 0.03;
    this.ships = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.7);
      const hull = this.add.container(s.x, s.y).setDepth(10);
      const flame = this.add.graphics();
      flame.fillStyle(0xff9e00, 1).fillTriangle(-r * 1.1, -r * 0.4, -r * 1.1, r * 0.4, -r * 2, 0);
      flame.setVisible(false);
      const g = this.add.graphics();
      g.fillStyle(p.color, 1).fillTriangle(r * 1.6, 0, -r * 1.1, -r * 1.1, -r * 1.1, r * 1.1);
      g.lineStyle(2, 0xffffff, 0.9).strokeTriangle(r * 1.6, 0, -r * 1.1, -r * 1.1, -r * 1.1, r * 1.1);
      hull.add([flame, g]);
      const rider = addCharacter(this, s.x, s.y, p, r * 1.2).setDepth(11);
      const c = this.zoneContainer(i).setDepth(50);
      const br = u * 0.1;
      const pos = this.outerCorner(i, br);
      const button = new TouchButton(this, c, pos.x, pos.y, br, p.color, 'HOLD', 0.36);
      const score = label(this, pos.x, pos.y - br - u * 0.045, '💎 0', u * 0.045);
      c.add(score);
      return {
        seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r: r * 1.2, mass: 1 + p.handicap, angle: s.facing,
        gems: 0, stun: 0, safe: 0, stealCool: 0, hull, rider, flame, button, score,
      };
    });
    for (let i = 0; i < 3; i++) this.addRock();
    for (let i = 0; i < 6; i++) this.addGem();
  }

  protected startGame(): void {}

  private randomFreeSpot(clearance: number): { x: number; y: number } {
    const a = this.arena;
    let x = a.centerX;
    let y = a.centerY;
    for (let i = 0; i < 12; i++) {
      x = a.x + clearance + Math.random() * (a.width - clearance * 2);
      y = a.y + clearance + Math.random() * (a.height - clearance * 2);
      if (this.ships.every((s) => Math.hypot(s.x - x, s.y - y) > this.unit * 0.15)) break;
    }
    return { x, y };
  }

  private addRock(): void {
    const u = this.unit;
    const r = u * (0.035 + Math.random() * 0.035);
    const { x, y } = this.randomFreeSpot(r);
    const ang = Math.random() * Math.PI * 2;
    const sp = u * (0.08 + Math.random() * 0.08);
    const view = this.add.graphics().setDepth(8);
    view.fillStyle(0x6c757d, 1).fillCircle(0, 0, r).fillStyle(0x495057, 1).fillCircle(-r * 0.3, -r * 0.2, r * 0.3).fillCircle(r * 0.35, r * 0.3, r * 0.2);
    view.setPosition(x, y);
    this.rocks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r, mass: 6, view });
  }

  private addGem(at?: { x: number; y: number }): void {
    const { x, y } = at ?? this.randomFreeSpot(this.unit * 0.04);
    const view = emoji(this, x, y, '💎', this.unit * 0.04).setDepth(6);
    this.tweens.add({ targets: view, scale: { from: 0, to: 1 }, duration: 250 });
    this.gems.push({ x, y, view });
  }

  private setGems(s: Ship, n: number): void {
    s.gems = Math.max(0, n);
    s.score.setText(`💎 ${s.gems}`);
  }

  protected tick(dt: number): void {
    this.updateTimer();
    const u = this.unit;
    const a = this.arena;
    if (this.gems.length < 7 && Math.random() < dt * 2) this.addGem();
    if (this.rocks.length < Math.min(6, 3 + Math.floor(this.elapsed / 15))) this.addRock();

    for (const s of this.ships) {
      s.stun = Math.max(0, s.stun - dt);
      s.safe = Math.max(0, s.safe - dt);
      s.stealCool = Math.max(0, s.stealCool - dt);
      const thrusting = s.button.isDown && s.stun <= 0;
      if (s.stun > 0) s.angle += 8 * dt;
      else if (!thrusting) s.angle += 2.6 * dt * (s.seat % 2 === 0 ? 1 : -1);
      if (thrusting) {
        const acc = u * 1.1 * (1 + this.players[s.seat].handicap);
        s.vx += Math.cos(s.angle) * acc * dt;
        s.vy += Math.sin(s.angle) * acc * dt;
      }
      const f = Math.exp(-0.9 * dt);
      s.vx *= f;
      s.vy *= f;
      const sp = Math.hypot(s.vx, s.vy);
      const max = u * 0.6;
      if (sp > max) {
        s.vx *= max / sp;
        s.vy *= max / sp;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      keepInside(s, a, 0.6);
      s.flame.setVisible(thrusting);
    }

    // Ramming: the faster ship steals a gem.
    for (let i = 0; i < this.ships.length; i++)
      for (let j = i + 1; j < this.ships.length; j++) {
        const p = this.ships[i];
        const q = this.ships[j];
        const ps = Math.hypot(p.vx, p.vy);
        const qs = Math.hypot(q.vx, q.vy);
        if (!collide(p, q, 0.9)) continue;
        sfx('bounce');
        const [fast, slow] = ps >= qs ? [p, q] : [q, p];
        if (fast.stealCool <= 0 && slow.gems > 0 && Math.abs(ps - qs) > u * 0.1) {
          fast.stealCool = 1;
          this.setGems(slow, slow.gems - 1);
          this.setGems(fast, fast.gems + 1);
          sfx('coin');
          this.toast('🏴‍☠️ Stolen!', [slow.seat], 700);
        }
      }

    for (const r of this.rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      keepInside(r, a, 1);
      r.view.setPosition(r.x, r.y).setRotation(r.view.rotation + dt * 0.5);
      for (const s of this.ships) {
        if (s.safe > 0 || Math.hypot(s.x - r.x, s.y - r.y) > s.r + r.r) continue;
        collide(s, r, 1);
        this.crash(s);
      }
    }

    for (const s of this.ships) {
      s.hull.setPosition(s.x, s.y).setRotation(s.angle);
      s.rider.setPosition(s.x, s.y);
      for (const g of this.gems) {
        if (Math.hypot(g.x - s.x, g.y - s.y) < s.r + u * 0.02) {
          g.x = NaN; // mark collected
          this.setGems(s, s.gems + 1);
          sfx('coin');
        }
      }
    }
    this.gems = this.gems.filter((g) => {
      if (Number.isNaN(g.x)) g.view.destroy();
      return !Number.isNaN(g.x);
    });

    if (this.elapsed >= TIME_LIMIT) this.end();
  }

  private crash(s: Ship): void {
    s.stun = 1;
    s.safe = 1.6;
    sfx('boom');
    this.cameras.main.shake(120, 0.005);
    this.tweens.add({ targets: [s.hull, s.rider], alpha: { from: 0.3, to: 1 }, duration: 150, repeat: 4 });
    const lost = Math.min(2, s.gems);
    this.setGems(s, s.gems - lost);
    for (let i = 0; i < lost; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = this.unit * 0.1;
      this.addGem({
        x: Phaser.Math.Clamp(s.x + Math.cos(ang) * d, this.arena.x + 20, this.arena.right - 20),
        y: Phaser.Math.Clamp(s.y + Math.sin(ang) * d, this.arena.y + 20, this.arena.bottom - 20),
      });
    }
    this.toast(lost ? `☄️ Crash! −${lost} 💎` : '☄️ Crash!', [s.seat], 800);
  }

  private end(): void {
    this.finish(placementsFromScores(this.ships.map((s) => s.gems)), this.ships.map((s) => `${s.gems} gems`));
  }
}
