import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, label } from '../../engine/character';
import type { TouchButton } from '../../engine/controls';
import type { Joystick } from '../../engine/joystick';
import { collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const kingOfTheHillMeta: GameMeta = {
  id: 'king-of-the-hill',
  title: 'King of the Hill',
  icon: '👑',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Stand inside the glowing circle ALONE to score points. Tap DASH to knock the others out of it!',
  gesture: 'joystick-button',
  tips: ['👑 Stand in the circle ALONE', '💨 DASH to push', '⏱️ Most time wins'],
  background: '#370617',
};

const TIME_LIMIT = 60;
const DASH_COOLDOWN = 1.2;

interface Climber extends Body {
  seat: number;
  score: number;
  cooldown: number;
  dashing: number;
  facing: number;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
  button: TouchButton;
  scoreText: Phaser.GameObjects.Text;
}

export class KingOfTheHillScene extends BaseGameScene {
  private climbers: Climber[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private hill = { x: 0, y: 0, r: 0, tx: 0, ty: 0, moveIn: 0 };
  private hillGfx!: Phaser.GameObjects.Graphics;
  private crown!: Phaser.GameObjects.Text;
  private updateTimer!: () => void;

  constructor() {
    super(kingOfTheHillMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const a = (this.arena = this.drawArena(0x6a040f, 0xffba08));
    this.updateTimer = this.addTimer(TIME_LIMIT);
    this.hill = { x: a.centerX, y: a.centerY, r: u * 0.11, tx: a.centerX, ty: a.centerY, moveIn: 5 };
    this.hillGfx = this.add.graphics().setDepth(2);
    this.crown = label(this, a.centerX, a.centerY, '👑', u * 0.06).setDepth(3).setAlpha(0.5);

    const r = u * 0.034;
    this.climbers = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.75);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const { joy, button } = this.addJoystickAndButton(i, c, 'DASH');
      const scoreText = label(this, button.root.x, button.root.y - button.radius - u * 0.04, '0.0', u * 0.04);
      c.add(scoreText);
      const climber: Climber = {
        seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1 + p.handicap * 2, score: 0, cooldown: 0, dashing: 0,
        facing: s.facing, view, joy, button, scoreText,
      };
      button.onPress = () => this.dash(climber);
      return climber;
    });
  }

  protected startGame(): void {}

  private dash(c: Climber): void {
    if (!this.playing || c.cooldown > 0) return;
    c.cooldown = DASH_COOLDOWN;
    sfx('tap');
    c.dashing = 0.35;
    const power = this.unit * 1.1;
    c.vx = Math.cos(c.facing) * power;
    c.vy = Math.sin(c.facing) * power;
    c.button.flash();
  }

  protected tick(dt: number): void {
    this.updateTimer();
    const u = this.unit;
    const a = this.arena;
    const h = this.hill;

    // The hill wanders to a new spot every few seconds and slowly shrinks.
    h.moveIn -= dt;
    if (h.moveIn <= 0) {
      h.tx = a.x + h.r + Math.random() * (a.width - h.r * 2);
      h.ty = a.y + h.r + Math.random() * (a.height - h.r * 2);
      h.moveIn = 5 + Math.random() * 3;
    }
    const dx = h.tx - h.x;
    const dy = h.ty - h.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, u * 0.14 * dt);
    if (d > 0) {
      h.x += (dx / d) * step;
      h.y += (dy / d) * step;
    }
    h.r = u * Math.max(0.075, 0.11 - this.elapsed * 0.0006);

    const speed = u * 0.4;
    for (const c of this.climbers) {
      c.cooldown = Math.max(0, c.cooldown - dt);
      c.dashing = Math.max(0, c.dashing - dt);
      c.button.setCharge(1 - c.cooldown / DASH_COOLDOWN);
      const v = c.joy.vec;
      if (v.lengthSq() > 0.04) c.facing = Math.atan2(v.y, v.x);
      // While dashing, the joystick barely changes the motion.
      steer(c, v.x, v.y, speed * (1 + this.players[c.seat].handicap), dt, c.dashing > 0 ? 1 : 10);
      keepInside(c, a, 0.5);
    }
    for (let i = 0; i < this.climbers.length; i++)
      for (let j = i + 1; j < this.climbers.length; j++) collide(this.climbers[i], this.climbers[j], 1.2);

    const inside = this.climbers.filter((c) => Math.hypot(c.x - h.x, c.y - h.y) < h.r);
    const king = inside.length === 1 ? inside[0] : null;
    if (king) {
      king.score += dt;
      king.scoreText.setText(king.score.toFixed(1));
    }
    for (const c of this.climbers) c.view.setPosition(c.x, c.y);

    const color = king ? this.players[king.seat].color : 0xffffff;
    const pulse = 0.5 + 0.2 * Math.sin(this.elapsed * 6);
    this.hillGfx.clear();
    this.hillGfx.fillStyle(color, king ? 0.55 : inside.length > 1 ? 0.25 : pulse * 0.4).fillCircle(h.x, h.y, h.r);
    this.hillGfx.lineStyle(u * 0.008, king ? color : 0xffba08, 1).strokeCircle(h.x, h.y, h.r);
    this.crown.setPosition(h.x, h.y).setAlpha(king ? 0 : 0.5);

    if (this.elapsed >= TIME_LIMIT) this.end();
  }

  private end(): void {
    // Round to tenths so tiny float differences don't decide ties.
    const scores = this.climbers.map((c) => Math.round(c.score * 10));
    this.finish(placementsFromScores(scores), this.climbers.map((c) => `${c.score.toFixed(1)} s on the hill`));
  }
}
