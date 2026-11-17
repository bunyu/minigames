/** Tiny 2D helpers for circle bodies in a rectangular arena. Pure functions, unit-tested. */

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Hit {
  nx: number;
  ny: number;
  depth: number;
}

/** Circle vs axis-aligned rectangle. Normal points from the rectangle toward the circle. */
export function circleRect(x: number, y: number, r: number, rect: Rect): Hit | null {
  const px = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const py = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  const dx = x - px;
  const dy = y - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre inside the rectangle: push out along the shallowest side.
  const left = x - rect.x;
  const right = rect.x + rect.width - x;
  const top = y - rect.y;
  const bottom = rect.y + rect.height - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

/** Reflect velocity on a hit normal (only when moving into the surface). */
export function reflect(b: { vx: number; vy: number }, hit: Hit, restitution = 1): void {
  const dot = b.vx * hit.nx + b.vy * hit.ny;
  if (dot >= 0) return;
  b.vx -= (1 + restitution) * dot * hit.nx;
  b.vy -= (1 + restitution) * dot * hit.ny;
}

/** Keep a circle inside a rectangle. Returns true when it touched a wall. */
export function keepInside(b: Body, rect: Rect, restitution = 0): boolean {
  let hit = false;
  if (b.x - b.r < rect.x) {
    b.x = rect.x + b.r;
    b.vx = Math.abs(b.vx) * restitution;
    hit = true;
  } else if (b.x + b.r > rect.x + rect.width) {
    b.x = rect.x + rect.width - b.r;
    b.vx = -Math.abs(b.vx) * restitution;
    hit = true;
  }
  if (b.y - b.r < rect.y) {
    b.y = rect.y + b.r;
    b.vy = Math.abs(b.vy) * restitution;
    hit = true;
  } else if (b.y + b.r > rect.y + rect.height) {
    b.y = rect.y + rect.height - b.r;
    b.vy = -Math.abs(b.vy) * restitution;
    hit = true;
  }
  return hit;
}

/**
 * Separate two overlapping circles and exchange momentum along the contact normal.
 * Returns true if they were touching.
 */
export function collide(a: Body, b: Body, restitution = 0.8): boolean {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const min = a.r + b.r;
  const d = Math.hypot(dx, dy) || 0.0001;
  if (d >= min) return false;
  dx /= d;
  dy /= d;
  const overlap = min - d;
  const total = a.mass + b.mass;
  a.x -= dx * overlap * (b.mass / total);
  a.y -= dy * overlap * (b.mass / total);
  b.x += dx * overlap * (a.mass / total);
  b.y += dy * overlap * (a.mass / total);
  const approach = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
  if (approach > 0) {
    const j = ((1 + restitution) * approach) / (1 / a.mass + 1 / b.mass);
    a.vx -= (j / a.mass) * dx;
    a.vy -= (j / a.mass) * dy;
    b.vx += (j / b.mass) * dx;
    b.vy += (j / b.mass) * dy;
  }
  return true;
}

/** Ease a body's velocity toward a joystick direction (screen space, length 0..1). */
export function steer(b: Body, dirX: number, dirY: number, speed: number, dt: number, response = 10): void {
  const k = Math.min(1, response * dt);
  b.vx += (dirX * speed - b.vx) * k;
  b.vy += (dirY * speed - b.vy) * k;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

/** Signed smallest angle difference a - b in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when a beam rotating from `from` to `to` sweeps across `target` (sweep < PI). */
export function sweptAcross(from: number, to: number, target: number): boolean {
  const d0 = angleDiff(from, target);
  const d1 = angleDiff(to, target);
  if (d0 === 0 || d1 === 0) return true;
  return Math.sign(d0) !== Math.sign(d1) && Math.abs(d0) < Math.PI / 2 && Math.abs(d1) < Math.PI / 2;
}
