import { getProfile, lookOf, save, store, type Profile } from '../core/profiles';
import { starsEarned } from '../core/scoring';
import type { Tournament } from '../core/tournament';
import type { SeatPlayer } from '../games/types';

export interface Seat {
  profileId: string | null;
  headStart: boolean;
}

/** In-memory state of the current session (not persisted). */
export const session = {
  seats: [] as Seat[],
  playlist: [] as string[],
  tournament: null as Tournament | null,
  lastStats: undefined as string[] | undefined,
  /** Stars awarded per seat once the tournament ends (null until then). */
  awarded: null as number[] | null,
};

export function seatProfiles(): Profile[] {
  return session.seats.map((s) => {
    const p = s.profileId ? getProfile(s.profileId) : undefined;
    if (!p) throw new Error('Seat without profile');
    return p;
  });
}

export function seatPlayers(): SeatPlayer[] {
  return seatProfiles().map((p, seat) => ({
    ...lookOf(p),
    seat,
    handicap: session.seats[seat].headStart ? 0.15 : 0,
  }));
}

/** Give everyone their stars and update lifetime stats. Runs once per tournament. */
export function awardStars(): number[] {
  const t = session.tournament;
  if (!t) return [];
  if (session.awarded) return session.awarded;
  const profiles = seatProfiles();
  const awarded = new Array<number>(profiles.length).fill(0);
  for (const s of t.standings()) {
    const p = profiles[s.seat];
    const stars = starsEarned(s);
    awarded[s.seat] = stars;
    p.stars += stars;
    p.stats.tournaments++;
    if (s.rank === 1) p.stats.tournamentWins++;
    p.stats.gameWins += s.firsts;
  }
  store.lastSeats = session.seats.map((s) => s.profileId ?? '');
  save();
  session.awarded = awarded;
  return awarded;
}
