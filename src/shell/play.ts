import { playGame } from './gameHost';
import { go } from './nav';
import { seatPlayers, session } from './state';

let wakeLock: { release: () => Promise<void> } | null = null;

async function keepAwake(on: boolean): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (on && !wakeLock && nav.wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

/** Play the tournament's current game, record the result, then show the round screen. */
export async function playCurrentRound(): Promise<void> {
  const t = session.tournament;
  const gameId = t?.currentGameId;
  if (!t || !gameId) return go('home');
  void keepAwake(true);
  const result = await playGame(gameId, seatPlayers());
  if (!result) {
    session.tournament = null;
    void keepAwake(false);
    return go('home');
  }
  t.record(result.placements);
  session.lastStats = result.stats;
  if (t.isFinished) void keepAwake(false);
  go('round');
}
