import { lookOf, store } from '../../core/profiles';
import { GAMES } from '../../games/registry';
import { go } from '../nav';
import { characterEl, h, screen } from '../ui';

function enterFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    // Not supported (iPhone Safari) – fine.
  }
}

export function homeScreen(): HTMLElement {
  const crowd = store.profiles.slice(0, 6).map((p) => characterEl(lookOf(p), 72));
  return screen(
    null,
    h('div', { class: 'logo' }, h('span', {}, '🎮'), h('h1', {}, 'Party Minigames')),
    h('p', { class: 'subtitle' }, `${GAMES.length} action games · 2–4 players · one screen`),
    crowd.length > 0 && h('div', { class: 'crowd' }, ...crowd),
    h(
      'div',
      { class: 'menu' },
      h('button', { class: 'btn big primary', onclick: () => (enterFullscreen(), go('players')) }, '▶ Play'),
      h('button', { class: 'btn big', onclick: () => go('locker') }, '🎒 Locker'),
      h('button', { class: 'btn', onclick: () => go('settings') }, '⚙️ Settings'),
    ),
  );
}
