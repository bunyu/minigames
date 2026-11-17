export type Slot = 'avatar' | 'hat' | 'glasses' | 'color';

export interface Item {
  id: string;
  slot: Slot;
  label: string;
  /** Emoji for avatar/hat/glasses; CSS hex for colours. */
  value: string;
  /** Stars needed to unlock. 0 = free. */
  price: number;
}

export const ITEMS: readonly Item[] = [
  // Avatars
  { id: 'av-cat', slot: 'avatar', label: 'Cat', value: '🐱', price: 0 },
  { id: 'av-dog', slot: 'avatar', label: 'Dog', value: '🐶', price: 0 },
  { id: 'av-bunny', slot: 'avatar', label: 'Bunny', value: '🐰', price: 0 },
  { id: 'av-bear', slot: 'avatar', label: 'Bear', value: '🐻', price: 0 },
  { id: 'av-fox', slot: 'avatar', label: 'Fox', value: '🦊', price: 15 },
  { id: 'av-panda', slot: 'avatar', label: 'Panda', value: '🐼', price: 15 },
  { id: 'av-frog', slot: 'avatar', label: 'Frog', value: '🐸', price: 20 },
  { id: 'av-penguin', slot: 'avatar', label: 'Penguin', value: '🐧', price: 20 },
  { id: 'av-lion', slot: 'avatar', label: 'Lion', value: '🦁', price: 30 },
  { id: 'av-tiger', slot: 'avatar', label: 'Tiger', value: '🐯', price: 30 },
  { id: 'av-unicorn', slot: 'avatar', label: 'Unicorn', value: '🦄', price: 50 },
  { id: 'av-dragon', slot: 'avatar', label: 'Dragon', value: '🐲', price: 80 },
  // Hats
  { id: 'hat-cap', slot: 'hat', label: 'Cap', value: '🧢', price: 10 },
  { id: 'hat-bow', slot: 'hat', label: 'Bow', value: '🎀', price: 10 },
  { id: 'hat-top', slot: 'hat', label: 'Top hat', value: '🎩', price: 20 },
  { id: 'hat-grad', slot: 'hat', label: 'Grad cap', value: '🎓', price: 25 },
  { id: 'hat-flower', slot: 'hat', label: 'Flower', value: '🌸', price: 30 },
  { id: 'hat-helmet', slot: 'hat', label: 'Helmet', value: '⛑️', price: 35 },
  { id: 'hat-mushroom', slot: 'hat', label: 'Mushroom', value: '🍄', price: 40 },
  { id: 'hat-crown', slot: 'hat', label: 'Crown', value: '👑', price: 60 },
  // Glasses
  { id: 'gl-sun', slot: 'glasses', label: 'Sunglasses', value: '🕶️', price: 15 },
  { id: 'gl-nerd', slot: 'glasses', label: 'Glasses', value: '👓', price: 15 },
  { id: 'gl-goggles', slot: 'glasses', label: 'Goggles', value: '🥽', price: 40 },
  // Colours
  { id: 'col-red', slot: 'color', label: 'Red', value: '#ef476f', price: 0 },
  { id: 'col-blue', slot: 'color', label: 'Blue', value: '#118ab2', price: 0 },
  { id: 'col-green', slot: 'color', label: 'Green', value: '#06d6a0', price: 0 },
  { id: 'col-yellow', slot: 'color', label: 'Yellow', value: '#ffd166', price: 0 },
  { id: 'col-purple', slot: 'color', label: 'Purple', value: '#9b5de5', price: 0 },
  { id: 'col-orange', slot: 'color', label: 'Orange', value: '#f77f00', price: 0 },
  { id: 'col-pink', slot: 'color', label: 'Pink', value: '#ff70a6', price: 15 },
  { id: 'col-sky', slot: 'color', label: 'Sky', value: '#4cc9f0', price: 15 },
  { id: 'col-lime', slot: 'color', label: 'Lime', value: '#a7e34b', price: 20 },
  { id: 'col-silver', slot: 'color', label: 'Silver', value: '#c0c7d0', price: 30 },
  { id: 'col-gold', slot: 'color', label: 'Gold', value: '#e9b949', price: 40 },
];

const byId = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): Item {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown item ${id}`);
  return item;
}

export function itemsFor(slot: Slot): Item[] {
  return ITEMS.filter((i) => i.slot === slot);
}

export const SLOT_LABELS: Record<Slot, string> = {
  avatar: 'Animal',
  hat: 'Hat',
  glasses: 'Glasses',
  color: 'Colour',
};
