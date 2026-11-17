import { itemsFor, SLOT_LABELS, type Item, type Slot } from '../../core/items';
import { buyAndEquip, equip, lookOf, owns, store, type Profile } from '../../core/profiles';
import { go } from '../nav';
import { characterEl, h, screen } from '../ui';

let selectedId: string | null = null;

function isEquipped(p: Profile, item: Item): boolean {
  return p[item.slot] === item.id;
}

export function lockerScreen(): HTMLElement {
  const rerender = () => go('locker');
  const profiles = store.profiles;
  if (profiles.length === 0) {
    return screen(
      '🎒 Locker',
      h('p', { class: 'hint' }, 'Play a game first – then come back to spend your stars!'),
      h('div', { class: 'footer' }, h('button', { class: 'btn', onclick: () => go('home') }, '← Home')),
    );
  }
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0];
  selectedId = profile.id;
  const look = lookOf(profile);

  const tabs = h(
    'div',
    { class: 'segmented wrap' },
    ...profiles.map((p) =>
      h('button', { class: `pick${p === profile ? ' on' : ''}`, title: lookOf(p).name, onclick: () => ((selectedId = p.id), rerender()) }, characterEl(lookOf(p), 52)),
    ),
  );

  const tile = (item: Item) => {
    const have = owns(profile, item);
    const on = isEquipped(profile, item);
    const affordable = profile.stars >= item.price;
    const face = item.slot === 'color' ? h('span', { class: 'swatch big', style: `--c:${item.value}` }) : h('span', { class: 'tile-emoji' }, item.value);
    return h(
      'button',
      {
        class: `tile${on ? ' on' : ''}${have ? '' : ' locked'}`,
        disabled: !have && !affordable,
        onclick: () => {
          if (have) equip(profile, item);
          else if (!window.confirm(`Unlock ${item.label} for ${item.price} ⭐?`)) return;
          else buyAndEquip(profile, item);
          rerender();
        },
      },
      face,
      h('small', {}, have ? (on ? 'Wearing' : item.label) : `⭐ ${item.price}`),
    );
  };

  const sections = (['avatar', 'hat', 'glasses', 'color'] as Slot[]).map((slot) =>
    h('section', {}, h('h2', {}, SLOT_LABELS[slot]), h('div', { class: 'tiles' }, ...itemsFor(slot).map(tile))),
  );

  return screen(
    '🎒 Locker',
    tabs,
    h(
      'div',
      { class: 'locker-head card', style: `--color:${look.colorCss}` },
      characterEl(look, 120),
      h(
        'div',
        { class: 'grow' },
        h('h2', {}, look.name),
        h('div', { class: 'stars' }, `⭐ ${profile.stars}`),
        h('small', {}, `${profile.stats.tournaments} tournaments · ${profile.stats.tournamentWins} won · ${profile.stats.gameWins} game wins`),
      ),
    ),
    ...sections,
    h('div', { class: 'footer' }, h('button', { class: 'btn', onclick: () => go('home') }, '← Home')),
  );
}
