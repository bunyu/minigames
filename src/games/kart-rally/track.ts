/**
 * A stadium-shaped track: the band between two capsules sharing the same centre segment
 * (x1, cy) → (x2, cy). Driving direction: right along the bottom straight, up the right bend,
 * left along the top straight, down the left bend (counter-clockwise on screen).
 */
export class StadiumTrack {
  readonly mid: number; // radius of the centre line
  readonly straight: number;
  readonly perimeter: number;

  constructor(
    readonly x1: number,
    readonly x2: number,
    readonly cy: number,
    readonly inner: number,
    readonly outer: number,
  ) {
    this.mid = (inner + outer) / 2;
    this.straight = x2 - x1;
    this.perimeter = 2 * this.straight + 2 * Math.PI * this.mid;
  }

  /** Distance from the centre segment. */
  private distance(x: number, y: number): number {
    const px = Math.max(this.x1, Math.min(this.x2, x));
    return Math.hypot(x - px, y - this.cy);
  }

  onRoad(x: number, y: number): boolean {
    const d = this.distance(x, y);
    return d >= this.inner && d <= this.outer;
  }

  /** Position along the centre line in [0, perimeter), starting at the left end of the bottom straight. */
  progressAt(x: number, y: number): number {
    const { x1, x2, cy, straight: L, mid: R } = this;
    if (x >= x1 && x <= x2) return y >= cy ? x - x1 : L + Math.PI * R + (x2 - x);
    if (x > x2) {
      const theta = Math.atan2(y - cy, x - x2); // +PI/2 (bottom) → 0 → -PI/2 (top)
      return L + (Math.PI / 2 - theta) * R;
    }
    let phi = Math.atan2(y - cy, x - x1); // top (-PI/2) → PI → bottom (PI/2)
    if (phi < 0) phi += Math.PI * 2; // now 3PI/2 (top) → PI → PI/2 (bottom)
    return 2 * L + Math.PI * R + (3 * Math.PI / 2 - phi) * R;
  }

  /** Point on the centre line at a given progress, with the driving direction there. */
  pointAt(s: number): { x: number; y: number; heading: number } {
    const { x1, x2, cy, straight: L, mid: R } = this;
    s = ((s % this.perimeter) + this.perimeter) % this.perimeter;
    if (s < L) return { x: x1 + s, y: cy + R, heading: 0 };
    s -= L;
    if (s < Math.PI * R) {
      const theta = Math.PI / 2 - s / R;
      return { x: x2 + Math.cos(theta) * R, y: cy + Math.sin(theta) * R, heading: theta - Math.PI / 2 };
    }
    s -= Math.PI * R;
    if (s < L) return { x: x2 - s, y: cy - R, heading: Math.PI };
    s -= L;
    const phi = (3 * Math.PI) / 2 - s / R;
    return { x: x1 + Math.cos(phi) * R, y: cy + Math.sin(phi) * R, heading: phi - Math.PI / 2 };
  }

  /** Signed change in progress between two readings, handling the wrap at the start. */
  delta(prev: number, next: number): number {
    let d = next - prev;
    if (d > this.perimeter / 2) d -= this.perimeter;
    if (d < -this.perimeter / 2) d += this.perimeter;
    return d;
  }
}
