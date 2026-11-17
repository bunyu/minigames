import { describe, expect, it } from 'vitest';
import { angleDiff, circleRect, collide, keepInside, reflect, sweptAcross, type Body } from '../src/engine/physics';

const body = (x: number, y: number, vx = 0, vy = 0, r = 10, mass = 1): Body => ({ x, y, vx, vy, r, mass });

describe('circleRect', () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };
  it('misses when apart', () => {
    expect(circleRect(150, 25, 10, rect)).toBeNull();
  });
  it('hits a side with an outward normal', () => {
    const hit = circleRect(105, 25, 10, rect)!;
    expect(hit.nx).toBeCloseTo(1);
    expect(hit.depth).toBeCloseTo(5);
  });
  it('pushes a centre inside the rect out of the nearest side', () => {
    const hit = circleRect(50, 3, 10, rect)!;
    expect([hit.nx, hit.ny]).toEqual([0, -1]);
    expect(hit.depth).toBeCloseTo(13);
  });
});

describe('reflect', () => {
  it('bounces velocity off a surface', () => {
    const v = { vx: -5, vy: 2 };
    reflect(v, { nx: 1, ny: 0, depth: 1 });
    expect(v).toEqual({ vx: 5, vy: 2 });
  });
  it('ignores velocity leaving the surface', () => {
    const v = { vx: 5, vy: 2 };
    reflect(v, { nx: 1, ny: 0, depth: 1 });
    expect(v).toEqual({ vx: 5, vy: 2 });
  });
});

describe('keepInside', () => {
  it('clamps to the walls', () => {
    const b = body(-5, 200, -3, 4);
    expect(keepInside(b, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    expect([b.x, b.y, b.vx, b.vy]).toEqual([10, 90, 0, -0]);
  });
});

describe('collide', () => {
  it('swaps velocity in a head-on elastic hit of equal masses', () => {
    const a = body(0, 0, 10, 0);
    const b = body(15, 0, 0, 0);
    expect(collide(a, b, 1)).toBe(true);
    expect(a.vx).toBeCloseTo(0);
    expect(b.vx).toBeCloseTo(10);
    expect(b.x - a.x).toBeCloseTo(20);
  });
  it('a heavier body is pushed less', () => {
    const a = body(0, 0, 10, 0, 10, 1);
    const b = body(15, 0, 0, 0, 10, 3);
    collide(a, b, 1);
    expect(b.vx).toBeLessThan(10);
  });
  it('ignores bodies that do not touch', () => {
    expect(collide(body(0, 0), body(30, 0))).toBe(false);
  });
});

describe('angles', () => {
  it('angleDiff wraps around', () => {
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
  });
  it('detects a beam sweeping over a target, including across 0', () => {
    expect(sweptAcross(-0.1, 0.1, 0)).toBe(true);
    expect(sweptAcross(Math.PI * 2 - 0.05, 0.05, 0)).toBe(true);
    expect(sweptAcross(0.2, 0.3, 0)).toBe(false);
    expect(sweptAcross(Math.PI - 0.1, -Math.PI + 0.1, 0)).toBe(false);
  });
});
