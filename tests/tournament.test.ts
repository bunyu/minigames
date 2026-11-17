import { describe, expect, it } from 'vitest';
import { Tournament } from '../src/core/tournament';

describe('Tournament', () => {
  it('requires 3 to 10 games and 2 to 4 players', () => {
    expect(() => new Tournament(2, ['a', 'b'])).toThrow();
    expect(() => new Tournament(2, new Array(11).fill('a'))).toThrow();
    expect(() => new Tournament(5, ['a', 'b', 'c'])).toThrow();
    expect(() => new Tournament(1, ['a', 'b', 'c'])).toThrow();
  });

  it('plays rounds in order and totals points', () => {
    const t = new Tournament(3, ['a', 'b', 'c']);
    expect(t.currentGameId).toBe('a');
    t.record([1, 2, 3]);
    t.record([3, 1, 2]);
    expect(t.isLastRound).toBe(true);
    t.record([1, 3, 2]);
    expect(t.isFinished).toBe(true);
    expect(t.currentGameId).toBeUndefined();
    expect(t.totals()).toEqual([9, 7, 5]);
    expect(t.standings()[0].seat).toBe(0);
    expect(() => t.record([1, 2, 3])).toThrow();
  });

  it('doubles the last round when enabled', () => {
    const t = new Tournament(2, ['a', 'a', 'a'], true);
    t.record([1, 2]);
    t.record([1, 2]);
    const last = t.record([2, 1]);
    expect(last.doubled).toBe(true);
    // seat 0: 3 + 3 + 1*2 = 8, seat 1: 1 + 1 + 3*2 = 8
    expect(t.totals()).toEqual([8, 8]);
  });

  it('rejects wrong placement length', () => {
    const t = new Tournament(2, ['a', 'b', 'c']);
    expect(() => t.record([1, 2, 3])).toThrow();
  });
});
