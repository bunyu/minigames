import { deleteProfile, save, store } from '../../core/profiles';
import { go } from '../nav';
import { session } from '../state';
import { h, screen } from '../ui';

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
    ),
    h(
      'div',
      { class: 'card' },
      h('h2', {}, 'Players'),
      ...store.profiles.map((p) =>
        h(
          'div',
          { class: 'row' },
          h('span', { class: 'grow' }, `${p.name} · ⭐ ${p.stars}`),
          h(
            'button',
            {
              class: 'btn small',
              onclick: () => {
                if (!window.confirm(`Delete ${p.name} and all their stars?`)) return;
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
