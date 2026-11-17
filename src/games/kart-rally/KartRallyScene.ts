import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, emoji, label } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import { collide, keepInside, type Body } from '../../engine/physics';
import type { GameMeta } from '../types';
import { StadiumTrack } from './track';

export const kartRallyMeta: GameMeta = {
  id: 'kart-rally',
  title: 'Kart Rally',
  icon: '🏎️',
  controls: 'L/R',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 75,
  howToPlay: 'HOLD ◀ or ▶ to steer. Stay on the road, drive over ⚡ boosts, avoid the oil! First to finish 3 laps wins.',
  gesture: 'lr',
  tips: ['◀ ▶ Hold to steer', '⚡ Boost!   ⚫ Oil = spin', '🏁 3 laps'],
  background: '#2d6a4f',
};

const LAPS = 3;
const TIME_LIMIT = 110;

interface Kart extends Body {
  seat: number;
  heading: number;
  speed: number;
  progress: number; // total distance along the track since the start
  lastS: number;
  boost: number;
  spin: number;
  slickImmune: number;
  finishedAt: number; // order of finishing, 0 = still racing
  car: Phaser.GameObjects.Container;
  rider: Phaser.GameObjects.Container;
  left: TouchButton;
  right: TouchButton;
  lapText: Phaser.GameObjects.Text;
}

interface Pad {
  x: number;
  y: number;
  r: number;
  kind: 'boost' | 'oil';
}

export class KartRallyScene extends BaseGameScene {
  private track!: StadiumTrack;
  private karts: Kart[] = [];
  private pads: Pad[] = [];
  private bounds!: Phaser.Geom.Rectangle;
  private finishers = 0;
  private firstFinishAt = 0;
  private updateTimer!: () => void;

  constructor() {
    super(kartRallyMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const { width, height } = this.scale;
    const top = height * 0.19;
    const bottom = height * 0.81;
    const cy = height / 2;
    const outer = (bottom - top) / 2;
    const inner = outer - u * 0.17;
    const margin = width * 0.03;
    this.track = new StadiumTrack(margin + outer, width - margin - outer, cy, inner, outer);
    this.bounds = new Phaser.Geom.Rectangle(0, top - u * 0.03, width, bottom - top + u * 0.06);
    this.finishers = 0;
    this.firstFinishAt = 0;
    this.updateTimer = this.addTimer(TIME_LIMIT);
    const t = this.track;

    // Road, island and kerbs.
    const g = this.add.graphics();
    g.fillStyle(0x40916c, 1).fillRect(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    g.fillStyle(0x495057, 1).fillRoundedRect(t.x1 - outer, cy - outer, t.straight + outer * 2, outer * 2, outer);
    g.fillStyle(0x52b788, 1).fillRoundedRect(t.x1 - inner, cy - inner, t.straight + inner * 2, inner * 2, inner);
    g.lineStyle(u * 0.008, 0xffffff, 0.9);
    g.strokeRoundedRect(t.x1 - outer, cy - outer, t.straight + outer * 2, outer * 2, outer);
    g.strokeRoundedRect(t.x1 - inner, cy - inner, t.straight + inner * 2, inner * 2, inner);
    // Dashed centre line on the straights.
    g.lineStyle(u * 0.004, 0xffffff, 0.35);
    for (let x = t.x1; x < t.x2; x += u * 0.06) {
      g.lineBetween(x, cy + t.mid, x + u * 0.03, cy + t.mid);
      g.lineBetween(x, cy - t.mid, x + u * 0.03, cy - t.mid);
    }
    // Chequered start/finish line in the middle of the bottom straight.
    const startX = (t.x1 + t.x2) / 2;
    const sq = (outer - inner) / 8;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle((i + j) % 2 ? 0x000000 : 0xffffff, 1).fillRect(startX + j * sq, cy + inner + i * sq, sq, sq);
      }

    // Boost pads and oil slicks along the centre line.
    const P = t.perimeter;
    const startS = t.progressAt(startX, cy + t.mid);
    this.pads = [
      { s: startS + P * 0.18, kind: 'boost' as const, off: 0.3 },
      { s: startS + P * 0.5, kind: 'boost' as const, off: -0.3 },
      { s: startS + P * 0.33, kind: 'oil' as const, off: -0.25 },
      { s: startS + P * 0.68, kind: 'oil' as const, off: 0.25 },
      { s: startS + P * 0.85, kind: 'boost' as const, off: 0 },
    ].map(({ s, kind, off }) => {
      const p = t.pointAt(s);
      // Shift sideways across the road (perpendicular to the heading).
      const lateral = off * (outer - inner);
      const x = p.x + Math.cos(p.heading + Math.PI / 2) * lateral;
      const y = p.y + Math.sin(p.heading + Math.PI / 2) * lateral;
      return { x, y, r: u * 0.035, kind };
    });
    for (const p of this.pads) {
      if (p.kind === 'boost') {
        g.fillStyle(0xffd60a, 0.85).fillCircle(p.x, p.y, p.r);
        emoji(this, p.x, p.y, '⚡', p.r * 1.3).setDepth(1);
      } else {
        g.fillStyle(0x111111, 0.9).fillEllipse(p.x, p.y, p.r * 2.4, p.r * 1.6);
        g.fillStyle(0x5a189a, 0.5).fillEllipse(p.x - p.r * 0.3, p.y - p.r * 0.2, p.r * 0.9, p.r * 0.5);
      }
    }

    const r = u * 0.024;
    const lane = (outer - inner) / 4;
    this.karts = this.players.map((pl, i) => {
      const x = startX - u * 0.05 - Math.floor(i / 2) * u * 0.09;
      const y = cy + inner + lane * (i % 2 === 0 ? 1.2 : 2.8);
      const car = this.add.container(x, y).setDepth(10);
      const cg = this.add.graphics();
      cg.fillStyle(0x111111, 1).fillRect(-r * 1.3, -r * 1.05, r * 0.7, r * 0.35).fillRect(r * 0.6, -r * 1.05, r * 0.7, r * 0.35);
      cg.fillRect(-r * 1.3, r * 0.7, r * 0.7, r * 0.35).fillRect(r * 0.6, r * 0.7, r * 0.7, r * 0.35);
      cg.fillStyle(pl.color, 1).fillRoundedRect(-r * 1.5, -r * 0.75, r * 3, r * 1.5, r * 0.5);
      cg.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(-r * 1.5, -r * 0.75, r * 3, r * 1.5, r * 0.5);
      car.add(cg);
      const rider = addCharacter(this, x, y, pl, r * 1.5).setDepth(11);

      const z = this.zones[i];
      const c = this.zoneContainer(i).setDepth(50);
      const br = u * 0.075;
      const by = z.h / 2 - br - u * 0.02;
      const bx = Math.min(z.w / 2 - br - u * 0.03, br * 3.2);
      const left = new TouchButton(this, c, -bx, by, br, pl.color, '◀', 0.9);
      const right = new TouchButton(this, c, bx, by, br, pl.color, '▶', 0.9);
      const lapText = label(this, 0, by, `Lap 1/${LAPS}`, u * 0.04);
      c.add(lapText);
      const s0 = t.progressAt(x, y);
      return {
        seat: i, x, y, vx: 0, vy: 0, r: r * 1.2, mass: 1, heading: 0, speed: 0, progress: 0, lastS: s0,
        boost: 0, spin: 0, slickImmune: 0, finishedAt: 0, car, rider, left, right, lapText,
      };
    });
  }

  protected startGame(): void {}

  protected tick(dt: number): void {
    this.updateTimer();
    const u = this.unit;
    const t = this.track;
    for (const k of this.karts) {
      if (k.finishedAt) continue;
      const handicap = 1 + this.players[k.seat].handicap;
      k.boost = Math.max(0, k.boost - dt);
      k.slickImmune = Math.max(0, k.slickImmune - dt);
      const onRoad = t.onRoad(k.x, k.y);
      let max = u * (onRoad ? 0.46 : 0.17) * handicap;
      if (k.boost > 0) max *= 1.55;
      if (k.spin > 0) {
        k.spin -= dt;
        k.heading += 10 * dt;
        max *= 0.35;
      } else {
        const steer = (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0);
        k.heading += steer * 2.9 * dt;
      }
      // Accelerate toward max speed, brake quickly when off the road.
      k.speed += (max - k.speed) * Math.min(1, (k.speed < max ? 1.6 : 5) * dt);
      k.vx = Math.cos(k.heading) * k.speed;
      k.vy = Math.sin(k.heading) * k.speed;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      keepInside(k, this.bounds);

      for (const p of this.pads) {
        if (Math.hypot(p.x - k.x, p.y - k.y) > p.r + k.r * 0.5) continue;
        if (p.kind === 'boost' && k.boost <= 0) {
          k.boost = 1.1;
          sfx('boost');
          this.tweens.add({ targets: k.car, scale: { from: 1.35, to: 1 }, duration: 300 });
        } else if (p.kind === 'oil' && k.slickImmune <= 0) {
          k.spin = 0.8;
          sfx('out');
          k.slickImmune = 2;
        }
      }
    }
    const racing = this.karts.filter((k) => !k.finishedAt);
    for (let i = 0; i < racing.length; i++)
      for (let j = i + 1; j < racing.length; j++) {
        const a = racing[i];
        const b = racing[j];
        if (collide(a, b, 0.6)) {
          a.speed = Math.min(a.speed, Math.hypot(a.vx, a.vy));
          b.speed = Math.min(b.speed, Math.hypot(b.vx, b.vy));
        }
      }

    for (const k of this.karts) {
      k.car.setPosition(k.x, k.y).setRotation(k.heading);
      k.rider.setPosition(k.x, k.y);
      if (k.finishedAt) continue;
      const s = t.progressAt(k.x, k.y);
      k.progress += t.delta(k.lastS, s);
      k.lastS = s;
      const lap = Math.min(LAPS, Math.floor(Math.max(0, k.progress) / t.perimeter) + 1);
      k.lapText.setText(`Lap ${lap}/${LAPS}`);
      if (k.progress >= t.perimeter * LAPS) this.finishKart(k);
    }

    const allDone = this.karts.every((k) => k.finishedAt);
    const graceOver = this.firstFinishAt > 0 && this.elapsed - this.firstFinishAt > 12;
    if (allDone || graceOver || this.elapsed >= TIME_LIMIT) this.end();
  }

  private finishKart(k: Kart): void {
    k.finishedAt = ++this.finishers;
    sfx('goal');
    if (k.finishedAt === 1) {
      this.firstFinishAt = this.elapsed;
      this.toast(`🏁 ${this.players[k.seat].name} wins the race!`, undefined, 1800);
    }
    k.lapText.setText(`🏁 #${k.finishedAt}`);
    k.left.setEnabled(false);
    k.right.setEnabled(false);
    this.tweens.add({ targets: [k.car, k.rider], alpha: 0.5, duration: 300 });
  }

  private end(): void {
    const scores = this.karts.map((k) => (k.finishedAt ? 1e6 - k.finishedAt : k.progress));
    const laps = (k: Kart) => (k.progress / this.track.perimeter).toFixed(1);
    const stats = this.karts.map((k) => (k.finishedAt ? `finished #${k.finishedAt}` : `${laps(k)} laps`));
    this.finish(placementsFromScores(scores), stats);
  }
}
