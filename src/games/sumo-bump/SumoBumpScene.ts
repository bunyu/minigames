import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import type { GameMeta } from '../types';

export const sumoBumpMeta: GameMeta = {
  id: 'sumo-bump',
  title: 'Sumo Bump',
  icon: '🤼',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Your fighter spins. Tap to DASH where the arrow points. Bump everyone off the ice!',
  gesture: 'tap',
  tips: ['💨 Tap = DASH', '💥 Bump others off', '🧊 The ice shrinks!'],
  background: '#0b2545',
};

const DASH_COOLDOWN = 0.6;
const SHRINK_START = 8; // seconds
const TIME_LIMIT = 90;

interface Sumo {
  seat: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spinDir: number;
  mass: number;
  cooldown: number;
  alive: boolean;
  outAt: number;
  body: Phaser.GameObjects.Container;
  arrow: Phaser.GameObjects.Graphics;
  button: TouchButton;
}

export class SumoBumpScene extends BaseGameScene {
  private sumos: Sumo[] = [];
  private arena!: Phaser.GameObjects.Graphics;
  private cx = 0;
  private cy = 0;
  private r0 = 0;
  private radius = 0;
  private sumoR = 0;

  constructor() {
    super(sumoBumpMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;
    this.r0 = this.radius = u * 0.43;
    this.sumoR = u * 0.05;
    this.arena = this.add.graphics();
    this.drawRing();

    this.sumos = this.players.map((p, i) => {
      // Start between the centre and the player's own zone, facing the centre.
      const z = this.zones[i];
      const dir = Math.atan2(z.cy - this.cy, z.cx - this.cx);
      const x = this.cx + Math.cos(dir) * this.r0 * 0.4;
      const y = this.cy + Math.sin(dir) * this.r0 * 0.4;
      const body = this.add.container(x, y).setDepth(10);
      const arrow = this.add.graphics();
      arrow.fillStyle(0xffffff, 0.95);
      arrow.fillTriangle(this.sumoR * 1.25, -this.sumoR * 0.4, this.sumoR * 1.25, this.sumoR * 0.4, this.sumoR * 1.9, 0);
      body.add([arrow, addCharacter(this, 0, 0, p, this.sumoR * 2)]);

      const c = this.zoneContainer(i).setDepth(50);
      const r = u * 0.1;
      const pos = this.outerCorner(i, r);
      const button = new TouchButton(this, c, pos.x, pos.y, r, p.color, 'DASH');
      const sumo: Sumo = {
        seat: i,
        x,
        y,
        vx: 0,
        vy: 0,
        angle: dir + Math.PI,
        spinDir: i % 2 === 0 ? 1 : -1,
        mass: 1 + p.handicap * 2,
        cooldown: 0,
        alive: true,
        outAt: 0,
        body,
        arrow,
        button,
      };
      button.onPress = () => this.dash(sumo);
      return sumo;
    });
    this.sumos.forEach((s) => (s.arrow.rotation = s.angle));
  }

  protected startGame(): void {}

  private drawRing(): void {
    const g = this.arena.clear();
    g.fillStyle(0x13315c, 1).fillCircle(this.cx, this.cy, this.r0 * 1.02);
    g.fillStyle(0xd7ecff, 1).fillCircle(this.cx, this.cy, this.radius);
    g.lineStyle(this.unit * 0.012, 0xef233c, 1).strokeCircle(this.cx, this.cy, this.radius);
    g.lineStyle(this.unit * 0.004, 0x8ecae6, 1).strokeCircle(this.cx, this.cy, this.radius * 0.35);
  }

  private dash(s: Sumo): void {
    if (!this.playing || !s.alive || s.cooldown > 0) return;
    // With friction k≈2, one dash from rest glides ~power/k ≈ 0.21 × unit (≈ half the mat radius).
    const power = this.unit * 0.42;
    s.vx += Math.cos(s.angle) * power;
    s.vy += Math.sin(s.angle) * power;
    s.cooldown = DASH_COOLDOWN;
    s.button.flash();
    sfx('tap');
  }

  protected tick(dt: number): void {
    // Arena shrinks after a few seconds, spinning speeds up: no camping in the middle.
    const t = this.elapsed;
    if (t > SHRINK_START) {
      this.radius = this.r0 * Math.max(0.4, 1 - (t - SHRINK_START) * 0.012);
      this.drawRing();
    }
    const spin = 3 + Math.min(2, t * 0.03);
    const friction = Math.exp(-2 * dt);

    for (const s of this.sumos) {
      if (!s.alive) continue;
      s.angle += spin * s.spinDir * dt;
      s.arrow.rotation = s.angle;
      s.cooldown = Math.max(0, s.cooldown - dt);
      s.button.setCharge(1 - s.cooldown / DASH_COOLDOWN);
      s.vx *= friction;
      s.vy *= friction;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.collide();

    for (const s of this.sumos) {
      if (!s.alive) continue;
      s.body.setPosition(s.x, s.y);
      if (Math.hypot(s.x - this.cx, s.y - this.cy) > this.radius) this.knockOut(s);
    }

    const alive = this.sumos.filter((s) => s.alive);
    if (alive.length <= 1 || t >= TIME_LIMIT) this.end();
  }

  private collide(): void {
    const min = this.sumoR * 2;
    for (let i = 0; i < this.sumos.length; i++) {
      for (let j = i + 1; j < this.sumos.length; j++) {
        const a = this.sumos[i];
        const b = this.sumos[j];
        if (!a.alive || !b.alive) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d >= min) continue;
        dx /= d;
        dy /= d;
        // Separate.
        const overlap = (min - d) / 2;
        a.x -= dx * overlap;
        a.y -= dy * overlap;
        b.x += dx * overlap;
        b.y += dy * overlap;
        // Bouncy impulse along the normal.
        const approach = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
        if (approach <= 0) continue;
        const restitution = 1.05;
        const jImpulse = ((1 + restitution) * approach) / (1 / a.mass + 1 / b.mass);
        a.vx -= (jImpulse / a.mass) * dx;
        a.vy -= (jImpulse / a.mass) * dy;
        b.vx += (jImpulse / b.mass) * dx;
        b.vy += (jImpulse / b.mass) * dy;
        this.cameras.main.shake(80, 0.004);
        sfx('bounce');
      }
    }
  }

  private knockOut(s: Sumo): void {
    s.alive = false;
    sfx('out');
    s.outAt = this.elapsed;
    s.button.setEnabled(false).setText('OUT');
    s.button.setCharge(1);
    s.arrow.setVisible(false);
    this.tweens.add({ targets: s.body, scale: 0.2, alpha: 0, angle: 360, duration: 600 });
    this.toast('💦 Splash! You are out', [s.seat]);
  }

  private end(): void {
    // Survivors beat anyone knocked out; among survivors, closest to the centre wins.
    const scores = this.sumos.map((s) =>
      s.alive ? 1000 + (this.radius - Math.hypot(s.x - this.cx, s.y - this.cy)) : s.outAt,
    );
    const stats = this.sumos.map((s) => (s.alive ? 'last one standing' : `out after ${s.outAt.toFixed(1)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
