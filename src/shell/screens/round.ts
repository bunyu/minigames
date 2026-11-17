import { lookOf } from '../../core/profiles';
import { gameMeta } from '../../games/registry';
import { go } from '../nav';
import { playCurrentRound } from '../play';
import { seatProfiles, session } from '../state';
import { characterEl, h, MEDALS, screen } from '../ui';

export function roundScreen(): HTMLElement {
  const t = session.tournament;
  if (!t || t.rounds.length === 0) return screen('Oops', h('button', { class: 'btn', onclick: () => go('home') }, 'Home'));
  const last = t.rounds[t.rounds.length - 1];
  const totals = t.totals();
  const profiles = seatProfiles();
  const order = profiles.map((_p, seat) => seat).sort((a, b) => last.placements[a] - last.placements[b] || a - b);
  const meta = gameMeta(last.gameId);
  const nextId = t.currentGameId;

  const rows = order.map((seat) =>
    h(
      'div',
      { class: 'result-row', style: `--color:${lookOf(profiles[seat]).colorCss}` },
      h('span', { class: 'medal' }, MEDALS[last.placements[seat] - 1]),
      characterEl(lookOf(profiles[seat]), 56),
      h('div', { class: 'grow' }, h('b', {}, profiles[seat].name), h('small', {}, session.lastStats?.[seat] ?? '')),
      h('span', { class: 'plus' }, `+${last.points[seat]}`),
      h('span', { class: 'total' }, `${totals[seat]} pts`),
    ),
  );

  return screen(
    `${meta.icon} ${meta.title}`,
    h('p', { class: 'hint' }, `Game ${t.rounds.length} of ${t.games.length}${last.doubled ? ' · DOUBLE POINTS!' : ''}`),
    h('div', { class: 'results' }, ...rows),
    h(
      'div',
      { class: 'footer' },
      h('span', {}),
      nextId
        ? h(
            'button',
            { class: 'btn primary big', onclick: () => void playCurrentRound() },
            `Next: ${gameMeta(nextId).icon} ${gameMeta(nextId).title}${t.isLastRound && t.doubleLast ? ' (x2!)' : ''} ▶`,
          )
        : h('button', { class: 'btn primary big', onclick: () => go('podium') }, '🏆 See the winner!'),
    ),
  );
}
