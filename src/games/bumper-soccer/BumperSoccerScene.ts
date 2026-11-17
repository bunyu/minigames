import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, emoji, label } from '../../engine/character';
import type { Joystick } from '../../engine/joystick';
import { collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const bumperSoccerMeta: GameMeta = {
  id: 'bumper-soccer',
  title: 'Bumper Soccer',
  icon: '⚽',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 75,
  howToPlay: "Push the ball into the other players' goals and guard your own! 3 goals against you and you are out.",
  gesture: 'joystick',
  tips: ['🕹️ Push the ⚽', '🥅 Guard your goal', '❤️ 3 goals = out'],
  background: '#081c15',
};

const TIME_LIMIT = 120;

interface Goal {
  x1: number;
  x2: number;
  y: number;
  side: 'bottom' | 'top';
  gfx: Phaser.GameObjects.Graphics;
}

interface Player extends Body {
  seat: number;
  lives: number;
  alive: boolean;
  outAt: number;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
  goal: Goal;
  livesText: Phaser.GameObjects.Text;
}

interface Ball extends Body {
  respawn: number;
  view: Phaser.GameObjects.Text;
}

export class BumperSoccerScene extends BaseGameScene {
  private players2: Player[] = [];
  private balls: Ball[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private updateTimer!: () => void;

  constructor() {
    super(bumperSoccerMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const a = (this.arena = this.drawArena(0x2d6a4f, 0xffffff));
    const lines = this.add.graphics().setDepth(1);
    lines.lineStyle(u * 0.006, 0xffffff, 0.5);
    lines.strokeCircle(a.centerX, a.centerY, u * 0.12);
    lines.lineBetween(a.x, a.centerY, a.right, a.centerY);
    this.balls = [];
    this.updateTimer = this.addTimer(TIME_LIMIT);

    const r = u * 0.04;
    this.players2 = this.players.map((p, i) => {
      const z = this.zones[i];
      const x1 = Math.max(z.x, a.x);
      const x2 = Math.min(z.x + z.w, a.right);
      const mid = (x1 + x2) / 2;
      const half = (x2 - x1) * 0.27;
      const goal: Goal = {
        x1: mid - half,
        x2: mid + half,
        y: z.side === 'bottom' ? a.bottom : a.y,
        side: z.side,
        gfx: this.add.graphics().setDepth(41),
      };
      this.drawGoal(goal, p.color, true);

      const s = this.seatStart(i, 0.55);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const joy = this.addJoystick(i, c);
      const pos = this.outerCorner(i, joy.radius);
      const lives = 3 + (p.handicap > 0 ? 1 : 0);
      const livesText = label(this, pos.x, pos.y - joy.radius - u * 0.05, '❤️'.repeat(lives), u * 0.035);
      c.add(livesText);
      return { seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 2.2, lives, alive: true, outAt: 0, view, joy, goal, livesText };
    });
    this.addBall();
  }

  protected startGame(): void {
    this.launch(this.balls[0]);
  }

  private drawGoal(g: Goal, color: number, open: boolean): void {
    const u = this.unit;
    const depth = u * 0.03;
    const y = g.side === 'bottom' ? g.y : g.y - depth;
    g.gfx.clear();
    if (open) {
      g.gfx.fillStyle(color, 0.85).fillRect(g.x1, y, g.x2 - g.x1, depth);
      g.gfx.lineStyle(2, 0xffffff, 0.7);
      for (let x = g.x1; x <= g.x2; x += u * 0.02) g.gfx.lineBetween(x, y, x, y + depth);
    } else {
      g.gfx.fillStyle(0x888888, 1).fillRect(g.x1, g.side === 'bottom' ? g.y - u * 0.006 : g.y - u * 0.004, g.x2 - g.x1, u * 0.01);
    }
  }

  private addBall(): Ball {
    const a = this.arena;
    const r = this.unit * 0.028;
    const view = emoji(this, a.centerX, a.centerY, '⚽', r * 2.3).setDepth(12);
    const ball: Ball = { x: a.centerX, y: a.centerY, vx: 0, vy: 0, r, mass: 1, respawn: 0, view };
    this.balls.push(ball);
    return ball;
  }

  private launch(b: Ball): void {
    const ang = Math.random() * Math.PI * 2;
    const speed = this.unit * 0.25;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
  }

  protected tick(dt: number): void {
    this.updateTimer();
    const a = this.arena;
    const speed = this.unit * 0.42;
    const alive = this.players2.filter((p) => p.alive);
    for (const p of alive) {
      steer(p, p.joy.vec.x, p.joy.vec.y, speed * (1 + this.players[p.seat].handicap), dt);
      keepInside(p, a, 0.2);
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j], 0.9);
    for (const p of alive) p.view.setPosition(p.x, p.y);

    if (this.elapsed > 30 && this.balls.length === 1) {
      this.launch(this.addBall());
      this.toast('⚽⚽ Two balls!');
    }

    const maxSpeed = this.unit * 1.4;
    for (const b of this.balls) {
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) {
          b.view.setVisible(true).setPosition(b.x, b.y);
          this.launch(b);
        }
        continue;
      }
      const f = Math.exp(-0.6 * dt);
      b.vx *= f;
      b.vy *= f;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      for (const p of alive) if (collide(p, b, 1.15)) sfx('bounce');
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > maxSpeed) {
        b.vx *= maxSpeed / sp;
        b.vy *= maxSpeed / sp;
      }
      this.ballWalls(b);
      b.view.setPosition(b.x, b.y).setRotation(b.view.rotation + (b.vx * dt) / b.r);
    }

    if (alive.length <= 1 || this.elapsed >= TIME_LIMIT) this.end();
  }

  private ballWalls(b: Ball): void {
    const a = this.arena;
    if (b.x - b.r < a.x) {
      b.x = a.x + b.r;
      b.vx = Math.abs(b.vx) * 0.9;
    } else if (b.x + b.r > a.right) {
      b.x = a.right - b.r;
      b.vx = -Math.abs(b.vx) * 0.9;
    }
    for (const side of ['bottom', 'top'] as const) {
      const past = side === 'bottom' ? b.y + b.r > a.bottom : b.y - b.r < a.y;
      if (!past) continue;
      const owner = this.players2.find((p) => p.alive && p.goal.side === side && b.x > p.goal.x1 && b.x < p.goal.x2);
      if (owner) {
        // Inside the goal mouth: it's a goal once the centre crosses the line.
        if (side === 'bottom' ? b.y > a.bottom : b.y < a.y) this.scored(owner, b);
      } else if (side === 'bottom') {
        b.y = a.bottom - b.r;
        b.vy = -Math.abs(b.vy) * 0.9;
      } else {
        b.y = a.y + b.r;
        b.vy = Math.abs(b.vy) * 0.9;
      }
    }
  }

  private scored(p: Player, b: Ball): void {
    p.lives--;
    sfx('goal');
    p.livesText.setText('❤️'.repeat(Math.max(0, p.lives)));
    this.cameras.main.shake(150, 0.006);
    this.toast('⚽ GOAL against you!', [p.seat]);
    b.x = this.arena.centerX;
    b.y = this.arena.centerY;
    b.vx = b.vy = 0;
    b.respawn = 1.2;
    b.view.setVisible(false);
    if (p.lives <= 0) {
      p.alive = false;
      p.outAt = this.elapsed;
      p.joy.setEnabled(false);
      this.tweens.add({ targets: p.view, alpha: 0.2, scale: 0.6, duration: 400 });
      this.drawGoal(p.goal, 0, false);
      this.toast('❌ Out! Your goal is closed', [p.seat], 1600);
    }
  }

  private end(): void {
    const scores = this.players2.map((p) => (p.alive ? 1000 + p.lives : p.outAt));
    const stats = this.players2.map((p) => (p.alive ? `${p.lives} ❤️ left` : `out after ${p.outAt.toFixed(0)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
