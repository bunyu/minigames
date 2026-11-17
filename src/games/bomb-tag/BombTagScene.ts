import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, emoji } from '../../engine/character';
import type { Joystick } from '../../engine/joystick';
import { collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const bombTagMeta: GameMeta = {
  id: 'bomb-tag',
  title: 'Bomb Tag',
  icon: '💣',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Got the bomb? Touch someone to pass it! When it explodes, whoever holds it is out.',
  gesture: 'joystick',
  tips: ['💣 Touch = pass it', '💥 BOOM = out', '🏃 Run away!'],
  background: '#2b0f54',
};

const PASS_COOLDOWN = 0.6;

interface Runner extends Body {
  seat: number;
  alive: boolean;
  diedAt: number;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
}

interface Pillar extends Body {}

export class BombTagScene extends BaseGameScene {
  private runners: Runner[] = [];
  private pillars: Pillar[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private holder = -1;
  private fuse = 0;
  private fuseTotal = 1;
  private passCooldown = 0;
  private bomb!: Phaser.GameObjects.Text;
  private ring!: Phaser.GameObjects.Graphics;
  private outCount = 0;

  constructor() {
    super(bombTagMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.arena = this.drawArena(0x3c1874, 0xf72585);
    this.holder = -1;
    this.outCount = 0;
    const a = this.arena;

    // Pillars to dodge around.
    const pr = u * 0.05;
    this.pillars = [
      { x: a.centerX, y: a.centerY, vx: 0, vy: 0, r: pr * 1.2, mass: 1e6 },
      { x: a.x + a.width * 0.25, y: a.centerY, vx: 0, vy: 0, r: pr, mass: 1e6 },
      { x: a.x + a.width * 0.75, y: a.centerY, vx: 0, vy: 0, r: pr, mass: 1e6 },
    ];
    const g = this.add.graphics().setDepth(2);
    for (const p of this.pillars) {
      g.fillStyle(0x7209b7, 1).fillCircle(p.x, p.y, p.r);
      g.lineStyle(4, 0xb5179e, 1).strokeCircle(p.x, p.y, p.r);
    }

    const r = u * 0.036;
    this.runners = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.6);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const joy = this.addJoystick(i, c);
      return { seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1 + p.handicap, alive: true, diedAt: 0, view, joy };
    });
    this.ring = this.add.graphics().setDepth(11);
    this.bomb = emoji(this, 0, 0, '💣', u * 0.055).setDepth(12).setVisible(false);
  }

  protected startGame(): void {
    this.giveBomb();
  }

  private giveBomb(): void {
    const alive = this.runners.filter((r) => r.alive);
    if (alive.length < 2) return;
    this.holder = Phaser.Utils.Array.GetRandom(alive).seat;
    this.fuseTotal = this.fuse = 8 + Math.random() * 6;
    this.passCooldown = PASS_COOLDOWN;
    this.bomb.setVisible(true);
    this.toast('💣 You have the bomb!', [this.holder]);
  }

  protected tick(dt: number): void {
    const speed = this.unit * 0.4;
    for (const p of this.runners) {
      if (!p.alive) continue;
      const boost = p.seat === this.holder ? 1.12 : 1 + this.players[p.seat].handicap;
      steer(p, p.joy.vec.x, p.joy.vec.y, speed * boost, dt);
      keepInside(p, this.arena, 0.3);
      for (const pillar of this.pillars) collide(p, pillar, 0.5);
    }

    this.passCooldown = Math.max(0, this.passCooldown - dt);
    for (let i = 0; i < this.runners.length; i++) {
      for (let j = i + 1; j < this.runners.length; j++) {
        const a = this.runners[i];
        const b = this.runners[j];
        if (!a.alive || !b.alive) continue;
        if (collide(a, b, 1.1) && this.passCooldown <= 0 && (a.seat === this.holder || b.seat === this.holder)) {
          this.holder = a.seat === this.holder ? b.seat : a.seat;
          this.passCooldown = PASS_COOLDOWN;
          sfx('tap');
          this.toast('💣 Tag! You have it!', [this.holder], 900);
        }
      }
    }
    for (const p of this.runners) if (p.alive) p.view.setPosition(p.x, p.y);

    this.ring.clear();
    if (this.holder >= 0) {
      const h = this.runners[this.holder];
      this.fuse -= dt;
      const left = Math.max(0, this.fuse / this.fuseTotal);
      // Pulses faster as the fuse burns down.
      const pulse = 1 + 0.15 * Math.sin(this.elapsed * (6 + (1 - left) * 30));
      this.bomb.setPosition(h.x, h.y - h.r * 1.6).setScale(pulse);
      this.ring.lineStyle(this.unit * 0.008, left < 0.3 ? 0xff0054 : 0xffd166, 1);
      this.ring.beginPath();
      this.ring.arc(h.x, h.y, h.r * 1.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      this.ring.strokePath();
      if (this.fuse <= 0) this.explode(h);
    }
  }

  private explode(h: Runner): void {
    this.holder = -1;
    sfx('boom');
    this.bomb.setVisible(false);
    h.alive = false;
    h.diedAt = ++this.outCount;
    h.joy.setEnabled(false);
    this.cameras.main.shake(250, 0.012);
    const blast = this.add.circle(h.x, h.y, h.r, 0xff9e00).setDepth(30);
    this.tweens.add({ targets: blast, radius: this.unit * 0.22, alpha: 0, duration: 500, onComplete: () => blast.destroy() });
    this.tweens.add({ targets: h.view, alpha: 0.2, scale: 0.6, duration: 400 });
    // Blast pushes everyone away.
    for (const p of this.runners) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - h.x, p.y - h.y) || 1;
      const force = (this.unit * 1.2) / Math.max(1, d / (this.unit * 0.1));
      p.vx += ((p.x - h.x) / d) * force;
      p.vy += ((p.y - h.y) / d) * force;
    }
    this.toast('💥 BOOM! You are out', [h.seat]);

    if (this.runners.filter((r) => r.alive).length <= 1) {
      this.time.delayedCall(600, () => this.end());
    } else {
      this.time.delayedCall(1500, () => this.playing && this.giveBomb());
    }
  }

  private end(): void {
    // Survivors rank first; earlier explosions rank lower.
    const scores = this.runners.map((p) => (p.alive ? 1000 : p.diedAt));
    const stats = this.runners.map((p) => (p.alive ? 'never exploded' : `exploded #${p.diedAt}`));
    this.finish(placementsFromScores(scores), stats);
  }
}
