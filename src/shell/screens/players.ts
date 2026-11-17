import { itemsFor } from '../../core/items';
import { createProfile, getProfile, lookOf, owns, save, store, type Profile } from '../../core/profiles';
import { seatLabels } from '../../engine/zones';
import { go } from '../nav';
import { session, type Seat } from '../state';
import { characterEl, h, screen } from '../ui';

function ensureSeats(count: number): void {
  const used = () => new Set(session.seats.map((s) => s.profileId));
  // Restore last time's players the first time this screen opens.
  if (session.seats.length === 0) {
    for (const id of store.lastSeats.slice(0, 4)) if (getProfile(id)) session.seats.push({ profileId: id, headStart: false });
    if (session.seats.length < 2) session.seats.length = 0;
  }
  while (session.seats.length > count) session.seats.pop();
  while (session.seats.length < count) {
    const free = store.profiles.find((p) => !used().has(p.id));
    session.seats.push({ profileId: free?.id ?? null, headStart: false });
  }
}

export function playersScreen(): HTMLElement {
  if (session.seats.length === 0) ensureSeats(store.lastSeats.length >= 2 ? Math.min(4, store.lastSeats.length) : 2);
  const count = session.seats.length;
  const labels = seatLabels(count);
  const rerender = () => go('players');

  const profilesOnSeats = () => session.seats.map((s) => (s.profileId ? getProfile(s.profileId) : undefined));
  const colorTaken = (colorId: string, self: Profile) => profilesOnSeats().some((p) => p && p !== self && p.color === colorId);

  const seatCard = (seat: Seat, i: number) => {
    const profile = seat.profileId ? getProfile(seat.profileId) : undefined;
    const others = new Set(session.seats.filter((s) => s !== seat).map((s) => s.profileId));
    const select = h(
      'select',
      {
        class: 'select',
        onchange: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          seat.profileId = v === '' ? null : v;
          rerender();
        },
      },
      h('option', { value: '', selected: !profile }, '— choose —'),
      ...store.profiles
        .filter((p) => !others.has(p.id))
        .map((p) => h('option', { value: p.id, selected: p === profile }, p.name)),
    );

    const nameInput = h('input', { class: 'input', placeholder: 'New player name', maxLength: 12 });
    const addNew = () => {
      const name = nameInput.value.trim();
      if (!name) return nameInput.focus();
      const taken = profilesOnSeats().filter((p): p is Profile => !!p);
      seat.profileId = createProfile(name, taken).id;
      rerender();
    };
    nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && addNew());

    const swatches =
      profile &&
      h(
        'div',
        { class: 'swatches' },
        ...itemsFor('color')
          .filter((c) => owns(profile, c))
          .map((c) =>
            h('button', {
              class: `swatch${profile.color === c.id ? ' on' : ''}`,
              style: `--c:${c.value}`,
              title: c.label,
              disabled: colorTaken(c.id, profile),
              onclick: () => {
                profile.color = c.id;
                save();
                rerender();
              },
            }),
          ),
      );

    return h(
      'div',
      { class: 'card seat', style: profile ? `--color:${lookOf(profile).colorCss}` : '' },
      h('div', { class: 'seat-head' }, h('b', {}, `Player ${i + 1}`), h('small', {}, `sits ${labels[i]}`)),
      profile ? characterEl(lookOf(profile), 84) : h('div', { class: 'char empty' }, '?'),
      select,
      h('div', { class: 'row' }, nameInput, h('button', { class: 'btn small', onclick: addNew }, '＋')),
      swatches,
      profile &&
        h(
          'label',
          { class: 'check' },
          h('input', {
            type: 'checkbox',
            checked: seat.headStart,
            onchange: (e: Event) => (seat.headStart = (e.target as HTMLInputElement).checked),
          }),
          ' Head start (heavier / faster)',
        ),
    );
  };

  const ready = session.seats.every((s) => s.profileId);
  return screen(
    'Who is playing?',
    h(
      'div',
      { class: 'segmented' },
      ...[2, 3, 4].map((n) =>
        h('button', { class: `btn${n === count ? ' on' : ''}`, onclick: () => (ensureSeats(n), rerender()) }, `${n} players`),
      ),
    ),
    h('div', { class: 'seats' }, ...session.seats.map(seatCard)),
    h(
      'div',
      { class: 'footer' },
      h('button', { class: 'btn', onclick: () => go('home') }, '← Back'),
      h('button', { class: 'btn primary', disabled: !ready, onclick: () => go('games') }, 'Choose games →'),
    ),
  );
}
