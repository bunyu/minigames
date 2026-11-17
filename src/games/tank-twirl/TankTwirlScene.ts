import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, label } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import { circleRect, keepInside, reflect, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const tankTwirlMeta: GameMeta = {
  id: 'tank-twirl',
  title: 'Tank Twirl',
  icon: '🎯',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Your tank spins. HOLD to drive forward, LET GO to fire. Shells bounce off walls! 3 hits and you are out.',
  gesture: 'hold',
  tips: ['✋ Hold = drive', '👆 Let go = FIRE', '❤️❤️❤️ 3 hits = out'],
  background: '#1b2a12',
};

const TIME_LIMIT = 100;
const FIRE_COOLDOWN = 0.45;
const SHELL_LIFE = 4;
const MAX_BOUNCES = 3;

interface Tank extends Body {
  seat: number;
  angle: number;
  hp: number;
  alive: boolean;
  diedAt: number;
  cooldown: number;
  hull: Phaser.GameObjects.Container;
  rider: Phaser.GameObjects.Container;
  button: TouchButton;
  hearts: Phaser.GameObjects.Text;
}

interface Shell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  age: number;
  bounces: number;
  dot: Phaser.GameObjects.Arc;
}

export class TankTwirlScene extends BaseGameScene {
  private tanks: Tank[] = [];
  private shells: Shell[] = [];
  private blocks: Phaser.Geom.Rectangle[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private shellR = 0;

  constructor() {
    super(tankTwirlMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.arena = this.drawArena(0x3a5a40, 0xdad7cd);
    this.shells = [];
    this.shellR = u * 0.012;

    // Cover blocks: a centre box and four walls around it.
    const a = this.arena;
    const cx = a.centerX;
    const cy = a.centerY;
    const t = u * 0.045;
    this.blocks = [
      new Phaser.Geom.Rectangle(cx - t, cy - t, t * 2, t * 2),
      new Phaser.Geom.Rectangle(cx - a.width * 0.3, cy - a.height * 0.22 - t / 2, a.width * 0.16, t),
      new Phaser.Geom.Rectangle(cx + a.width * 0.14, cy - a.height * 0.22 - t / 2, a.width * 0.16, t),
      new Phaser.Geom.Rectangle(cx - a.width * 0.3, cy + a.height * 0.22 - t / 2, a.width * 0.16, t),
      new Phaser.Geom.Rectangle(cx + a.width * 0.14, cy + a.height * 0.22 - t / 2, a.width * 0.16, t),
    ];
    const g = this.add.graphics().setDepth(2);
    for (const b of this.blocks) {
      g.fillStyle(0x6b705c, 1).fillRect(b.x, b.y, b.width, b.height);
      g.lineStyle(3, 0xa5a58d, 1).strokeRect(b.x, b.y, b.width, b.height);
    }

    const r = u * 0.04;
    this.tanks = this.players.map((p, i) => {
      const start = this.seatStart(i, 0.6);
      const hull = this.add.container(start.x, start.y).setDepth(10);
      const hg = this.add.graphics();
      hg.fillStyle(0x222222, 1).fillRoundedRect(-r * 1.05, -r * 0.95, r * 2.1, r * 0.4, 4).fillRoundedRect(-r * 1.05, r * 0.55, r * 2.1, r * 0.4, 4);
      hg.fillStyle(p.color, 1).fillRoundedRect(-r * 0.9, -r * 0.65, r * 1.8, r * 1.3, 6);
      hg.fillStyle(0x333333, 1).fillRect(0, -r * 0.16, r * 1.6, r * 0.32);
      hg.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(-r * 0.9, -r * 0.65, r * 1.8, r * 1.3, 6);
      hull.add(hg);
      const rider = addCharacter(this, start.x, start.y, p, r * 1.15).setDepth(11);

      const c = this.zoneContainer(i).setDepth(50);
      const br = u * 0.1;
      const pos = this.outerCorner(i, br);
      const button = new TouchButton(this, c, pos.x, pos.y, br, p.color, 'HOLD', 0.36);
      const hp = 3 + (p.handicap > 0 ? 1 : 0);
      const hearts = label(this, pos.x, pos.y - br - u * 0.04, '❤️'.repeat(hp), u * 0.035);
      c.add(hearts);

      const tank: Tank = {
        seat: i, x: start.x, y: start.y, vx: 0, vy: 0, r, mass: 1,
        angle: start.facing, hp, alive: true, diedAt: 0, cooldown: 0, hull, rider, button, hearts,
      };
      button.onRelease = () => this.fire(tank);
      return tank;
    });
  }

  protected startGame(): void {}

  private fire(t: Tank): void {
    if (!this.playing || !t.alive || t.cooldown > 0) return;
    t.cooldown = FIRE_COOLDOWN;
    sfx('shoot');
    const speed = this.unit * 0.75;
    const tip = t.r * 1.7;
    const x = t.x + Math.cos(t.angle) * tip;
    const y = t.y + Math.sin(t.angle) * tip;
    const dot = this.add.circle(x, y, this.shellR, 0xffffff).setStrokeStyle(2, this.players[t.seat].color).setDepth(12);
    this.shells.push({ x, y, vx: Math.cos(t.angle) * speed, vy: Math.sin(t.angle) * speed, owner: t.seat, age: 0, bounces: 0, dot });
    // Recoil.
    t.x -= Math.cos(t.angle) * t.r * 0.15;
    t.y -= Math.sin(t.angle) * t.r * 0.15;
  }

  protected tick(dt: number): void {
    const spin = 2.3 + Math.min(1.2, this.elapsed * 0.02);
    const speed = this.unit * 0.3;
    for (const t of this.tanks) {
      if (!t.alive) continue;
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.button.isDown) {
        t.x += Math.cos(t.angle) * speed * dt;
        t.y += Math.sin(t.angle) * speed * dt;
      } else {
        t.angle += spin * dt * (t.seat % 2 === 0 ? 1 : -1);
      }
      keepInside(t, this.arena);
      for (const b of this.blocks) {
        const hit = circleRect(t.x, t.y, t.r, b);
        if (hit) {
          t.x += hit.nx * hit.depth;
          t.y += hit.ny * hit.depth;
        }
      }
    }
    // Tanks push each other apart.
    for (let i = 0; i < this.tanks.length; i++) {
      for (let j = i + 1; j < this.tanks.length; j++) {
        const a = this.tanks[i];
        const b = this.tanks[j];
        if (!a.alive || !b.alive) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 0.001;
        const overlap = a.r + b.r - d;
        if (overlap > 0) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
        }
      }
    }
    for (const t of this.tanks) {
      if (!t.alive) continue;
      t.hull.setPosition(t.x, t.y).setRotation(t.angle);
      t.rider.setPosition(t.x, t.y);
    }

    this.updateShells(dt);

    const alive = this.tanks.filter((t) => t.alive);
    if (alive.length <= 1 || this.elapsed >= TIME_LIMIT) this.end();
  }

  private updateShells(dt: number): void {
    const a = this.arena;
    for (const s of this.shells) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const r = this.shellR;
      let bounced = false;
      if (s.x - r < a.x || s.x + r > a.right) {
        s.vx = -s.vx;
        s.x = Phaser.Math.Clamp(s.x, a.x + r, a.right - r);
        bounced = true;
      }
      if (s.y - r < a.y || s.y + r > a.bottom) {
        s.vy = -s.vy;
        s.y = Phaser.Math.Clamp(s.y, a.y + r, a.bottom - r);
        bounced = true;
      }
      for (const b of this.blocks) {
        const hit = circleRect(s.x, s.y, r, b);
        if (hit) {
          s.x += hit.nx * hit.depth;
          s.y += hit.ny * hit.depth;
          reflect(s, hit);
          bounced = true;
        }
      }
      if (bounced) s.bounces++;
      s.dot.setPosition(s.x, s.y);

      for (const t of this.tanks) {
        if (!t.alive || (t.seat === s.owner && s.age < 0.35)) continue;
        if (Math.hypot(t.x - s.x, t.y - s.y) < t.r + r) {
          s.age = SHELL_LIFE; // consume
          this.damage(t, s);
          break;
        }
      }
    }
    this.shells = this.shells.filter((s) => {
      const keep = s.age < SHELL_LIFE && s.bounces <= MAX_BOUNCES;
      if (!keep) s.dot.destroy();
      return keep;
    });
  }

  private damage(t: Tank, s: Shell): void {
    t.hp--;
    sfx('hit');
    t.hearts.setText(t.hp > 0 ? '❤️'.repeat(t.hp) : '');
    t.x += s.vx * 0.04;
    t.y += s.vy * 0.04;
    this.cameras.main.shake(100, 0.005);
    this.tweens.add({ targets: [t.hull, t.rider], alpha: { from: 0.2, to: 1 }, duration: 120, repeat: 2 });
    const boom = this.add.circle(s.x, s.y, t.r * 0.5, 0xffd166).setDepth(20);
    this.tweens.add({ targets: boom, radius: t.r * 1.6, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
    if (t.hp <= 0) {
      t.alive = false;
      sfx('boom');
      t.diedAt = this.elapsed;
      t.button.setEnabled(false).setText('OUT');
      this.tweens.add({ targets: [t.hull, t.rider], alpha: 0.25, scale: 0.8, duration: 400 });
      this.toast('💥 Tank destroyed!', [t.seat]);
    }
  }

  private end(): void {
    const scores = this.tanks.map((t) => (t.alive ? 1000 + t.hp : t.diedAt));
    const stats = this.tanks.map((t) => (t.alive ? `survived with ${t.hp} ❤️` : `out after ${t.diedAt.toFixed(1)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
