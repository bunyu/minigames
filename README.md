# Party Minigames

Action mini games for 2–4 players on one tablet. Pick 3–10 games, play a tournament, and see who ends up on the podium. Players earn ⭐ stars and spend them in the **Locker** on new animals, hats, glasses and colours.

- **Web / iPad / iPhone**: https://bunyu.github.io/minigames/ → Safari → Share → *Add to Home Screen* (runs fullscreen and offline)
- **Android**: Capacitor app in `android/`

See [docs/PLAN.md](docs/PLAN.md) for the full plan and game catalogue, and [docs/HANDOFF.md](docs/HANDOFF.md) for the current status and gotchas.

## Games (20)

| Game | Controls | | Game | Controls |
|---|---|---|---|---|
| 🤼 Sumo Bump | 1-button dash | | 🏎️ Kart Rally | ◀ ▶ steering |
| 🏍️ Light Trails | ◀ ▶ | | 👑 King of the Hill | joystick + dash |
| 🎯 Tank Twirl | hold to drive, release to fire | | 🤠 Showdown | 1-button (with fake-outs) |
| ☄️ Meteor Dodge | joystick | | 🌋 Lava Floor | joystick + jump |
| ⚡ Laser Jump | 1-button jump | | 🍉 Fruit Slash | swipe |
| 💣 Bomb Tag | joystick | | 🎈 Balloon Joust | joystick |
| ⚽ Bumper Soccer | joystick | | 💎 Gem Miner | hold to thrust |
| 🏓 Ping Square | drag | | 🧗 Spike Climb | 1-button jump |
| ❄️ Snowball Fight | joystick + throw | | 🏀 Hoop Shot | flick |
| 💰 Coin Grab | 1-button turn | | 🪑 Chair Dash | joystick |

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from a tablet on the same Wi-Fi)
npm test           # unit tests (scoring, tournament)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ on :4173
npm run smoke      # with preview running: plays a 4-player tournament in Edge and saves screenshots
```

> Windows: run Vitest from a path with an upper-case drive letter (`D:\work\minigames`), otherwise it fails with `Cannot read properties of undefined (reading 'config')`.

## Android

Requires JDK 21 (`JAVA_HOME`) and the Android SDK (`android/local.properties` → `sdk.dir`).

```bash
npm run android:apk   # → android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a device with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, or copy the APK over and open it.

## Adding a game

1. Create `src/games/<id>/<Name>Scene.ts` exporting a `GameMeta` and a scene that extends `BaseGameScene`.
2. Implement `buildGame()` (objects + controls via `TouchButton`, zones via `zoneContainer`/`outerCorner`), `startGame()`, `tick(dt)`.
3. Call `this.finish(placements, stats)` once; use `placementsFromScores` for ties.
4. Register it in `src/games/registry.ts`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: tests, build, and deploy to GitHub Pages.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.
