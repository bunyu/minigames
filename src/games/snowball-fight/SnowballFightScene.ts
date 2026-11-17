import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, label } from '../../engine/character';
import type { TouchButton } from '../../engine/controls';
import type { Joystick } from '../../engine/joystick';
import { circleRect, collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const snowballFightMeta: GameMeta = {
  id: 'snowball-fight',
  title: 'Snowball Fight',
  icon: '❄️',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 75,
  howToPlay: 'Move with the joystick. Tap THROW to throw a snowball the way you face. Hide behind the forts! 3 hits and you are out.',
  gesture: 'joystick-button',
  tips: ['🕹️ Move & aim', '❄️ THROW', '🏰 Hide behind forts'],
  background: '#023e8a',
};

const TIME_LIMIT = 100;
const COOLDOWN = 0.45;

interface Kid extends Body {
  seat: number;
  facing: number;
  hp: number;
  alive: boolean;
  outAt: number;
  cooldown: number;
  view: Phaser.GameObjects.Container;
  arrow: Phaser.GameObjects.Graphics;
  joy: Joystick;
  button: TouchButton;
  hearts: Phaser.GameObjects.Text;
}

interface Snowball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  age: number;
  dot: Phaser.GameObjects.Arc;
}

export class SnowballFightScene extends BaseGameScene {
  private kids: Kid[] = [];
  private balls: Snowball[] = [];
  private forts: Phaser.Geom.Rectangle[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private updateTimer!: () => void;

  constructor() {
    super(snowballFightMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const a = (this.arena = this.drawArena(0xe3f2fd, 0xffffff));
    this.balls = [];
    this.updateTimer = this.addTimer(TIME_LIMIT);

    const fw = a.width * 0.12;
    const fh = u * 0.05;
    const cx = a.centerX;
    const cy = a.centerY;
    this.forts = [
      new Phaser.Geom.Rectangle(cx - fw / 2, cy - fh / 2, fw, fh),
      new Phaser.Geom.Rectangle(cx - a.width * 0.32, cy - a.height * 0.2, fh, a.height * 0.16),
      new Phaser.Geom.Rectangle(cx + a.width * 0.32 - fh, cy - a.height * 0.2, fh, a.height * 0.16),
      new Phaser.Geom.Rectangle(cx - a.width * 0.32, cy + a.height * 0.04, fh, a.height * 0.16),
      new Phaser.Geom.Rectangle(cx + a.width * 0.32 - fh, cy + a.height * 0.04, fh, a.height * 0.16),
      new Phaser.Geom.Rectangle(cx - fw * 0.4, a.y + a.height * 0.2, fw * 0.8, fh * 0.8),
      new Phaser.Geom.Rectangle(cx - fw * 0.4, a.bottom - a.height * 0.2 - fh * 0.8, fw * 0.8, fh * 0.8),
    ];
    const g = this.add.graphics().setDepth(3);
    for (const f of this.forts) {
      g.fillStyle(0xbbdefb, 1).fillRoundedRect(f.x, f.y, f.width, f.height, 8);
      g.lineStyle(3, 0x90caf9, 1).strokeRoundedRect(f.x, f.y, f.width, f.height, 8);
    }

    const r = u * 0.035;
    this.kids = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.7);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const arrow = this.add.graphics().setDepth(9);
      arrow.fillStyle(p.color, 1).fillTriangle(r * 1.15, -r * 0.45, r * 1.15, r * 0.45, r * 1.8, 0);
      arrow.setPosition(s.x, s.y).setRotation(s.facing);
      const c = this.zoneContainer(i).setDepth(50);
      const { joy, button } = this.addJoystickAndButton(i, c, 'THROW');
      const hp = 3 + (p.handicap > 0 ? 1 : 0);
      const hearts = label(this, button.root.x, button.root.y - button.radius - u * 0.035, '❤️'.repeat(hp), u * 0.03);
      c.add(hearts);
      const kid: Kid = {
        seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1, facing: s.facing, hp, alive: true, outAt: 0,
        cooldown: 0, view, arrow, joy, button, hearts,
      };
      button.onPress = () => this.throwBall(kid);
      return kid;
    });
  }

  protected startGame(): void {}

  private throwBall(k: Kid): void {
    if (!this.playing || !k.alive || k.cooldown > 0) return;
    k.cooldown = COOLDOWN;
    sfx('shoot');
    const speed = this.unit * 0.85;
    const x = k.x + Math.cos(k.facing) * k.r * 1.3;
    const y = k.y + Math.sin(k.facing) * k.r * 1.3;
    const dot = this.add.circle(x, y, this.unit * 0.014, 0xffffff).setStrokeStyle(2, 0x90a4ae).setDepth(12);
    this.balls.push({ x, y, vx: Math.cos(k.facing) * speed, vy: Math.sin(k.facing) * speed, owner: k.seat, age: 0, dot });
  }

  protected tick(dt: number): void {
    this.updateTimer();
    const speed = this.unit * 0.38;
    const alive = this.kids.filter((k) => k.alive);
    for (const k of alive) {
      k.cooldown = Math.max(0, k.cooldown - dt);
      k.button.setCharge(1 - k.cooldown / COOLDOWN);
      const v = k.joy.vec;
      if (v.lengthSq() > 0.04) k.facing = Math.atan2(v.y, v.x);
      steer(k, v.x, v.y, speed * (1 + this.players[k.seat].handicap), dt);
      keepInside(k, this.arena);
      for (const f of this.forts) {
        const hit = circleRect(k.x, k.y, k.r, f);
        if (hit) {
          k.x += hit.nx * hit.depth;
          k.y += hit.ny * hit.depth;
        }
      }
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j], 0.8);
    for (const k of alive) {
      k.view.setPosition(k.x, k.y);
      k.arrow.setPosition(k.x, k.y).setRotation(k.facing);
    }

    const a = this.arena;
    const r = this.unit * 0.014;
    for (const b of this.balls) {
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.dot.setPosition(b.x, b.y);
      if (b.x < a.x || b.x > a.right || b.y < a.y || b.y > a.bottom || b.age > 2) b.age = 99;
      else if (this.forts.some((f) => circleRect(b.x, b.y, r, f))) {
        b.age = 99;
        this.splat(b.x, b.y);
      } else {
        const target = alive.find((k) => k.seat !== b.owner && Math.hypot(k.x - b.x, k.y - b.y) < k.r + r);
        if (target) {
          b.age = 99;
          this.hit(target, b);
        }
      }
    }
    this.balls = this.balls.filter((b) => {
      if (b.age >= 99) b.dot.destroy();
      return b.age < 99;
    });

    if (alive.length <= 1 || this.elapsed >= TIME_LIMIT) this.end();
  }

  private splat(x: number, y: number): void {
    const s = this.add.circle(x, y, this.unit * 0.015, 0xffffff).setDepth(12);
    this.tweens.add({ targets: s, radius: this.unit * 0.035, alpha: 0, duration: 250, onComplete: () => s.destroy() });
  }

  private hit(k: Kid, b: Snowball): void {
    this.splat(b.x, b.y);
    k.hp--;
    sfx('hit');
    k.hearts.setText('❤️'.repeat(Math.max(0, k.hp)));
    k.vx += b.vx * 0.6;
    k.vy += b.vy * 0.6;
    this.cameras.main.shake(90, 0.004);
    this.tweens.add({ targets: k.view, alpha: { from: 0.3, to: 1 }, duration: 120, repeat: 2 });
    if (k.hp <= 0) {
      k.alive = false;
      k.outAt = this.elapsed;
      k.joy.setEnabled(false);
      k.button.setEnabled(false).setText('OUT');
      k.arrow.setVisible(false);
      this.tweens.add({ targets: k.view, alpha: 0.25, scale: 0.7, duration: 400 });
      this.toast('☃️ Snowed under!', [k.seat]);
    }
  }

  private end(): void {
    const scores = this.kids.map((k) => (k.alive ? 1000 + k.hp : k.outAt));
    const stats = this.kids.map((k) => (k.alive ? `${k.hp} ❤️ left` : `out after ${k.outAt.toFixed(0)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
