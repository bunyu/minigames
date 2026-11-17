import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import { sweptAcross } from '../../engine/physics';
import type { GameMeta } from '../types';

export const laserJumpMeta: GameMeta = {
  id: 'laser-jump',
  title: 'Laser Jump',
  icon: '⚡',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 60,
  howToPlay: 'Laser beams sweep around the platform. Tap JUMP to hop over them – but you must land before you can jump again!',
  gesture: 'tap',
  tips: ['⚡ Laser coming…', '👆 Tap = JUMP', '🏆 Last one wins'],
  background: '#10002b',
};

const TIME_LIMIT = 100;
const AIR_TIME = 0.6;
const GROUND_LOCK = 0.3;

interface Jumper {
  seat: number;
  angle: number;
  air: number; // seconds left in the air
  lock: number; // seconds before the next jump is allowed
  alive: boolean;
  diedAt: number;
  view: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  button: TouchButton;
}

interface Beam {
  angle: number;
  dir: number;
}

export class LaserJumpScene extends BaseGameScene {
  private jumpers: Jumper[] = [];
  private beams: Beam[] = [];
  private beamGfx!: Phaser.GameObjects.Graphics;
  private cx = 0;
  private cy = 0;
  private ringR = 0;
  private beamLen = 0;
  private nextReverse = 0;

  constructor() {
    super(laserJumpMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;
    this.ringR = u * 0.3;
    this.beamLen = u * 0.46;
    this.beams = [{ angle: Math.PI / 4, dir: 1 }];
    this.nextReverse = 22 + Math.random() * 4;

    const g = this.add.graphics();
    g.fillStyle(0x3c096c, 1).fillCircle(this.cx, this.cy, this.beamLen + u * 0.02);
    g.fillStyle(0x5a189a, 1).fillCircle(this.cx, this.cy, this.beamLen);
    g.lineStyle(u * 0.05, 0x7b2cbf, 1).strokeCircle(this.cx, this.cy, this.ringR);
    g.fillStyle(0xe0aaff, 1).fillCircle(this.cx, this.cy, u * 0.045);
    this.beamGfx = this.add.graphics().setDepth(5);

    const size = u * 0.085;
    this.jumpers = this.players.map((p, i) => {
      const z = this.zones[i];
      // Each player stands on the ring on their own side of the table.
      const angle = Math.atan2(z.cy - this.cy, z.cx - this.cx);
      const x = this.cx + Math.cos(angle) * this.ringR;
      const y = this.cy + Math.sin(angle) * this.ringR;
      const shadow = this.add.ellipse(x, y + size * 0.45, size * 0.9, size * 0.35, 0x000000, 0.45).setDepth(6);
      const view = addCharacter(this, x, y, p, size).setDepth(10);
      const c = this.zoneContainer(i).setDepth(50);
      const br = u * 0.1;
      const pos = this.outerCorner(i, br);
      const button = new TouchButton(this, c, pos.x, pos.y, br, p.color, 'JUMP');
      const j: Jumper = { seat: i, angle, air: 0, lock: 0, alive: true, diedAt: 0, view, shadow, button };
      button.onPress = () => this.jump(j);
      return j;
    });
    this.drawBeams();
  }

  protected startGame(): void {}

  private jump(j: Jumper): void {
    if (!this.playing || !j.alive || j.air > 0 || j.lock > 0) return;
    const airTime = AIR_TIME * (1 + this.players[j.seat].handicap);
    j.air = airTime;
    sfx('tap');
    this.tweens.add({ targets: j.view, scale: 1.45, duration: (airTime * 1000) / 2, yoyo: true, ease: 'Sine.Out' });
    this.tweens.add({ targets: j.shadow, scale: 0.55, alpha: 0.2, duration: (airTime * 1000) / 2, yoyo: true });
  }

  private drawBeams(): void {
    const g = this.beamGfx.clear();
    const u = this.unit;
    for (const b of this.beams) {
      const ex = this.cx + Math.cos(b.angle) * this.beamLen;
      const ey = this.cy + Math.sin(b.angle) * this.beamLen;
      g.lineStyle(u * 0.04, b.dir > 0 ? 0xff006e : 0xffbe0b, 0.3).lineBetween(this.cx, this.cy, ex, ey);
      g.lineStyle(u * 0.015, 0xffffff, 1).lineBetween(this.cx, this.cy, ex, ey);
    }
  }

  protected tick(dt: number): void {
    const t = this.elapsed;
    const speed = Math.min(5, 1.5 + t * 0.055);
    if (t > 15 && this.beams.length === 1) {
      this.beams.push({ angle: this.beams[0].angle + Math.PI, dir: this.beams[0].dir });
      this.toast('⚡ Two lasers!');
    }
    if (t > this.nextReverse) {
      // Every few seconds one beam switches direction (beam colour shows its direction).
      const b = Phaser.Utils.Array.GetRandom(this.beams);
      b.dir *= -1;
      this.nextReverse = t + 3 + Math.random() * 4;
    }

    for (const j of this.jumpers) {
      if (!j.alive) continue;
      if (j.air > 0) {
        j.air -= dt;
        if (j.air <= 0) j.lock = GROUND_LOCK;
      } else {
        j.lock = Math.max(0, j.lock - dt);
      }
      j.button.setCharge(j.air > 0 ? 0 : 1 - j.lock / GROUND_LOCK);
    }

    for (const b of this.beams) {
      const from = b.angle;
      b.angle += b.dir * speed * dt;
      for (const j of this.jumpers) {
        if (j.alive && j.air <= 0 && sweptAcross(from, b.angle, j.angle)) this.zap(j);
      }
    }
    this.drawBeams();

    const alive = this.jumpers.filter((j) => j.alive).length;
    if (alive <= 1 || t >= TIME_LIMIT) this.end();
  }

  private zap(j: Jumper): void {
    j.alive = false;
    sfx('zap');
    j.diedAt = this.elapsed;
    j.button.setEnabled(false).setText('OUT');
    j.button.setCharge(1);
    this.cameras.main.shake(120, 0.006);
    this.tweens.add({ targets: j.view, alpha: 0.25, scale: 0.7, duration: 300 });
    j.shadow.setVisible(false);
    const flash = this.add.circle(j.view.x, j.view.y, this.unit * 0.02, 0xffffff).setDepth(20);
    this.tweens.add({ targets: flash, radius: this.unit * 0.09, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
    this.toast('⚡ Zapped!', [j.seat]);
  }

  private end(): void {
    const scores = this.jumpers.map((j) => (j.alive ? 1000 : j.diedAt));
    const stats = this.jumpers.map((j) => (j.alive ? 'never got zapped' : `zapped after ${j.diedAt.toFixed(1)} s`));
    this.finish(placementsFromScores(scores), stats);
  }
}
