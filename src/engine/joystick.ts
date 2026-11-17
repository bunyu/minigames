import Phaser from 'phaser';

/**
 * Virtual thumb-stick inside a (possibly rotated) zone container.
 * `vec` is the output in SCREEN space, length 0..1, so games never care about zone rotation.
 */
export class Joystick {
  readonly vec = new Phaser.Math.Vector2();
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private enabled = true;

  /**
   * @param lx, ly   position inside the zone container
   * @param sx, sy   the same position in screen space
   * @param flipped  true when the zone is rotated 180°
   */
  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly lx: number,
    private readonly ly: number,
    private readonly sx: number,
    private readonly sy: number,
    private readonly flipped: boolean,
    readonly radius: number,
    color: number,
  ) {
    this.base = scene.add.circle(lx, ly, radius, color, 0.25).setStrokeStyle(radius * 0.06, 0xffffff, 0.6);
    this.knob = scene.add.circle(lx, ly, radius * 0.45, color).setStrokeStyle(radius * 0.06, 0xffffff, 0.95);
    parent.add([this.base, this.knob]);

    this.base.setInteractive(new Phaser.Geom.Circle(radius, radius, radius * 1.35), Phaser.Geom.Circle.Contains);
    this.base.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled || this.pointerId !== null) return;
      this.pointerId = p.id;
      this.move(p);
    });
    const onMove = (p: Phaser.Input.Pointer) => {
      if (p.id === this.pointerId) this.move(p);
    };
    const onUp = (p: Phaser.Input.Pointer) => {
      if (p.id === this.pointerId) this.release();
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('pointerupoutside', onUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointerupoutside', onUp);
    });
  }

  private move(p: Phaser.Input.Pointer): void {
    let dx = p.x - this.sx;
    let dy = p.y - this.sy;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    const mag = Math.min(1, len / this.radius);
    // Small dead zone so a resting thumb doesn't drift.
    if (mag < 0.15) this.vec.set(0, 0);
    else this.vec.set(dx / this.radius, dy / this.radius);
    const s = this.flipped ? -1 : 1;
    this.knob.setPosition(this.lx + dx * s, this.ly + dy * s);
  }

  release(): void {
    this.pointerId = null;
    this.vec.set(0, 0);
    this.knob.setPosition(this.lx, this.ly);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.release();
    this.base.setAlpha(enabled ? 1 : 0.3);
    this.knob.setAlpha(enabled ? 1 : 0.3);
  }
}
