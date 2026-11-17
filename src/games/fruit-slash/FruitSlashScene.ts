import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { emoji, label } from '../../engine/character';
import { segmentDistance } from '../../engine/physics';
import type { GameMeta } from '../types';

export const fruitSlashMeta: GameMeta = {
  id: 'fruit-slash',
  title: 'Fruit Slash',
  icon: '🍉',
  controls: 'swipe',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 40,
  howToPlay: 'Swipe across the fruit flying up in your area to slice it! 3 in one swipe = combo bonus. Never slice a bomb!',
  gesture: 'swipe',
  tips: ['👆 Swipe the fruit', '🍉🍉🍉 = COMBO', '💣 = −3'],
  background: '#2b2d42',
};

const TIME_LIMIT = 40;
const FRUITS = ['🍉', '🍎', '🍊', '🍋', '🍇', '🍓', '🍍', '🥝', '🍑'];

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  bomb: boolean;
  dead: boolean;
  view: Phaser.GameObjects.Text;
}

interface Lane {
  seat: number;
  c: Phaser.GameObjects.Container;
  fruits: Fruit[];
  score: number;
  stroke: number;
  last: { x: number; y: number } | null;
  trail: Phaser.GameObjects.Graphics;
  scoreText: Phaser.GameObjects.Text;
}

export class FruitSlashScene extends BaseGameScene {
  private lanes: Lane[] = [];
  private spawnIn = 0;
  private updateTimer!: () => void;

  constructor() {
    super(fruitSlashMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.spawnIn = 0.3;
    this.updateTimer = this.addTimer(TIME_LIMIT);
    this.lanes = this.players.map((p, i) => {
      const z = this.zones[i];
      // Each player's own board, with a coloured frame.
      const bg = this.add.rectangle(z.cx, z.cy, z.w - 8, z.h - 8, p.color, 0.12).setStrokeStyle(4, p.color, 0.8);
      bg.setDepth(0);
      const c = this.zoneContainer(i).setDepth(10);
      const trail = this.add.graphics();
      c.add(trail);
      const hud = this.zoneContainer(i).setDepth(60);
      const scoreText = label(this, -z.w / 2 + u * 0.1, z.h / 2 - u * 0.05, '0', u * 0.06, p.colorCss);
      hud.add(scoreText);
      return { seat: i, c, fruits: [], score: 0, stroke: 0, last: null, trail, scoreText };
    });

    this.trackTouches({
      down: (seat, p) => {
        const lane = this.lanes[seat];
        lane.last = this.toZoneLocal(seat, p.x, p.y);
        lane.stroke = 0;
      },
      move: (seat, p) => this.swipe(this.lanes[seat], this.toZoneLocal(seat, p.x, p.y)),
      up: (seat) => {
        const lane = this.lanes[seat];
        lane.last = null;
        lane.trail.clear();
      },
    });
  }

  protected startGame(): void {}

  /** The same throw is launched in every player's board at once, so it's fair. */
  private spawnWave(): void {
    const bomb = this.elapsed > 5 && Math.random() < 0.18;
    const icon = bomb ? '💣' : Phaser.Utils.Array.GetRandom(FRUITS);
    const xf = Math.random();
    const vf = Math.random() - 0.5;
    const hf = 0.75 + Math.random() * 0.2;
    for (const lane of this.lanes) {
      const z = this.zones[lane.seat];
      const r = this.unit * 0.045;
      const g = z.h * 2.4;
      const fruit: Fruit = {
        x: (xf - 0.5) * z.w * 0.75,
        y: z.h / 2 + r,
        vx: vf * z.w * 0.35,
        vy: -Math.sqrt(2 * g * z.h * hf),
        r,
        bomb,
        dead: false,
        view: emoji(this, 0, 0, icon, r * 2),
      };
      lane.c.add(fruit.view);
      lane.fruits.push(fruit);
    }
  }

  private swipe(lane: Lane, pt: { x: number; y: number }): void {
    if (!this.playing || !lane.last) return;
    const a = lane.last;
    lane.last = pt;
    lane.trail.lineStyle(this.unit * 0.012, 0xffffff, 0.8).lineBetween(a.x, a.y, pt.x, pt.y);
    this.time.delayedCall(120, () => lane.trail.clear());
    for (const f of lane.fruits) {
      if (f.dead || segmentDistance(f.x, f.y, a.x, a.y, pt.x, pt.y) > f.r) continue;
      f.dead = true;
      if (f.bomb) {
        sfx('boom');
        this.cameras.main.shake(150, 0.006);
        this.addScore(lane, -3, f);
        continue;
      }
      sfx('hit');
      lane.stroke++;
      this.addScore(lane, lane.stroke === 3 ? 3 : 1, f, lane.stroke === 3 ? 'COMBO +3' : undefined);
      // Juice splash.
      const splash = this.add.circle(f.x, f.y, f.r * 0.6, this.players[lane.seat].color, 0.7);
      lane.c.add(splash);
      this.tweens.add({ targets: splash, scale: 2.4, alpha: 0, duration: 300, onComplete: () => splash.destroy() });
    }
  }

  private addScore(lane: Lane, n: number, f: Fruit, text?: string): void {
    lane.score = Math.max(0, lane.score + n);
    lane.scoreText.setText(String(lane.score));
    const pop = label(this, f.x, f.y, text ?? (n > 0 ? `+${n}` : `${n}`), this.unit * 0.045, n > 0 ? '#ffd166' : '#ff595e');
    lane.c.add(pop);
    this.tweens.add({ targets: pop, y: f.y - this.unit * 0.06, alpha: 0, duration: 650, onComplete: () => pop.destroy() });
    this.tweens.add({ targets: f.view, scale: 1.6, alpha: 0, duration: 200 });
  }

  protected tick(dt: number): void {
    this.updateTimer();
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnWave();
      this.spawnIn = Math.max(0.35, 0.8 - this.elapsed * 0.012);
    }
    for (const lane of this.lanes) {
      const z = this.zones[lane.seat];
      const g = z.h * 2.4;
      for (const f of lane.fruits) {
        f.vy += g * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (!f.dead) f.view.setPosition(f.x, f.y).setRotation(f.view.rotation + f.vx * dt * 0.01);
        if (f.y > z.h / 2 + f.r * 2 && f.vy > 0) f.dead = true;
      }
      lane.fruits = lane.fruits.filter((f) => {
        const gone = f.dead && (f.view.alpha === 0 || f.y > z.h / 2 + f.r * 2);
        if (gone) f.view.destroy();
        return !gone;
      });
    }
    if (this.elapsed >= TIME_LIMIT) this.end();
  }

  private end(): void {
    this.finish(placementsFromScores(this.lanes.map((l) => l.score)), this.lanes.map((l) => `${l.score} points`));
  }
}
