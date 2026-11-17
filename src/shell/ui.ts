import type { Look } from '../core/profiles';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny DOM builder: h('button', { class: 'big', onclick: fn }, 'Play'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'style') el.style.cssText = String(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key in el) (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, String(value));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

/** DOM version of a player's character (matches engine/character.ts). */
export function characterEl(look: Look, size = 64): HTMLElement {
  return h(
    'div',
    { class: 'char', style: `--size:${size}px;--color:${look.colorCss}` },
    h('span', { class: 'char-avatar' }, look.avatar),
    look.glasses && h('span', { class: 'char-glasses' }, look.glasses),
    look.hat && h('span', { class: 'char-hat' }, look.hat),
  );
}

export function screen(title: string | null, ...children: Child[]): HTMLElement {
  return h('div', { class: 'screen' }, title && h('h1', {}, title), ...children);
}

export const MEDALS = ['🥇', '🥈', '🥉', '🎖️'];
