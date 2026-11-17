export type ScreenName = 'home' | 'players' | 'games' | 'round' | 'podium' | 'locker' | 'settings';

type Render = () => HTMLElement;
const screens = new Map<ScreenName, Render>();

export function registerScreen(name: ScreenName, render: Render): void {
  screens.set(name, render);
}

export function go(name: ScreenName): void {
  const render = screens.get(name);
  if (!render) throw new Error(`No screen ${name}`);
  const app = document.getElementById('app')!;
  app.replaceChildren(render());
  app.scrollTop = 0;
}
