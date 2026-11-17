import Phaser from 'phaser';
import type { Placements } from '../core/scoring';
import type { GameMeta, GameResult, GameSceneData, SeatPlayer } from '../games/types';
import { addCharacter, label } from './character';
import { TouchButton } from './controls';
import { Joystick } from './joystick';
import { computeZones, type Zone } from './zones';

/**
 * Common lifecycle for every mini game:
 *   intro (each player taps READY) → 3-2-1 countdown → play → finish(placements) → back to the shell.
 *
 * Subclasses implement `buildGame` (create objects, controls) and `startGame` (begin the action),
 * update themselves in `tick` while `playing` is true, and call `finish` exactly once.
 */
export abstract class BaseGameScene extends Phaser.Scene {
  protected players!: SeatPlayer[];
  protected meta!: GameMeta;
  protected zones!: Zone[];
  protected playing = false;
  /** Seconds since GO. */
  protected elapsed = 0;
  private finished = false;
  private onFinish!: (r: GameResult | null) => void;

  init(data: GameSceneData): void {
    this.players = data.players;
    this.meta = data.meta;
    this.onFinish = data.onFinish;
    this.playing = false;
    this.finished = false;
    this.elapsed = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    this.zones = computeZones(width, height, this.players.length);
    this.cameras.main.setBackgroundColor(this.meta.background);
    this.buildGame();
    this.addQuitButton();
    this.showIntro();
  }

  update(_time: number, deltaMs: number): void {
    if (!this.playing) return;
    const dt = Math.min(deltaMs, 50) / 1000; // clamp big frame gaps
    this.elapsed += dt;
    this.tick(dt);
  }

  protected abstract buildGame(): void;
  protected abstract startGame(): void;
  protected tick(_dt: number): void {}

  /** Shortest screen side, the unit for sizing things consistently on any device. */
  protected get unit(): number {
    return Math.min(this.scale.width, this.scale.height);
  }

  /** A container centred on a player's zone, rotated so local +y points toward that player. */
  protected zoneContainer(seat: number): Phaser.GameObjects.Container {
    const z = this.zones[seat];
    return this.add.container(z.cx, z.cy).setRotation(z.rotation);
  }

  /** Point in screen space for local zone coordinates (lx, ly). */
  protected zonePoint(seat: number, lx: number, ly: number): Phaser.Math.Vector2 {
    const z = this.zones[seat];
    const s = z.rotation === 0 ? 1 : -1;
    return new Phaser.Math.Vector2(z.cx + lx * s, z.cy + ly * s);
  }

  /**
   * Local position (inside zoneContainer) for a control of radius r in the zone's outer
   * bottom corner – away from the centre of the screen where the action usually is.
   */
  protected outerCorner(seat: number, r: number, margin = this.unit * 0.025): { x: number; y: number } {
    const z = this.zones[seat];
    const mid = this.scale.width / 2;
    const screenDir = z.cx < mid - 1 ? -1 : z.cx > mid + 1 ? 1 : 0;
    const lx = screenDir === 0 ? 1 : screenDir * (z.rotation === 0 ? 1 : -1);
    return { x: lx * (z.w / 2 - r - margin), y: z.h / 2 - r - margin };
  }

  /**
   * Playing field for arena games: the screen minus two side columns where the
   * corner controls live, so nobody's hand covers the action.
   */
  protected arenaRect(): Phaser.Geom.Rectangle {
    const u = this.unit;
    const side = u * 0.25;
    const pad = u * 0.03;
    return new Phaser.Geom.Rectangle(side, pad, this.scale.width - side * 2, this.scale.height - pad * 2);
  }

  /** Arena floor plus opaque side panels drawn above flying objects (depth 40). */
  protected drawArena(floor: number, edge: number): Phaser.Geom.Rectangle {
    const a = this.arenaRect();
    const { width, height } = this.scale;
    const bg = this.cameras.main.backgroundColor.color;
    this.add.rectangle(a.x, a.y, a.width, a.height, floor).setOrigin(0).setDepth(0);
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(bg, 1);
    g.fillRect(0, 0, a.x, height);
    g.fillRect(a.right, 0, width - a.right, height);
    g.fillRect(0, 0, width, a.y);
    g.fillRect(0, a.bottom, width, height - a.bottom);
    g.lineStyle(this.unit * 0.01, edge, 1).strokeRect(a.x, a.y, a.width, a.height);
    return a;
  }

  /** Start position for a seat inside the arena, toward that player's corner. */
  protected seatStart(seat: number, frac = 0.6): { x: number; y: number; facing: number } {
    const a = this.arenaRect();
    const z = this.zones[seat];
    const sx = Math.sign(Math.round(z.cx - a.centerX));
    const sy = Math.sign(Math.round(z.cy - a.centerY));
    const x = a.centerX + sx * (a.width / 2) * frac;
    const y = a.centerY + sy * (a.height / 2) * frac;
    return { x, y, facing: Math.atan2(a.centerY - y, a.centerX - x) };
  }

  /** A joystick in the seat's outer corner. */
  protected addJoystick(seat: number, parent: Phaser.GameObjects.Container): Joystick {
    const r = this.unit * 0.09;
    const pos = this.outerCorner(seat, r);
    const screen = this.zonePoint(seat, pos.x, pos.y);
    return new Joystick(this, parent, pos.x, pos.y, screen.x, screen.y, this.zones[seat].rotation !== 0, r, this.players[seat].color);
  }

  /** Show a short message in each player's zone (rotated toward them). */
  protected toast(text: string, seats: number[] = this.players.map((p) => p.seat), ms = 1200): void {
    for (const seat of seats) {
      const c = this.zoneContainer(seat).setDepth(150);
      const t = label(this, 0, -this.zones[seat].h * 0.1, text, this.unit * 0.06);
      c.add(t);
      this.tweens.add({ targets: c, alpha: { from: 1, to: 0 }, delay: ms * 0.6, duration: ms * 0.4, onComplete: () => c.destroy() });
    }
  }

  protected finish(placements: Placements, stats?: string[]): void {
    if (this.finished) return;
    this.finished = true;
    this.playing = false;
    this.zones.forEach((z, i) => {
      const c = this.zoneContainer(i).setDepth(300);
      const place = placements[i];
      const text = place === 1 ? '🏆 WINNER!' : `#${place}`;
      const t = label(this, 0, z.h * 0.05, text, this.unit * (place === 1 ? 0.09 : 0.07), place === 1 ? '#ffe066' : '#ffffff');
      c.add(t);
      this.tweens.add({ targets: t, scale: { from: 0.3, to: 1 }, duration: 400, ease: 'Back.Out' });
    });
    this.time.delayedCall(2200, () => {
      const cb = this.onFinish;
      this.scene.stop();
      cb({ placements, stats });
    });
  }

  private showIntro(): void {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0).setDepth(200).setInteractive();
    const ready = new Set<number>();
    const panels = this.zones.map((z, i) => {
      const p = this.players[i];
      const u = Math.min(z.w, z.h);
      const c = this.zoneContainer(i).setDepth(201);
      const title = label(this, 0, -z.h * 0.3, `${this.meta.icon} ${this.meta.title}`, u * 0.11);
      const how = label(this, 0, -z.h * 0.08, this.meta.howToPlay, u * 0.06).setWordWrapWidth(z.w * 0.85);
      const btnY = z.h * 0.28;
      const btn = new TouchButton(this, c, 0, btnY, u * 0.13, p.color, 'READY');
      const who = addCharacter(this, -u * 0.13 - u * 0.16, btnY, p, u * 0.16);
      c.add([title, how, who]);
      btn.onPress = () => {
        if (ready.has(i)) return;
        ready.add(i);
        btn.setText('✓').setEnabled(false);
        if (ready.size === this.players.length) {
          this.time.delayedCall(250, () => {
            dim.destroy();
            panels.forEach((pc) => pc.destroy());
            this.countdown();
          });
        }
      };
      return c;
    });
  }

  private countdown(): void {
    const labels = this.zones.map((_z, i) => {
      const c = this.zoneContainer(i).setDepth(250);
      const t = label(this, 0, 0, '3', this.unit * 0.18);
      c.add(t);
      return { c, t };
    });
    let n = 3;
    const step = () => {
      const text = n > 0 ? String(n) : 'GO!';
      labels.forEach(({ t }) => {
        t.setText(text);
        this.tweens.add({ targets: t, scale: { from: 1.6, to: 1 }, alpha: { from: 1, to: 0.7 }, duration: 500 });
      });
      if (n > 0) {
        n--;
        this.time.delayedCall(700, step);
      } else {
        this.playing = true;
        this.startGame();
        this.time.delayedCall(500, () => labels.forEach(({ c }) => c.destroy()));
      }
    };
    step();
  }

  private addQuitButton(): void {
    const r = this.unit * 0.03;
    const btn = this.add.circle(r * 1.6, this.scale.height / 2, r, 0x000000, 0.35).setDepth(400).setInteractive();
    const x = label(this, btn.x, btn.y, '✕', r).setDepth(401);
    x.setAlpha(0.8);
    btn.on('pointerdown', () => {
      if (this.finished) return;
      if (!window.confirm('Quit this tournament?')) return;
      this.finished = true;
      const cb = this.onFinish;
      this.scene.stop();
      cb(null);
    });
  }
}
