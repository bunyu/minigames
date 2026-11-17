import Phaser from 'phaser';
import { note, sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, emoji, label } from '../../engine/character';
import type { Joystick } from '../../engine/joystick';
import { collide, keepInside, steer, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';

export const chairDashMeta: GameMeta = {
  id: 'chair-dash',
  title: 'Chair Dash',
  icon: '🪑',
  controls: 'joystick',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Dance around while the music plays. When it stops, chairs appear – run and sit! No chair = you are out.',
  gesture: 'joystick',
  tips: ['🎵 Dance around', '🪑 Music stops = SIT!', '❌ No chair = out'],
  background: '#5f0f40',
};

const MELODY = [523, 587, 659, 523, 659, 698, 784, 698, 659, 587, 523, 587];

interface Dancer extends Body {
  seat: number;
  alive: boolean;
  outRound: number;
  chair: Chair | null;
  view: Phaser.GameObjects.Container;
  joy: Joystick;
}

interface Chair {
  x: number;
  y: number;
  taken: Dancer | null;
  view: Phaser.GameObjects.Text;
}

export class ChairDashScene extends BaseGameScene {
  private dancers: Dancer[] = [];
  private chairs: Chair[] = [];
  private arena!: Phaser.Geom.Rectangle;
  private phase: 'music' | 'scramble' | 'pause' = 'pause';
  private phaseT = 0;
  private noteT = 0;
  private noteI = 0;
  private round = 0;
  private banners: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(chairDashMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const a = (this.arena = this.drawArena(0x9a031e, 0xfb8b24));
    this.chairs = [];
    this.round = 0;
    this.phase = 'pause';
    // Dance-floor squares.
    const floor = this.add.graphics().setDepth(1);
    const sq = u * 0.1;
    for (let x = a.x; x < a.right; x += sq)
      for (let y = a.y; y < a.bottom; y += sq) {
        if ((Math.round((x - a.x) / sq) + Math.round((y - a.y) / sq)) % 2) floor.fillStyle(0xffffff, 0.06).fillRect(x, y, sq, sq);
      }
    this.banners = [
      label(this, a.centerX, a.centerY + u * 0.12, '', u * 0.06).setDepth(30),
      label(this, a.centerX, a.centerY - u * 0.12, '', u * 0.06).setDepth(30).setRotation(Math.PI),
    ];

    const r = u * 0.034;
    this.dancers = this.players.map((p, i) => {
      const s = this.seatStart(i, 0.5);
      const view = addCharacter(this, s.x, s.y, p, r * 2).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const joy = this.addJoystick(i, c);
      return { seat: i, x: s.x, y: s.y, vx: 0, vy: 0, r, mass: 1, alive: true, outRound: 0, chair: null, view, joy };
    });
  }

  protected startGame(): void {
    this.startMusic();
  }

  private say(text: string): void {
    for (const b of this.banners) b.setText(text);
  }

  private startMusic(): void {
    this.round++;
    this.phase = 'music';
    this.phaseT = 3 + Math.random() * 4;
    this.noteT = 0;
    for (const c of this.chairs) c.view.destroy();
    this.chairs = [];
    for (const d of this.dancers) {
      d.chair = null;
      d.mass = 1;
    }
    this.say('🎵 Dance! 🎵');
  }

  private stopMusic(): void {
    this.phase = 'scramble';
    this.phaseT = 10;
    this.say('🪑 SIT DOWN!');
    sfx('go');
    const u = this.unit;
    const a = this.arena;
    const alive = this.dancers.filter((d) => d.alive);
    const count = alive.length - 1;
    for (let i = 0; i < count; i++) {
      let x = a.centerX;
      let y = a.centerY;
      for (let tries = 0; tries < 30; tries++) {
        x = a.x + u * 0.08 + Math.random() * (a.width - u * 0.16);
        y = a.y + u * 0.08 + Math.random() * (a.height - u * 0.16);
        const farFromChairs = this.chairs.every((c) => Math.hypot(c.x - x, c.y - y) > u * 0.2);
        const notOnTop = alive.every((d) => Math.hypot(d.x - x, d.y - y) > u * 0.1);
        if (farFromChairs && notOnTop) break;
      }
      const view = emoji(this, x, y, '🪑', u * 0.07).setDepth(5);
      this.tweens.add({ targets: view, scale: { from: 0, to: 1 }, duration: 250, ease: 'Back.Out' });
      this.chairs.push({ x, y, taken: null, view });
    }
  }

  protected tick(dt: number): void {
    const u = this.unit;
    this.phaseT -= dt;

    if (this.phase === 'music') {
      this.noteT -= dt;
      if (this.noteT <= 0) {
        note(MELODY[this.noteI++ % MELODY.length]);
        this.noteT = 0.24;
      }
      if (this.phaseT <= 0) this.stopMusic();
    } else if (this.phase === 'pause' && this.phaseT <= 0) {
      this.startMusic();
    }

    const alive = this.dancers.filter((d) => d.alive);
    for (const d of alive) {
      if (d.chair) continue;
      steer(d, d.joy.vec.x, d.joy.vec.y, u * 0.4 * (1 + this.players[d.seat].handicap), dt);
      keepInside(d, this.arena, 0.3);
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j], 1.1);
    for (const d of alive) {
      if (d.chair) {
        d.x = d.chair.x;
        d.y = d.chair.y;
      }
      d.view.setPosition(d.x, d.y);
    }

    if (this.phase === 'scramble') {
      for (const c of this.chairs) {
        if (c.taken) continue;
        const sitter = alive.find((d) => !d.chair && Math.hypot(d.x - c.x, d.y - c.y) < d.r + u * 0.03);
        if (sitter) {
          c.taken = sitter;
          sitter.chair = c;
          sitter.mass = 1e6; // seated players can't be pushed off
          sitter.vx = sitter.vy = 0;
          sfx('coin');
        }
      }
      const standing = alive.filter((d) => !d.chair);
      if (this.chairs.every((c) => c.taken) || this.phaseT <= 0) {
        // Normally exactly one player is left standing; on timeout the farthest from a free chair loses.
        const free = this.chairs.filter((c) => !c.taken);
        const dist = (d: Dancer) => Math.min(...free.map((c) => Math.hypot(c.x - d.x, c.y - d.y)), Infinity);
        const loser = standing.sort((p, q) => (Number.isFinite(dist(q)) ? dist(q) - dist(p) : 0))[0];
        if (loser) this.knockOut(loser);
        this.phase = 'pause';
        this.phaseT = 1.6;
        if (this.dancers.filter((d) => d.alive).length <= 1) this.end();
      }
    }
  }

  private knockOut(d: Dancer): void {
    d.alive = false;
    d.outRound = this.round;
    d.joy.setEnabled(false);
    sfx('out');
    this.say(`😢 ${this.players[d.seat].name} is out!`);
    this.tweens.add({ targets: d.view, alpha: 0.2, scale: 0.6, duration: 400 });
    this.toast('🪑 No chair for you!', [d.seat]);
  }

  private end(): void {
    const scores = this.dancers.map((d) => (d.alive ? 1000 : d.outRound));
    const stats = this.dancers.map((d) => (d.alive ? 'always found a chair' : `out in round ${d.outRound}`));
    this.finish(placementsFromScores(scores), stats);
  }
}
