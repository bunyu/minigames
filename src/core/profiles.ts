import { getItem, itemsFor, type Item } from './items';

export interface Profile {
  id: string;
  name: string;
  color: string; // item id
  avatar: string; // item id
  hat: string | null; // item id
  glasses: string | null; // item id
  stars: number;
  owned: string[]; // item ids bought with stars
  stats: { tournaments: number; tournamentWins: number; gameWins: number };
}

export interface Settings {
  unlockAll: boolean;
  doubleLast: boolean;
}

export interface SaveData {
  version: 1;
  profiles: Profile[];
  settings: Settings;
  lastSeats: string[];
}

const KEY = 'party-minigames.v1';

function defaults(): SaveData {
  return { version: 1, profiles: [], settings: { unlockAll: false, doubleLast: false }, lastSeats: [] };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 || !Array.isArray(data.profiles)) return defaults();
    return { ...defaults(), ...data, settings: { ...defaults().settings, ...data.settings } };
  } catch {
    return defaults();
  }
}

export const store: SaveData = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable (private mode): the game still works for this session.
  }
}

export function getProfile(id: string): Profile | undefined {
  return store.profiles.find((p) => p.id === id);
}

export function owns(profile: Profile, item: Item): boolean {
  return item.price === 0 || store.settings.unlockAll || profile.owned.includes(item.id);
}

/** Create a profile with a colour and animal not used by `taken` profiles. */
export function createProfile(name: string, taken: Profile[] = []): Profile {
  const usedColors = new Set(taken.map((p) => p.color));
  const usedAvatars = new Set(taken.map((p) => p.avatar));
  const freeColors = itemsFor('color').filter((i) => i.price === 0);
  const freeAvatars = itemsFor('avatar').filter((i) => i.price === 0);
  const profile: Profile = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, 12) || 'Player',
    color: (freeColors.find((c) => !usedColors.has(c.id)) ?? freeColors[0]).id,
    avatar: (freeAvatars.find((a) => !usedAvatars.has(a.id)) ?? freeAvatars[0]).id,
    hat: null,
    glasses: null,
    stars: 0,
    owned: [],
    stats: { tournaments: 0, tournamentWins: 0, gameWins: 0 },
  };
  store.profiles.push(profile);
  save();
  return profile;
}

export function deleteProfile(id: string): void {
  store.profiles = store.profiles.filter((p) => p.id !== id);
  store.lastSeats = store.lastSeats.filter((s) => s !== id);
  save();
}

/** Buy (if needed) and equip an item. Returns false when the player can't afford it. */
export function buyAndEquip(profile: Profile, item: Item): boolean {
  if (!owns(profile, item)) {
    if (profile.stars < item.price) return false;
    profile.stars -= item.price;
    profile.owned.push(item.id);
  }
  equip(profile, item);
  return true;
}

export function equip(profile: Profile, item: Item): void {
  if (item.slot === 'hat') profile.hat = profile.hat === item.id ? null : item.id;
  else if (item.slot === 'glasses') profile.glasses = profile.glasses === item.id ? null : item.id;
  else profile[item.slot] = item.id;
  save();
}

/** Resolved look of a profile, used by both the DOM shell and Phaser games. */
export interface Look {
  name: string;
  colorCss: string;
  color: number;
  avatar: string;
  hat: string | null;
  glasses: string | null;
}

export function lookOf(p: Profile): Look {
  const colorCss = getItem(p.color).value;
  return {
    name: p.name,
    colorCss,
    color: parseInt(colorCss.slice(1), 16),
    avatar: getItem(p.avatar).value,
    hat: p.hat ? getItem(p.hat).value : null,
    glasses: p.glasses ? getItem(p.glasses).value : null,
  };
}
