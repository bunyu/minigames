import { sfx } from '../../core/audio';
import { deleteProfile, lookOf, save, store } from '../../core/profiles';
import { go } from '../nav';
import { session } from '../state';
import { characterEl, h, screen } from '../ui';

export function settingsScreen(): HTMLElement {
  const rerender = () => go('settings');
  return screen(
    '⚙️ Settings',
    h(
      'div',
      { class: 'card' },
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: store.settings.unlockAll,
          onchange: (e: Event) => {
            store.settings.unlockAll = (e.target as HTMLInputElement).checked;
            save();
          },
        }),
        ' Everything unlocked (parents)',
      ),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: store.settings.sound,
          onchange: (e: Event) => {
            store.settings.sound = (e.target as HTMLInputElement).checked;
            save();
            sfx('coin');
          },
        }),
        ' Sound effects',
      ),
    ),
    h(
      'div',
      { class: 'card' },
      h('h2', {}, 'Players'),
      ...store.profiles.map((p) =>
        h(
          'div',
          { class: 'row' },
          characterEl(lookOf(p), 44),
          h('span', { class: 'grow' }, `${lookOf(p).name} · ⭐ ${p.stars}`),
          h(
            'button',
            {
              class: 'btn small',
              onclick: () => {
                if (!window.confirm(`Delete ${lookOf(p).name} and all their stars?`)) return;
                deleteProfile(p.id);
                session.seats = session.seats.filter((s) => s.profileId !== p.id);
                rerender();
              },
            },
            '🗑️',
          ),
        ),
      ),
    ),
    h('p', { class: 'hint' }, `Version ${__APP_VERSION__}`),
    h('div', { class: 'footer' }, h('button', { class: 'btn', onclick: () => go('home') }, '← Home')),
  );
}
