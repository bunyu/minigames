import { save, store } from '../../core/profiles';
import { MAX_GAMES, MIN_GAMES, Tournament } from '../../core/tournament';
import { gameMeta, GAMES, gamesFor } from '../../games/registry';
import { go } from '../nav';
import { playCurrentRound } from '../play';
import { session } from '../state';
import { h, screen } from '../ui';

function randomPick(players: number, n: number): string[] {
  const pool = gamesFor(players).map((g) => g.meta.id);
  const out: string[] = [];
  let bag: string[] = [];
  while (out.length < n && pool.length > 0) {
    if (bag.length === 0) bag = [...pool].sort(() => Math.random() - 0.5);
    const next = bag.pop()!;
    if (out[out.length - 1] === next && pool.length > 1) {
      bag.unshift(next); // avoid the same game twice in a row
      continue;
    }
    out.push(next);
  }
  return out;
}

export function gamesScreen(): HTMLElement {
  const players = session.seats.length;
  const list = session.playlist;
  const rerender = () => go('games');
  const playable = new Set(gamesFor(players).map((g) => g.meta.id));
  // Drop games that don't fit the current player count.
  session.playlist = list.filter((id) => playable.has(id));

  const cards = GAMES.map(({ meta }) =>
    h(
      'button',
      {
        class: 'card game-card',
        disabled: !playable.has(meta.id) || session.playlist.length >= MAX_GAMES,
        onclick: () => {
          session.playlist.push(meta.id);
          rerender();
        },
      },
      h('div', { class: 'game-icon' }, meta.icon),
      h('b', {}, meta.title),
      h('small', {}, `${meta.controls} · ~${meta.approxSeconds}s`),
      h('div', { class: 'count' }, String(session.playlist.filter((id) => id === meta.id).length || '')),
    ),
  );

  const chips = session.playlist.map((id, i) =>
    h(
      'button',
      {
        class: 'chip',
        title: 'Remove',
        onclick: () => {
          session.playlist.splice(i, 1);
          rerender();
        },
      },
      `${i + 1}. ${gameMeta(id).icon} ${gameMeta(id).title} ✕`,
    ),
  );

  const n = session.playlist.length;
  const canStart = n >= MIN_GAMES && n <= MAX_GAMES;
  const start = () => {
    session.tournament = new Tournament(players, [...session.playlist], store.settings.doubleLast);
    session.awarded = null;
    void playCurrentRound();
  };

  return screen(
    'Pick the games',
    h('p', { class: 'hint' }, `Tap games to add them (${MIN_GAMES}–${MAX_GAMES}). You can add a game more than once.`),
    h('div', { class: 'game-grid' }, ...cards),
    h(
      'div',
      { class: 'playlist' },
      ...(chips.length ? chips : [h('span', { class: 'hint' }, 'No games yet')]),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn', onclick: () => ((session.playlist = randomPick(players, 5)), rerender()) }, '🎲 Random 5'),
      h('button', { class: 'btn', onclick: () => ((session.playlist = []), rerender()) }, 'Clear'),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: store.settings.doubleLast,
          onchange: (e: Event) => {
            store.settings.doubleLast = (e.target as HTMLInputElement).checked;
            save();
          },
        }),
        ' Last game = double points',
      ),
    ),
    h(
      'div',
      { class: 'footer' },
      h('button', { class: 'btn', onclick: () => go('players') }, '← Players'),
      h('button', { class: 'btn primary big', disabled: !canStart, onclick: start }, `Start ${n} game${n === 1 ? '' : 's'} ▶`),
    ),
  );
}
