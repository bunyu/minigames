import { itemsFor } from '../../core/items';
import { createProfile, getProfile, lookOf, owns, save, store, type Profile } from '../../core/profiles';
import { seatLabels } from '../../engine/zones';
import { go } from '../nav';
import { session, type Seat } from '../state';
import { characterEl, h, screen } from '../ui';

/** Make sure there are `count` seats, each with its own profile (new ones are created as needed). */
function ensureSeats(count: number): void {
  if (session.seats.length === 0) {
    // Start with last time's players.
    for (const id of store.lastSeats.slice(0, 4)) if (getProfile(id)) session.seats.push({ profileId: id, headStart: false });
  }
  while (session.seats.length > count) session.seats.pop();
  while (session.seats.length < count) {
    const used = new Set(session.seats.map((s) => s.profileId));
    const free = store.profiles.find((p) => !used.has(p.id));
    const profile = free ?? createProfile(seated());
    session.seats.push({ profileId: profile.id, headStart: false });
  }
  fixColorClashes();
}

function seated(): Profile[] {
  return session.seats.map((s) => (s.profileId ? getProfile(s.profileId) : undefined)).filter((p): p is Profile => !!p);
}

/** Two seated players can't share a colour: give the later one the first free owned colour. */
function fixColorClashes(): void {
  const used = new Set<string>();
  for (const p of seated()) {
    if (used.has(p.color)) {
      const free = itemsFor('color').find((c) => owns(p, c) && !used.has(c.id));
      if (free) p.color = free.id;
    }
    used.add(p.color);
  }
  save();
}

export function playersScreen(): HTMLElement {
  ensureSeats(session.seats.length >= 2 ? session.seats.length : Math.max(2, Math.min(4, store.lastSeats.length)));
  const count = session.seats.length;
  const labels = seatLabels(count);
  const rerender = () => go('players');
  const colorTaken = (colorId: string, self: Profile) => seated().some((p) => p !== self && p.color === colorId);

  const seatCard = (seat: Seat, i: number) => {
    const profile = getProfile(seat.profileId!)!;
    const look = lookOf(profile);
    const others = new Set(session.seats.filter((s) => s !== seat).map((s) => s.profileId));
    const switchTo = store.profiles.filter((p) => p !== profile && !others.has(p.id));

    const animals = h(
      'div',
      { class: 'animals' },
      ...itemsFor('avatar')
        .filter((a) => owns(profile, a))
        .map((a) =>
          h(
            'button',
            {
              class: `animal${profile.avatar === a.id ? ' on' : ''}`,
              title: a.label,
              onclick: () => {
                profile.avatar = a.id;
                save();
                rerender();
              },
            },
            a.value,
          ),
        ),
    );

    const swatches = h(
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

    // Saved players (with their stars and unlocked items) can sit here instead.
    const switcher =
      switchTo.length > 0 &&
      h(
        'div',
        { class: 'switcher' },
        h('small', {}, 'Or play as:'),
        ...switchTo.map((p) =>
          h(
            'button',
            {
              class: 'pick',
              title: `${lookOf(p).name} · ⭐ ${p.stars}`,
              onclick: () => {
                seat.profileId = p.id;
                fixColorClashes();
                rerender();
              },
            },
            characterEl(lookOf(p), 40),
          ),
        ),
      );

    return h(
      'div',
      { class: 'card seat', style: `--color:${look.colorCss}` },
      h('div', { class: 'seat-head' }, h('b', {}, `Player ${i + 1}`), h('small', {}, `sits ${labels[i]}`)),
      characterEl(look, 96),
      h('div', { class: 'stars-chip' }, `⭐ ${profile.stars}`),
      animals,
      swatches,
      switcher,
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: seat.headStart,
          onchange: (e: Event) => (seat.headStart = (e.target as HTMLInputElement).checked),
        }),
        ' 🐢 Head start',
      ),
    );
  };

  return screen(
    'Pick your animal!',
    h(
      'div',
      { class: 'segmented' },
      ...[2, 3, 4].map((n) =>
        h('button', { class: `btn${n === count ? ' on' : ''}`, onclick: () => (ensureSeats(n), rerender()) }, `${'🙂'.repeat(n)} ${n}`),
      ),
    ),
    h('div', { class: 'seats' }, ...session.seats.map(seatCard)),
    h(
      'div',
      { class: 'footer' },
      h('button', { class: 'btn', onclick: () => go('home') }, '← Back'),
      h('button', { class: 'btn primary big', onclick: () => go('games') }, 'Choose games →'),
    ),
  );
}
