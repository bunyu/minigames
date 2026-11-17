import { describe, expect, it } from 'vitest';
import { StadiumTrack } from '../src/games/kart-rally/track';

const track = new StadiumTrack(200, 800, 300, 80, 200); // centre-line radius 140

describe('StadiumTrack', () => {
  it('knows road from grass', () => {
    expect(track.onRoad(500, 300 + 140)).toBe(true); // bottom straight
    expect(track.onRoad(500, 300)).toBe(false); // inner island
    expect(track.onRoad(500, 300 + 250)).toBe(false); // outside
    expect(track.onRoad(800 + 140, 300)).toBe(true); // right bend
  });

  it('progress increases along the driving direction and round-trips with pointAt', () => {
    let prev = -1;
    for (let s = 0; s < track.perimeter; s += track.perimeter / 40) {
      const p = track.pointAt(s);
      const back = track.progressAt(p.x, p.y);
      expect(back).toBeCloseTo(s, 3);
      expect(back).toBeGreaterThan(prev);
      prev = back;
    }
  });

  it('heading points along the track', () => {
    expect(track.pointAt(10).heading).toBeCloseTo(0); // bottom straight → right
    const top = track.pointAt(track.straight + Math.PI * track.mid + 10);
    expect(Math.abs(top.heading)).toBeCloseTo(Math.PI); // top straight → left
  });

  it('delta wraps across the start line', () => {
    expect(track.delta(track.perimeter - 5, 3)).toBeCloseTo(8);
    expect(track.delta(3, track.perimeter - 5)).toBeCloseTo(-8);
  });
});
