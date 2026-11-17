import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter } from '../../engine/character';
import type { Joystick } from '../../engine/joystick';
import { angleDiff, collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const balloonJoustMeta: GameMeta = {
  id: 'balloon-joust',
  title: 'Balloon Joust',
  icon: '🎈',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Your lance points the way you ride. Pop the balloons behind the others – and keep yours safe!',
  gesture: 'joystick',
  tips: ['🕹️ Your lance points ahead', '🎈 Pop their balloons', '🛡️ Protect yours'],
  background: '#023e8a',
};

const TIME_LIMIT = 100;
const TURN_RATE = 4;

interface Knight extends Body {
  seat: number;
  facing: number;
  balloons: number;
  alive: boolean;
  outAt: number;
  safe: number;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
}

export class BalloonJoustScene extends BaseGameScene {
  private knights: Knight[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super(balloonJoustMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.arena = this.drawArena(0x48cae4, 0xffffff);
    // Clouds.
    const clouds = this.add.graphics().setDepth(1);
    clouds.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 8; i++) {
      const x = this.arena.x + Math.random() * this.arena.width;
      const y = this.arena.y + Math.random() * this.arena.height;
      clouds.fillEllipse(x, y, u * 0.16, u * 0.06).fillEllipse(x + u * 0.05, y - u * 0.02, u * 0.1, u * 0.06);
    }
    this.gfx = this.add.graphics().setDepth(9);

    const r = u * 0.034;
    this.knights = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.65);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const joy = this.addJoystick(i, c);
      return {
        seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1, facing: s.facing,
        balloons: 3 + (p.handicap > 0 ? 1 : 0), alive: true, outAt: 0, safe: 0, view, joy,
      };
    });
  }

  protected startGame(): void {}

  private tip(k: Knight): { x: number; y: number } {
    return { x: k.x + Math.cos(k.facing) * k.r * 2.3, y: k.y + Math.sin(k.facing) * k.r * 2.3 };
  }

  private balloonSpots(k: Knight): { x: number; y: number }[] {
    const back = k.facing + Math.PI;
    const spots: { x: number; y: number }[] = [];
    for (let i = 0; i < k.balloons; i++) {
      const spread = (i - (k.balloons - 1) / 2) * 0.55;
      spots.push({ x: k.x + Math.cos(back + spread) * k.r * 1.9, y: k.y + Math.sin(back + spread) * k.r * 1.9 });
    }
    return spots;
  }

  protected tick(dt: number): void {
    const u = this.unit;
    const speed = u * 0.36;
    const alive = this.knights.filter((k) => k.alive);
    for (const k of alive) {
      k.safe = Math.max(0, k.safe - dt);
      const v = k.joy.vec;
      const mag = Math.min(1, v.length());
      if (mag > 0.2) {
        // The lance turns toward the joystick at a limited rate: aiming takes skill.
        const d = angleDiff(Math.atan2(v.y, v.x), k.facing);
        k.facing += Phaser.Math.Clamp(d, -TURN_RATE * dt, TURN_RATE * dt);
      }
      const boost = 1 + this.players[k.seat].handicap;
      steer(k, Math.cos(k.facing) * mag, Math.sin(k.facing) * mag, speed * boost, dt, 6);
      keepInside(k, this.arena, 0.5);
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j], 1);

    const balloonR = u * 0.022;
    for (const attacker of alive) {
      const tip = this.tip(attacker);
      for (const target of alive) {
        if (target === attacker || target.safe > 0 || !target.alive) continue;
        if (this.balloonSpots(target).some((b) => Math.hypot(b.x - tip.x, b.y - tip.y) < balloonR * 1.2)) this.pop(attacker, target);
      }
    }

    const g = this.gfx.clear();
    for (const k of this.knights) {
      k.view.setPosition(k.x, k.y);
      if (!k.alive) continue;
      const color = this.players[k.seat].color;
      for (const b of this.balloonSpots(k)) {
        g.lineStyle(2, 0xffffff, 0.8).lineBetween(k.x, k.y, b.x, b.y);
        g.fillStyle(color, k.safe > 0 && Math.sin(this.elapsed * 30) > 0 ? 0.3 : 1).fillCircle(b.x, b.y, balloonR);
        g.fillStyle(0xffffff, 0.6).fillCircle(b.x - balloonR * 0.35, b.y - balloonR * 0.35, balloonR * 0.25);
      }
      const tip = this.tip(k);
      g.lineStyle(u * 0.009, 0xadb5bd, 1).lineBetween(k.x, k.y, tip.x, tip.y);
      g.fillStyle(0xffd60a, 1).fillCircle(tip.x, tip.y, u * 0.008);
    }

    if (alive.length <= 1 || this.elapsed >= TIME_LIMIT) this.end();
  }

  private pop(attacker: Knight, target: Knight): void {
    target.balloons--;
    target.safe = 1.2;
    sfx('hit');
    const nx = Math.cos(attacker.facing);
    const ny = Math.sin(attacker.facing);
    target.vx += nx * this.unit * 0.6;
    target.vy += ny * this.unit * 0.6;
    attacker.vx -= nx * this.unit * 0.25;
    attacker.vy -= ny * this.unit * 0.25;
    this.cameras.main.shake(90, 0.004);
    if (target.balloons <= 0) {
      target.alive = false;
      target.outAt = this.elapsed;
      target.joy.setEnabled(false);
      sfx('out');
      this.tweens.add({ targets: target.view, alpha: 0.25, scale: 0.7, duration: 400 });
      this.toast('🎈 All balloons popped!', [target.seat]);
    } else {
      this.toast('💥 Pop!', [target.seat], 700);
    }
  }

  private end(): void {
    const scores = this.knights.map((k) => (k.alive ? 1000 + k.balloons : k.outAt));
    const stats = this.knights.map((k) => (k.alive ? `${k.balloons} 🎈 left` : `out after ${k.outAt.toFixed(0)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
