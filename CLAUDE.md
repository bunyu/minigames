# Party Minigames

Action mini games for 2–4 players on one tablet (Phaser 3 + TypeScript + Vite, PWA on GitHub Pages, Android via Capacitor).

**Start by reading [docs/HANDOFF.md](docs/HANDOFF.md)**: current status, decisions already made, gotchas and next steps. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Commands

- `npm run dev`: dev server
- `npm test`: unit tests. On Windows run from `D:\work\minigames` (upper-case drive), e.g. through PowerShell
- `npm run build`: type-check + production build
- `npm run preview`, then `node scripts/smoke.mjs`: end-to-end tournament in Edge with screenshots (`SMOKE_GAMES=1,2,3` to limit)
- `npm run android:sync` then `cd android && gradlew.bat assembleDebug` (needs JDK 21 in `JAVA_HOME`)

## Rules of thumb

- Players have no names: they are an animal + colour. Keep games action-heavy and original.
- New game = folder in `src/games/` extending `BaseGameScene` + `gesture`/`tips` in its meta + one line in `src/games/registry.ts`.
- Keep pure logic (scoring, physics, track maths) in plain modules with Vitest tests.
- No full-screen flashes; avoid emoji newer than Unicode 12.
