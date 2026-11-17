# Handoff – Party Minigames

_Last updated: 2026-11-17 · version 0.1.0 · 20 games_

Read this first when picking the project up. Background and the original plan are in [PLAN.md](PLAN.md); the README has the commands.

## What it is

Original action mini games for 2–4 players (kids 8–11 + parents) on **one tablet lying flat in landscape**. Players pick 3–10 games, play a tournament, and get a podium. Stars earned unlock animals, hats, glasses and colours in the **Locker**.

- Web/PWA (iPad, iPhone): https://bunyu.github.io/minigames/ – deployed by GitHub Actions on every push to `main`.
- Android: Capacitor app in `android/` (debug APK builds locally).

## Decisions already made (don't re-ask)

| Topic | Decision |
|---|---|
| Engine | Phaser 3 (games) + plain DOM/TS (menus) |
| Hosting | GitHub Pages, public repo `bunyu/minigames`, Pages **Source = GitHub Actions** |
| Device | Tablet-first, landscape; phones best effort |
| Language | English only |
| Game style | **Action games**, not trivially easy ones (user asked for this explicitly). Moving characters, physics, escalating difficulty |
| Players | **No names.** A player is an animal + colour ("Red Cat"). Profiles exist only to keep stars/unlocks |
| Free animals | cat, dog, bunny, bear, **tiger, goat, horse** (user asked for tiger, dog, goat, horse) |
| Theme | Bright "sunny playground": sky background, white cards, chunky 3D buttons, Fredoka font (bundled via `@fontsource/fredoka`) |
| Kids' safety | No full-screen flashes (removed on purpose), no ads, no network, no accounts |
| Content | All games original (no copies of existing games' names/art) |

## Status

- Milestones M0–M4 and M6 done (scaffold, core loop, all 20 games). M5 polish partly done: sound effects ✅, bright theme ✅, animated how-to-play demos ✅.
- Verified: `tsc`, 30 unit tests, production build, and automated 4-player tournaments covering all 20 games (Edge + real multi-touch events via `scripts/smoke.mjs`).
- **Not verified yet:** real devices (iPad, Android tablet, phones), 2- and 3-player layouts in the smoke test, and how fun/difficult each game actually is. A family playtest is the most valuable next step.

## Architecture in 1 minute

```
src/core/      pure logic: scoring.ts, tournament.ts (unit-tested), profiles.ts (localStorage), items.ts (unlockables), audio.ts (synth SFX)
src/engine/    BaseGameScene (intro → countdown → play → finish), zones.ts (seat layout), controls.ts (TouchButton),
               joystick.ts, physics.ts (pure, unit-tested), demo.ts (how-to-play animations), character.ts
src/games/     one folder per game + registry.ts (list of all games)
src/shell/     DOM screens (home, players, games, round, podium, locker, settings), gameHost.ts runs a Phaser scene and returns its result
tests/         Vitest: scoring, tournament, physics, kart track
scripts/       make-icons.mjs (PNG icons without deps), smoke.mjs (end-to-end run in Edge)
android/       Capacitor project (MainActivity: keep screen on, immersive, landscape)
```

Key ideas:
- **Zones**: seats go clockwise from bottom-left (BL, BR, TR, TL). Top seats are rotated 180°. `zoneContainer(seat)` gives a container where local +y points toward that player. Controls live in each player's outer corner (`outerCorner`). Arena games keep side columns free for controls (`arenaRect`/`drawArena`).
- **Game contract**: extend `BaseGameScene`, implement `buildGame()`, `startGame()`, `tick(dt)`, call `this.finish(placementsFromScores(scores), stats)` once. Meta needs `gesture` + `tips` for the intro demo. Register in `registry.ts`.
- **Scoring**: placements per game (ties share), points 4p 5/3/2/1, 3p 4/2/1, 2p 3/1, optional double last game; final tie-break by wins, then 2nd places. Stars = points + 2 (+5 winner).
- **Fairness tricks**: Fruit Slash and Spike Climb send identical throws/spikes to everyone; handicap ("🐢 Head start") gives a small per-game advantage.

## Gotchas

- **Vitest on Windows** must run from an upper-case drive path (`D:\work\minigames`), e.g. via PowerShell. From `d:\…` it fails with `Cannot read properties of undefined (reading 'config')`.
- **Android build** needs `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot` and `android/local.properties` (`sdk.dir=C\:\\Users\\qsus\\AppData\\Local\\Android\\Sdk`, git-ignored). Run `npm run android:sync` then `gradlew.bat assembleDebug` in `android/` (call it via `cmd /c ".\gradlew.bat …"` from PowerShell).
- **Emoji support** varies: newer emoji (e.g. 🪙 coin, 🪨 rock, 🫸) show as boxes on older devices. Coin Grab coins are drawn for that reason. Prefer emoji from Unicode ≤ 12.
- **Phaser text font**: `FONT` in `engine/character.ts` uses Fredoka; `main.ts` preloads it.
- **Smoke test** taps hard-coded positions for a 1280×800 viewport with 4 players. If you move controls, update `scripts/smoke.mjs`. `SMOKE_GAMES=1,5,9 npm run smoke` runs only some games (1-based card order). It needs `npm run preview` running.
- `gh` CLI isn't installed; check Actions runs with `curl https://api.github.com/repos/bunyu/minigames/actions/runs?per_page=3`.
- No ESLint/Prettier yet (listed in the plan's M0 but not added).

## Suggested next steps

1. Family playtest on the real tablet; tune speeds/timers per game (constants at the top of each scene).
2. Run the smoke test with 2 and 3 players (parametrise `scripts/smoke.mjs` positions from `computeZones`).
3. Background music + volume setting; victory dance unlockables (in PLAN §2.5, marked "later").
4. Sudden-death tie-break with Showdown when the final ranking is still tied (currently tied players share the rank).
5. Signed release APK (keystore kept out of git) and optional Play Store listing.
6. ESLint + Prettier, and the CI job could also build the APK.
