// End-to-end smoke test: 4 players, a tournament of every game, real multi-touch on the canvas.
// Usage: npm run preview (in another terminal), then: node scripts/smoke.mjs [baseUrl] [outDir]
// Uses the locally installed Microsoft Edge (or Chrome with BROWSER=chrome).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'smoke-shots';
mkdirSync(out, { recursive: true });

const W = 1280;
const H = 800;
const browser = await chromium.launch({ channel: process.env.BROWSER ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await shot('01-home');

await page.getByText('▶ Play').click();
await page.getByText('4 players').click();
for (const [i, name] of ['Mia', 'Leo', 'Dad', 'Mum'].entries()) {
  await page.locator('.seat').nth(i).locator('input.input').fill(name);
  await page.locator('.seat').nth(i).getByText('＋').click();
}
await shot('02-players');
await page.getByText('Choose games →').click();
const gameCount = await page.locator('.game-card').count();
for (let i = 0; i < gameCount; i++) await page.locator('.game-card').nth(i).click();
await shot('03-games');
await page.getByText(new RegExp(`^Start ${gameCount} games`)).click();

// 4-player zones on 1280x800: READY buttons and every in-game control position.
const ready = [
  [320, 712],
  [960, 712],
  [960, 88],
  [320, 88],
];
const cdp = await page.context().newCDPSession(page);
const touch = (type, points) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
const jitter = ([x, y], d = 45) => [x + (Math.random() - 0.5) * 2 * d, y + (Math.random() - 0.5) * 2 * d];
// Corner controls (joysticks, DASH / HOLD / JUMP buttons) for the 4 seats.
const corners = [[100, 700], [1180, 700], [1180, 100], [100, 100]];
const controls = [
  // Sumo Bump DASH (outer corners)
  [100, 700], [1180, 700], [1180, 100], [100, 100],
  // Light Trails ◀ ▶
  [128, 724], [512, 724], [768, 724], [1152, 724], [1152, 76], [768, 76], [512, 76], [128, 76],
];

for (let round = 1; round <= gameCount; round++) {
  await page.waitForTimeout(800);
  await shot(`10-round${round}-intro`);
  for (const [x, y] of ready) await page.touchscreen.tap(x, y);
  await page.waitForTimeout(3200);
  let took = false;
  const start = Date.now();
  while (!(await page.locator('#app').isVisible())) {
    if (Math.random() < 0.5) {
      // All four players hold and drag their corner control at the same time.
      const held = corners.map((c) => jitter(c, 20));
      await touch('touchStart', held);
      await touch('touchMove', held.map((c) => jitter(c, 60)));
      await page.waitForTimeout(100 + Math.random() * 400);
      await touch('touchEnd', []);
    } else {
      const [x, y] = controls[Math.floor(Math.random() * controls.length)];
      await page.touchscreen.tap(x, y);
    }
    if (!took && Date.now() - start > 2500) {
      await shot(`11-round${round}-play`);
      took = true;
    }
    if (Date.now() - start > 120_000) throw new Error(`Round ${round} did not finish`);
    await page.waitForTimeout(60);
  }
  console.log(`round ${round}: ${((Date.now() - start) / 1000).toFixed(1)} s of play`);
  await page.waitForTimeout(1200);
  await shot(`12-round${round}-result`);
  const next = page.getByText(/^Next:|See the winner/);
  await next.click();
}
await page.waitForTimeout(1500);
await shot('20-podium');
await page.getByText('🎒 Spend stars').click();
await shot('21-locker');

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Smoke test passed. Screenshots in ${out}/`);
