/** Placement per seat: 1 = first. Ties share the same number (competition ranking: 1, 1, 3). */
export type Placements = number[];

/** Points per placement, indexed by player count. */
export const POINTS: Record<number, readonly number[]> = {
  2: [3, 1],
  3: [4, 2, 1],
  4: [5, 3, 2, 1],
};

export function pointsFor(place: number, playerCount: number): number {
  const table = POINTS[playerCount];
  if (!table) throw new Error(`Unsupported player count: ${playerCount}`);
  if (place < 1 || place > table.length) throw new Error(`Invalid place ${place}`);
  return table[place - 1];
}

/** Turn a score per seat into placements. Equal scores share a placement. */
export function placementsFromScores(scores: number[], higherIsBetter = true): Placements {
  return scores.map((s) => 1 + scores.filter((o) => (higherIsBetter ? o > s : o < s)).length);
}

export function roundPoints(placements: Placements, double = false): number[] {
  return placements.map((p) => pointsFor(p, placements.length) * (double ? 2 : 1));
}

export interface Standing {
  seat: number;
  total: number;
  firsts: number;
  seconds: number;
  /** Final rank, 1 = winner. Players still tied after tie-breaks share a rank. */
  rank: number;
}

/** Final ranking: total points, then most 1st places, then most 2nd places. */
export function finalStandings(totals: number[], history: Placements[]): Standing[] {
  const rows: Standing[] = totals.map((total, seat) => ({
    seat,
    total,
    firsts: history.filter((p) => p[seat] === 1).length,
    seconds: history.filter((p) => p[seat] === 2).length,
    rank: 0,
  }));
  const better = (a: Standing, b: Standing) =>
    a.total !== b.total
      ? a.total > b.total
      : a.firsts !== b.firsts
        ? a.firsts > b.firsts
        : a.seconds > b.seconds;
  for (const r of rows) r.rank = 1 + rows.filter((o) => better(o, r)).length;
  return rows.sort((a, b) => a.rank - b.rank || a.seat - b.seat);
}

/** Stars earned for the Locker at the end of a tournament. Everyone earns some. */
export function starsEarned(standing: Standing): number {
  return standing.total + 2 + (standing.rank === 1 ? 5 : 0);
}
