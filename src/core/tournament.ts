import { finalStandings, roundPoints, type Placements, type Standing } from './scoring';

export const MIN_GAMES = 3;
export const MAX_GAMES = 10;

export interface RoundRecord {
  gameId: string;
  placements: Placements;
  points: number[];
  doubled: boolean;
}

export class Tournament {
  readonly rounds: RoundRecord[] = [];

  constructor(
    readonly playerCount: number,
    readonly games: readonly string[],
    readonly doubleLast = false,
  ) {
    if (playerCount < 2 || playerCount > 4) throw new Error('Need 2 to 4 players');
    if (games.length < MIN_GAMES || games.length > MAX_GAMES)
      throw new Error(`Pick ${MIN_GAMES} to ${MAX_GAMES} games`);
  }

  get roundIndex(): number {
    return this.rounds.length;
  }

  get currentGameId(): string | undefined {
    return this.games[this.rounds.length];
  }

  get isFinished(): boolean {
    return this.rounds.length >= this.games.length;
  }

  get isLastRound(): boolean {
    return this.rounds.length === this.games.length - 1;
  }

  record(placements: Placements): RoundRecord {
    const gameId = this.currentGameId;
    if (!gameId) throw new Error('Tournament already finished');
    if (placements.length !== this.playerCount) throw new Error('Wrong number of placements');
    const doubled = this.doubleLast && this.isLastRound;
    const round = { gameId, placements: [...placements], points: roundPoints(placements, doubled), doubled };
    this.rounds.push(round);
    return round;
  }

  totals(): number[] {
    const t = new Array<number>(this.playerCount).fill(0);
    for (const r of this.rounds) r.points.forEach((p, i) => (t[i] += p));
    return t;
  }

  standings(): Standing[] {
    return finalStandings(this.totals(), this.rounds.map((r) => r.placements));
  }
}
