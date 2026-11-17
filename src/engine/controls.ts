import Phaser from 'phaser';
import { label } from './character';

/**
 * A big round multi-touch button placed inside a (possibly rotated) zone container.
 * Tracks whether it is held down, and fires `onPress` immediately on touch.
 */
export class TouchButton {
  readonly root: Phaser.GameObjects.Container;
  private readonly disc: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private pointers = new Set<number>();
  private enabled = true;
  onPress: () => void = () => {};
  onRelease: () => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    readonly radius: number,
    private readonly color: number,
    text: string,
    textScale = 0.42,
  ) {
    this.root = scene.add.container(x, y);
    this.disc = scene.add.circle(0, 0, radius, color).setStrokeStyle(radius * 0.08, 0xffffff, 0.9);
    this.ring = scene.add.graphics();
    this.text = label(scene, 0, 0, text, radius * textScale);
    this.root.add([this.disc, this.ring, this.text]);
    parent.add(this.root);

    // Hit area slightly bigger than the disc so kids don't miss.
    this.disc.setInteractive(
      new Phaser.Geom.Circle(radius, radius, radius * 1.15),
      Phaser.Geom.Circle.Contains,
    );
    this.disc.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      const wasDown = this.isDown;
      this.pointers.add(p.id);
      this.root.setScale(0.92);
      if (!wasDown) this.onPress();
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (!this.pointers.delete(p.id)) return;
      if (!this.isDown) {
        this.root.setScale(1);
        this.onRelease();
      }
    };
    this.disc.on('pointerup', up);
    this.disc.on('pointerout', up);
    scene.input.on('pointerup', up);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('pointerup', up));
  }

  get isDown(): boolean {
    return this.pointers.size > 0;
  }

  setText(text: string): this {
    this.text.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (!enabled) this.pointers.clear();
    this.root.setScale(1);
    this.disc.setFillStyle(enabled ? this.color : 0x555555);
    return this;
  }

  /** Draw a cooldown ring: 0 = empty, 1 = full (ready). */
  setCharge(charge: number): void {
    this.ring.clear();
    if (charge >= 1) return;
    this.ring.lineStyle(this.radius * 0.14, 0x000000, 0.45);
    this.ring.beginPath();
    this.ring.arc(0, 0, this.radius * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - charge), false);
    this.ring.strokePath();
  }

  flash(): void {
    this.scene.tweens.add({ targets: this.disc, alpha: { from: 0.4, to: 1 }, duration: 200 });
  }
}
