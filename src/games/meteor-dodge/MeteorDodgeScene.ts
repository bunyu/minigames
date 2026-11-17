import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, label } from '../../engine/character';
import type { Joystick } from '../../engine/joystick';
import { collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const meteorDodgeMeta: GameMeta = {
  id: 'meteor-dodge',
  title: 'Meteor Dodge',
  icon: '☄️',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Move with your joystick and dodge the meteors. They get faster and bigger! You can shove other players.',
  gesture: 'joystick',
  tips: ['🕹️ Move to dodge', '☄️ Hit = out!', '⚠️ shows where they come'],
  background: '#03045e',
};

const TIME_LIMIT = 100;

interface Runner extends Body {
  seat: number;
  alive: boolean;
  diedAt: number;
  shields: number;
  invulnerable: number;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  view: Phaser.GameObjects.Container;
}

export class MeteorDodgeScene extends BaseGameScene {
  private runners: Runner[] = [];
  private meteors: Meteor[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private spawnIn = 0;

  constructor() {
    super(meteorDodgeMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.arena = this.drawArena(0x0b0f3a, 0x90e0ef);
    this.meteors = [];
    this.spawnIn = 0.6;
    // A few stars for atmosphere.
    const stars = this.add.graphics().setDepth(1);
    for (let i = 0; i < 70; i++) {
      stars.fillStyle(0xffffff, Math.random() * 0.6 + 0.2);
      stars.fillCircle(Phaser.Math.Between(this.arena.x, this.arena.right), Phaser.Math.Between(this.arena.y, this.arena.bottom), Math.random() * 2 + 0.5);
    }

    const r = u * 0.035;
    this.runners = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.35);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const joy = this.addJoystick(i, c);
      return {
        seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1,
        alive: true, diedAt: 0, shields: p.handicap > 0 ? 1 : 0, invulnerable: 0, view, joy,
      };
    });
  }

  protected startGame(): void {}

  private spawnMeteor(): void {
    const a = this.arena;
    const u = this.unit;
    const t = this.elapsed;
    const r = u * (0.022 + Math.random() * 0.02 + Math.min(0.03, t * 0.0005)) * (Math.random() < 0.12 ? 2 : 1);
    const edge = Phaser.Math.Between(0, 3);
    const along = Math.random();
    const x = edge === 0 ? a.x + along * a.width : edge === 1 ? a.right + r : edge === 2 ? a.x + along * a.width : a.x - r;
    const y = edge === 0 ? a.y - r : edge === 1 ? a.y + along * a.height : edge === 2 ? a.bottom + r : a.y + along * a.height;
    // Aim at a random point, biased toward a living player half the time.
    const target =
      Math.random() < 0.5
        ? Phaser.Utils.Array.GetRandom(this.runners.filter((p) => p.alive))
        : { x: a.x + Math.random() * a.width, y: a.y + Math.random() * a.height };
    const speed = u * (0.22 + Math.min(0.4, t * 0.006)) * (0.8 + Math.random() * 0.5);
    const ang = Math.atan2(target.y - y, target.x - x);

    // Warning blink where it will enter.
    const wx = Phaser.Math.Clamp(x, a.x + 14, a.right - 14);
    const wy = Phaser.Math.Clamp(y, a.y + 14, a.bottom - 14);
    const warn = label(this, wx, wy, '⚠️', u * 0.04).setDepth(45);
    this.tweens.add({ targets: warn, alpha: { from: 1, to: 0.2 }, yoyo: true, repeat: 2, duration: 110, onComplete: () => warn.destroy() });

    this.time.delayedCall(600, () => {
      if (!this.playing) return;
      const view = this.add.container(x, y).setDepth(20);
      const g = this.add.graphics();
      g.fillStyle(0xff7b00, 0.35).fillCircle(0, 0, r * 1.35);
      g.fillStyle(0x8d6e63, 1).fillCircle(0, 0, r);
      g.fillStyle(0x5d4037, 1).fillCircle(-r * 0.3, -r * 0.25, r * 0.28).fillCircle(r * 0.35, r * 0.2, r * 0.2).fillCircle(-r * 0.1, r * 0.45, r * 0.14);
      view.add(g);
      this.meteors.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, spin: (Math.random() - 0.5) * 6, view });
    });
  }

  protected tick(dt: number): void {
    const t = this.elapsed;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnMeteor();
      this.spawnIn = Math.max(0.2, 0.95 - t * 0.012);
    }

    const speed = this.unit * 0.42;
    for (const p of this.runners) {
      if (!p.alive) continue;
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      const boost = 1 + this.players[p.seat].handicap;
      steer(p, p.joy.vec.x, p.joy.vec.y, speed * boost, dt);
      keepInside(p, this.arena, 0.3);
    }
    for (let i = 0; i < this.runners.length; i++)
      for (let j = i + 1; j < this.runners.length; j++)
        if (this.runners[i].alive && this.runners[j].alive) collide(this.runners[i], this.runners[j], 1.4);
    for (const p of this.runners) if (p.alive) p.view.setPosition(p.x, p.y);

    const a = this.arena;
    const margin = this.unit * 0.2;
    for (const m of this.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.view.setPosition(m.x, m.y);
      m.view.rotation += m.spin * dt;
      for (const p of this.runners) {
        if (!p.alive || p.invulnerable > 0) continue;
        if (Math.hypot(p.x - m.x, p.y - m.y) < m.r + p.r * 0.75) this.hit(p);
      }
    }
    this.meteors = this.meteors.filter((m) => {
      const inside = m.x > a.x - margin && m.x < a.right + margin && m.y > a.y - margin && m.y < a.bottom + margin;
      if (!inside) m.view.destroy();
      return inside;
    });

    const alive = this.runners.filter((p) => p.alive).length;
    if (alive <= 1 || t >= TIME_LIMIT) this.end();
  }

  private hit(p: Runner): void {
    sfx('hit');
    this.cameras.main.shake(120, 0.006);
    if (p.shields > 0) {
      p.shields--;
      p.invulnerable = 1.5;
      this.tweens.add({ targets: p.view, alpha: { from: 0.2, to: 1 }, duration: 150, repeat: 4 });
      this.toast('🛡️ Shield used!', [p.seat]);
      return;
    }
    p.alive = false;
    sfx('out');
    p.diedAt = this.elapsed;
    p.joy.setEnabled(false);
    this.tweens.add({ targets: p.view, scale: 0.2, alpha: 0, angle: 540, duration: 600 });
    this.toast('☄️ Bonk! You are out', [p.seat]);
  }

  private end(): void {
    const scores = this.runners.map((p) => (p.alive ? 1000 : p.diedAt));
    const stats = this.runners.map((p) => (p.alive ? 'survived!' : `hit after ${p.diedAt.toFixed(1)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
