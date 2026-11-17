import { lookOf } from '../../core/profiles';
import { Tournament } from '../../core/tournament';
import { go } from '../nav';
import { playCurrentRound } from '../play';
import { awardStars, seatProfiles, session } from '../state';
import { characterEl, h, MEDALS, screen } from '../ui';

function confetti(): HTMLElement {
  const colors = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f77f00'];
  const box = h('div', { class: 'confetti' });
  for (let i = 0; i < 80; i++) {
    box.append(
      h('i', {
        style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 2}s;animation-duration:${2.5 + Math.random() * 2}s`,
      }),
    );
  }
  return box;
}

export function podiumScreen(): HTMLElement {
  const t = session.tournament;
  if (!t || !t.isFinished) return screen('Oops', h('button', { class: 'btn', onclick: () => go('home') }, 'Home'));
  const stars = awardStars();
  const profiles = seatProfiles();
  const standings = t.standings();
  const winners = standings.filter((s) => s.rank === 1).map((s) => profiles[s.seat].name);

  const steps = standings.map((s) => {
    const p = profiles[s.seat];
    return h(
      'div',
      { class: `podium-step rank-${s.rank}`, style: `--color:${lookOf(p).colorCss}` },
      characterEl(lookOf(p), s.rank === 1 ? 120 : 84),
      h('b', {}, p.name),
      h('div', { class: 'block' }, h('span', { class: 'medal' }, MEDALS[s.rank - 1]), h('span', {}, `${s.total} pts`)),
      h('small', {}, `${s.firsts} win${s.firsts === 1 ? '' : 's'} · +${stars[s.seat]} ⭐`),
    );
  });

  const rematch = () => {
    session.tournament = new Tournament(t.playerCount, t.games, t.doubleLast);
    session.awarded = null;
    void playCurrentRound();
  };

  return screen(
    null,
    confetti(),
    h('h1', { class: 'winner' }, `🏆 ${winners.join(' & ')} win${winners.length > 1 ? '' : 's'}!`),
    h('div', { class: 'podium' }, ...steps),
    h(
      'div',
      { class: 'footer' },
      h('button', { class: 'btn', onclick: () => go('home') }, '🏠 Home'),
      h('button', { class: 'btn', onclick: () => go('locker') }, '🎒 Spend stars'),
      h('button', { class: 'btn primary big', onclick: rematch }, '🔁 Rematch'),
    ),
  );
}
