import Phaser from 'phaser';
import { sfx } from '../../core/audio';
import { placementsFromScores } from '../../core/scoring';
import { BaseGameScene } from '../../engine/BaseGameScene';
import { addCharacter, label } from '../../engine/character';
import { TouchButton } from '../../engine/controls';
import type { GameMeta } from '../types';

export const showdownMeta: GameMeta = {
  id: 'showdown',
  title: 'Showdown',
  icon: '🤠',
  controls: '1-button',
  minPlayers: 2,
  maxPlayers: 4,
  approxSeconds: 45,
  howToPlay: 'Only a GREEN light means FIRE! Tap first to win the round. Tricks will try to fool you – tap too early and you are stunned. First to 3 wins!',
  gesture: 'tap',
  tips: ['🟢 GREEN = BANG!', '🟡 🔵 🔴 = WAIT!', '⭐⭐⭐ 3 wins'],
  background: '#7f5539',
};

const WINS_NEEDED = 3;
const MAX_ROUNDS = 9;

/** Decoys: everything that is not a green light. */
const FAKES: { color: number; text: string }[] = [
  { color: 0xffd60a, text: 'Ready…' },
  { color: 0x3a86ff, text: 'FIRE!' },
  { color: 0xff006e, text: 'FIRE!' },
  { color: 0xffd60a, text: 'FI…' },
  { color: 0xffffff, text: 'Fire?' },
  { color: 0x9d4edd, text: 'NOW!' },
];

interface Gunner {
  seat: number;
  wins: number;
  stunned: boolean;
  best: number;
  button: TouchButton;
  winsText: Phaser.GameObjects.Text;
}

export class ShowdownScene extends BaseGameScene {
  private gunners: Gunner[] = [];
  private lamp!: Phaser.GameObjects.Arc;
  private texts: Phaser.GameObjects.Text[] = [];
  private state: 'idle' | 'wait' | 'go' | 'done' = 'idle';
  private round = 0;
  private goAt = 0;
  private roundId = 0;

  constructor() {
    super(showdownMeta.id);
  }

  protected buildGame(): void {
    const u = this.unit;
    const { width, height } = this.scale;
    this.state = 'idle';
    this.round = 0;
    const cx = width / 2;
    const cy = height / 2;
    const g = this.add.graphics();
    g.fillStyle(0x9c6644, 1).fillRect(0, cy - u * 0.2, width, u * 0.4);
    g.fillStyle(0x582f0e, 1).fillCircle(cx, cy, u * 0.16);
    this.lamp = this.add.circle(cx, cy, u * 0.13, 0x333333).setStrokeStyle(u * 0.012, 0x000000);
    this.texts = [
      label(this, cx, cy + u * 0.21, '', u * 0.055),
      label(this, cx, cy - u * 0.21, '', u * 0.055).setRotation(Math.PI),
    ];

    this.gunners = this.players.map((p, i) => {
      const z = this.zones[i];
      const c = this.zoneContainer(i).setDepth(50);
      const br = Math.min(z.w, z.h) * 0.24;
      const by = z.h / 2 - br - u * 0.03;
      const button = new TouchButton(this, c, 0, by, br, p.color, 'BANG!', 0.33);
      const who = addCharacter(this, -br - u * 0.09, by, p, u * 0.09);
      const winsText = label(this, br + u * 0.11, by, '☆'.repeat(WINS_NEEDED), u * 0.04, '#ffd60a');
      c.add([who, winsText]);
      const gunner: Gunner = { seat: i, wins: 0, stunned: false, best: Infinity, button, winsText };
      button.onPress = () => this.shoot(gunner);
      return gunner;
    });
  }

  protected startGame(): void {
    this.nextRound();
  }

  private say(text: string, color = '#ffffff'): void {
    for (const t of this.texts) t.setText(text).setColor(color);
  }

  private nextRound(): void {
    if (!this.playing) return;
    const leader = Math.max(...this.gunners.map((g) => g.wins));
    if (leader >= WINS_NEEDED || this.round >= MAX_ROUNDS) return this.end();
    this.round++;
    const id = ++this.roundId;
    this.state = 'wait';
    for (const g of this.gunners) {
      g.stunned = false;
      g.button.setEnabled(true).setText('BANG!');
    }
    this.lamp.setFillStyle(0x333333);
    this.say(`Round ${this.round} – wait for GREEN…`);

    // A random number of fake-outs, then the real green light.
    let at = 1200 + Math.random() * 1200;
    const fakes = Phaser.Math.Between(0, Math.min(3, this.round));
    for (let i = 0; i < fakes; i++) {
      const fake = Phaser.Utils.Array.GetRandom(FAKES);
      this.time.delayedCall(at, () => {
        if (id !== this.roundId || this.state !== 'wait') return;
        this.lamp.setFillStyle(fake.color);
        sfx('beep');
        this.say(fake.text);
      });
      this.time.delayedCall(at + 550, () => {
        if (id !== this.roundId || this.state !== 'wait') return;
        this.lamp.setFillStyle(0x333333);
        this.say('…');
      });
      at += 900 + Math.random() * 1300;
    }
    this.time.delayedCall(at, () => {
      if (id !== this.roundId || this.state !== 'wait') return;
      this.state = 'go';
      sfx('go');
      this.goAt = this.time.now;
      this.lamp.setFillStyle(0x38b000);
      this.say('🟢 FIRE!', '#70e000');
      this.time.delayedCall(2500, () => {
        if (id !== this.roundId || this.state !== 'go') return;
        this.state = 'done';
        this.say('Too slow! Nobody wins');
        this.time.delayedCall(1300, () => this.nextRound());
      });
    });
  }

  private shoot(g: Gunner): void {
    if (!this.playing || g.stunned) return;
    if (this.state === 'wait') {
      g.stunned = true;
      sfx('out');
      g.button.setEnabled(false).setText('😵');
      this.toast('😵 Too early!', [g.seat], 900);
      if (this.gunners.every((x) => x.stunned)) {
        this.state = 'done';
        this.say('Everyone was fooled!');
        this.time.delayedCall(1300, () => this.nextRound());
      }
      return;
    }
    if (this.state !== 'go') return;
    this.state = 'done';
    sfx('shoot');
    const ms = Math.round(this.time.now - this.goAt);
    g.wins++;
    g.best = Math.min(g.best, ms);
    g.winsText.setText('★'.repeat(g.wins) + '☆'.repeat(Math.max(0, WINS_NEEDED - g.wins)));
    g.button.flash();
    this.lamp.setFillStyle(this.players[g.seat].color);
    this.say(`💥 ${this.players[g.seat].name} – ${ms} ms`, '#ffd60a');
    this.cameras.main.shake(120, 0.006);
    this.time.delayedCall(1600, () => this.nextRound());
  }

  private end(): void {
    this.state = 'done';
    const stats = this.gunners.map((g) => `${g.wins} wins${Number.isFinite(g.best) ? ` · best ${g.best} ms` : ''}`);
    this.finish(placementsFromScores(this.gunners.map((g) => g.wins)), stats);
  }
}
