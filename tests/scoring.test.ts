import { describe, expect, it } from 'vitest';
import { finalStandings, placementsFromScores, pointsFor, roundPoints, starsEarned } from '../src/core/scoring';

describe('placementsFromScores', () => {
  it('ranks higher scores first', () => {
    expect(placementsFromScores([10, 30, 20, 0])).toEqual([3, 1, 2, 4]);
  });
  it('shares placements on ties (1,1,3)', () => {
    expect(placementsFromScores([5, 5, 2])).toEqual([1, 1, 3]);
  });
  it('supports lower-is-better', () => {
    expect(placementsFromScores([0.3, 0.1, 0.2], false)).toEqual([3, 1, 2]);
  });
});

describe('points', () => {
  it('uses the table per player count', () => {
    expect(roundPoints([1, 2])).toEqual([3, 1]);
    expect(roundPoints([3, 1, 2])).toEqual([1, 4, 2]);
    expect(roundPoints([4, 3, 2, 1])).toEqual([1, 2, 3, 5]);
  });
  it('gives tied players the higher placement points', () => {
    expect(roundPoints([1, 1, 3, 4])).toEqual([5, 5, 2, 1]);
  });
  it('doubles points', () => {
    expect(roundPoints([2, 1], true)).toEqual([2, 6]);
  });
  it('rejects invalid input', () => {
    expect(() => pointsFor(1, 5)).toThrow();
    expect(() => pointsFor(3, 2)).toThrow();
  });
});

describe('finalStandings', () => {
  it('breaks ties by number of wins, then 2nd places', () => {
    // seats 0 and 1 both have 8 points; seat 1 has more wins
    const history = [
      [2, 1, 3],
      [2, 1, 3],
      [1, 3, 2],
    ];
    const s = finalStandings([8, 8, 4], history);
    expect(s.map((r) => [r.seat, r.rank])).toEqual([
      [1, 1],
      [0, 2],
      [2, 3],
    ]);
  });
  it('keeps a shared rank when fully tied', () => {
    const s = finalStandings([4, 4], [
      [1, 2],
      [2, 1],
    ]);
    expect(s.map((r) => r.rank)).toEqual([1, 1]);
  });
  it('awards stars to everyone, bonus to the winner', () => {
    const [winner, second] = finalStandings([10, 6], [[1, 2]]);
    expect(starsEarned(winner)).toBe(17);
    expect(starsEarned(second)).toBe(8);
  });
});
