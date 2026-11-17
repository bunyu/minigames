# Party Minigames – Project Plan

A collection of original 2–4 player mini games played on **one shared device** (phone or tablet lying on the table, every player gets a corner or edge of the screen). Players run a **tournament** of 3–10 selected games, collect points, and finish with a podium.

Target players: kids 8–11 plus parents. No ads, no accounts, no network, works fully offline.

---

## 1. Platforms & Technology

One TypeScript codebase, two delivery targets:

| Target | How | Notes |
|---|---|---|
| **Web / iPhone / iPad** | Progressive Web App (PWA) hosted on GitHub Pages | "Add to Home Screen" in Safari → fullscreen, offline, app icon. No Apple developer account needed. |
| **Android** | Same web build wrapped with **Capacitor** → APK / AAB | Sideload APK on family devices; Play Store optional later. |

### Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript | Type safety across many game modules |
| Build | Vite | Fast dev server, simple config, easy PWA plugin |
| Game engine | **Phaser 3** | Mature 2D engine, good multi-touch, physics (Arcade), tweens, audio, scenes |
| Menus / shell | Plain DOM + CSS (no framework) | Menus are simple; DOM gives crisp text and easy layout |
| PWA | `vite-plugin-pwa` (Workbox) | Offline caching, manifest, icons |
| Android | Capacitor 7 | Wraps the `dist/` folder; screen orientation + keep-awake plugins |
| Tests | Vitest (logic), Playwright (smoke tests in a mobile viewport) | Scoring/tournament logic must be correct |
| CI/CD | GitHub Actions | Lint + test + build on push; deploy PWA to Pages; optional APK artifact |
| Art | Emoji/vector shapes drawn in code + a small set of free (CC0) sprites/sounds, e.g. Kenney.nl | Fast to produce, no licensing issues |

### Local toolchain status (this PC)
- Node 24 / npm 11: ✅
- Android SDK (platforms 35/36, build-tools 35/36): ✅
- JDK 21 (Temurin 21.0.13): ✅ installed 2026-11-17

---

## 2. Core Experience

### 2.1 Flow
```
Home ─► Player Setup ─► Tournament Setup ─► [ Intro ► Game ► Round Result ] x N ─► Final Podium
                                                   ▲                    │
                                                   └──── Scoreboard ────┘
```

1. **Home** – Play, Quick Play (random 5 games), Settings.
2. **Player Setup** – 2, 3 or 4 players. Each picks a color, an animal avatar and a name (remembered between sessions).
3. **Tournament Setup**
   - Pick games individually (grid of game cards) or press "Random".
   - Min **3**, max **10** games. Games that don't support the current player count are greyed out.
   - Order: as picked, or shuffled.
4. **Game Intro** – big title, 1-sentence instructions, animated "how to play" demo, every player taps "Ready" in their own corner → 3-2-1 countdown.
5. **Game** – typically 20–60 seconds.
6. **Round Result** – placement for this game, points earned animation, running scoreboard.
7. **Final Podium** – 1st/2nd/3rd with confetti, total points, stats ("most wins", "fastest reaction"). Buttons: Rematch (same games), New Tournament, Home.

### 2.2 Screen layout on a shared device
The device lies flat; the screen is split into **player zones**, each rotated to face its player.

| Players | Layout (landscape tablet / phone) |
|---|---|
| 2 | Left half / right half (each rotated 90° toward its player), or top/bottom on phone portrait |
| 3 | Three zones: two corners on one side, one centred on the opposite side |
| 4 | Four corners, each rotated toward its corner |

A shared `ZoneLayout` helper computes zone rectangles + rotation for any game, so games only say "give me a button per player" or "give me a play area per player".

### 2.3 Scoring
Each game returns a **placement** for every player (ties allowed).

| Placement | 2 players | 3 players | 4 players |
|---|---|---|---|
| 1st | 3 | 4 | 5 |
| 2nd | 1 | 2 | 3 |
| 3rd | – | 1 | 2 |
| 4th | – | – | 1 |

- Ties share the higher placement's points (two players tied for 1st both get 1st-place points).
- **Optional "Final Bonus"**: last game of the tournament counts double (toggle in Tournament Setup) – keeps the ending exciting.
- **Final ranking** = total points. Tie-break: (1) most 1st places, (2) most 2nd places, (3) a sudden-death **Showdown** round between the tied players.

### 2.4 Kid-friendly fairness
- **Handicap / head start** per player (off by default): e.g. younger player gets +15% speed in race games, or a little extra time in brain games. Each game declares how it applies the handicap.
- Big touch targets (min 64 px), high contrast, no reading needed beyond short instructions (icons + demo animation).
- False starts are penalised gently (freeze 1 s) rather than instant loss.
- Short games, quick restarts, no "game over" humiliation – every player always gets points.

### 2.5 Profiles, colours & unlockables
- Each family member has a **profile** saved on the device: name, colour, avatar, equipped items, star balance, lifetime stats.
- Player Setup picks profiles for seats 1–4 (or "+ New player"). Two seated players can't share a colour.
- **Stars ⭐**: at the end of a tournament each player earns stars = their tournament points (+5 bonus for the winner, +2 for finishing). Everyone earns something every time.
- **Locker** screen (per profile): spend stars to unlock and equip cosmetics, which show everywhere the player's character appears (setup, games, podium).

| Slot | Free at start | Unlockable examples (price ⭐) |
|---|---|---|
| Avatar (animal) | 🐱 🐶 🐰 🐻 | 🦊 15 · 🐼 15 · 🐸 20 · 🐧 20 · 🦁 30 · 🐯 30 · 🦄 50 · 🐲 80 |
| Hat | none | 🧢 cap 10 · 🎀 bow 10 · 🎩 top hat 20 · 👑 crown 60 · 🎓 grad cap 25 · 🌸 flower 30 · ⛑️ helmet 35 · 🍄 mushroom 40 |
| Glasses / face | none | 🕶️ sunglasses 15 · 👓 glasses 15 · 🥽 goggles 40 |
| Colour | 6 basic colours | pink 15 · sky 15 · lime 20 · silver 30 · gold 40 |
| Victory dance *(later)* | bounce | spin 20 · flip 30 · fireworks 60 |

- Item catalogue is data (`src/core/items.ts`) so adding items is one line.
- Prices are tuned so a typical 5-game tournament (≈10–20 ⭐) unlocks something new every 1–2 tournaments.
- Option in Settings: "Everything unlocked" (for parents).

### 2.6 Settings
Sound effects / music volume, vibration on/off, handicap per player, reset saved names, language (English first; Vietnamese/French can be added via a simple string table).

---

## 3. Mini Game Catalogue (20 games, all original, action-first)

Design rule: **real skill and movement, not trivial tapping.** Every game has moving characters, physics or aiming, escalating difficulty (speeds up / arena shrinks), and lasts 30–90 s. Mostly elimination or point battles where players directly interact (bump, shoot, steal).

Control schemes (all multi-touch, inside each player's zone):
- **1-button**: character rotates/moves automatically; tapping/holding changes what it does (dash, jump, thrust, fire). Simple to learn, hard to master.
- **L/R buttons**: steer left/right.
- **Joystick**: a virtual thumb-stick in your corner (+ an action button for some games).
- **Drag / swipe**: direct touch on your own part of the field.

| # | Game | Controls | Description | Placement |
|---|---|---|---|---|
| 1 | **Sumo Bump** | 1-button | Your sumo spins; tap to dash the way you face. Bump others off the shrinking ice mat. | Elimination order |
| 2 | **Light Trails** | L/R | Drive a glowing bike that leaves a deadly trail. Speeds up over time. | Elimination order |
| 3 | **Tank Twirl** | 1-button | Tank rotates; hold to drive, release to fire bouncing shells. 3 hits and you're out. | Elimination order |
| 4 | **Meteor Dodge** | Joystick | Meteors rain from all sides, faster and bigger every few seconds. Shoves between players allowed. | Last survivor |
| 5 | **Bumper Soccer** | Joystick | Each player guards a goal on their side; push the ball into the others' goals. 3 goals against = out. | Elimination order |
| 6 | **Ping Square** | Drag | Four-sided pong with multiple balls and speed-ups. Each goal conceded = −1 life. | Elimination order |
| 7 | **Lava Floor** | Joystick + jump | Floor tiles crack and fall into lava; keep moving, jump gaps, push rivals. | Last survivor |
| 8 | **Snowball Fight** | Joystick + throw | Run around snow forts, throw snowballs (aim = facing). 3 hits = out. | Elimination order |
| 9 | **Laser Jump** | 1-button | Laser beams sweep around the centre, getting faster, sometimes two at once or reversing. Tap to jump. | Last survivor |
| 10 | **Coin Grab** | 1-button | Runners circle the arena; tap to turn. Grab coins, avoid bombs that make you drop coins for others. | Coins after 45 s |
| 11 | **Bomb Tag** | Joystick | One player has the bomb – touch someone to pass it. When it explodes the holder is out. | Elimination order |
| 12 | **Kart Rally** | L/R | Top-down race, auto-accelerate, steer around a twisty track with oil slicks and boosts. 3 laps. | Finish order |
| 13 | **King of the Hill** | Joystick + dash | A glowing zone moves around; stand in it alone to score. Dash to knock others out. | Points after 60 s |
| 14 | **Fruit Slash** | Swipe | Fruit flies up in your half – swipe to slice, combo for bonus, slicing a bomb costs points. | Points after 40 s |
| 15 | **Balloon Joust** | Joystick | Balloons on your back, a lance in front: pop others' balloons, protect yours. | Elimination order |
| 16 | **Gem Miner** | 1-button | Spaceships rotate; hold to thrust. Collect gems, avoid asteroids, ram others to steal gems. | Gems after 60 s |
| 17 | **Spike Climb** | L/R | Race up a tower by jumping between left and right walls, dodging spikes. Gets faster. | Height / finish order |
| 18 | **Hoop Shot** | Flick | Flick balls into a moving hoop; distant shots score more. | Points after 45 s |
| 19 | **Chair Dash** | Joystick | Music stops → run to a free chair. One fewer chair each round. | Elimination order |
| 20 | **Showdown** | 1-button | Cowboy duel with fake-outs (yellow lights, sounds, decoys). Early shot = stunned. Best of 7. | Rounds won (also the tie-break game) |

Each game has a difficulty ramp; the handicap setting gives a younger player slightly more speed, a bigger hitbox margin or one extra life.

---

## 4. Architecture

```
minigames/
├─ docs/PLAN.md
├─ public/                  icons, manifest images, sounds
├─ src/
│  ├─ main.ts               bootstraps shell + Phaser
│  ├─ shell/                DOM screens: home, players, tournament setup, results, podium, settings
│  ├─ core/
│  │  ├─ tournament.ts      tournament state machine (pure, unit-tested)
│  │  ├─ scoring.ts         placement → points, tie-breaks (pure, unit-tested)
│  │  ├─ players.ts         player profiles, colours, avatars
│  │  ├─ storage.ts         localStorage wrapper (names, settings, last tournament)
│  │  └─ audio.ts           SFX/music manager (unlock on first tap for iOS)
│  ├─ engine/
│  │  ├─ BaseGameScene.ts   common lifecycle: intro → countdown → play → finish(result)
│  │  ├─ ZoneLayout.ts      per-player zones and rotation for 2/3/4 players
│  │  ├─ PlayerButton.ts    reusable multi-touch button bound to one player zone
│  │  └─ effects.ts         confetti, shake, popups
│  ├─ games/
│  │  ├─ registry.ts        list of all games (metadata + scene class)
│  │  ├─ sumo-bump/
│  │  ├─ light-trails/
│  │  └─ …                  one folder per game
│  └─ i18n/en.ts
├─ tests/                   Vitest unit tests + Playwright smoke test
├─ android/                 generated by Capacitor (committed)
├─ capacitor.config.ts
└─ vite.config.ts
```

### Game module contract
```ts
export interface GameMeta {
  id: string;                 // 'sumo-bump'
  title: string;              // 'Sumo Bump'
  icon: string;               // emoji or asset key
  tags: GameTag[];            // ['reflex']
  minPlayers: 2 | 3;
  maxPlayers: 4;
  approxSeconds: number;      // for the tournament length estimate
  howToPlay: string;          // one short sentence
}

export interface GameResult {
  placements: Record<PlayerId, number>; // 1 = first, ties share a number
  stats?: Record<PlayerId, string>;     // e.g. 'reaction 212 ms'
}

// Every game extends BaseGameScene and calls this.finish(result) when done.
```
The shell never knows game internals: it starts the scene with `{ players, settings }` and waits for `GameResult`. Adding a game = new folder + one registry line.

### Multi-touch notes
- Phaser `input.addPointer(4)` → up to 5 simultaneous touches (iPhone limit is 5, iPad/Android usually 10).
- CSS `touch-action: none`, disable double-tap zoom, long-press menu, text selection and pull-to-refresh.
- Lock orientation (landscape on tablets; per-game choice on phones) via manifest + Capacitor plugin.
- Keep the screen awake during a tournament (Wake Lock API / Capacitor plugin).
- iOS audio only starts after a user tap → unlock on the first "Play" press.

---

## 5. Milestones

| Milestone | Content | Done when |
|---|---|---|
| **M0 – Scaffold** | Vite + TS + Phaser, ESLint/Prettier, Vitest, GitHub Actions, GitHub Pages deploy, PWA manifest + icons | Blank app installs to iPad home screen and runs offline |
| **M1 – Core loop** | Player setup, tournament setup (3–10 games), BaseGameScene, ZoneLayout, scoring + tie-breaks (unit-tested), round results, final podium, profiles + stars + Locker; 2 games (**Sumo Bump**, **Light Trails**) + shared joystick / button controls | A full tournament of 3 games can be played end-to-end with 2, 3 and 4 players |
| **M2 – First 6 games** | Tank Twirl, Meteor Dodge, Laser Jump, Bomb Tag | Family playtest #1 |
| **M3 – Android** | (JDK 21 installed ✅) Capacitor Android project, icons/splash, landscape lock, keep-awake, signed release APK | APK installs and plays on an Android phone/tablet |
| **M4 – Games 7–13** | Bumper Soccer, Ping Square, Snowball Fight, Coin Grab, Kart Rally, King of the Hill, Showdown | Family playtest #2 (13 games) |
| **M5 – Polish** | Sound effects + music, animated "how to play" demos, handicap system, settings screen, confetti/podium animations, balanced "Random" picker | Kids can run a tournament without adult help |
| **M6 – Games 14–20** | Lava Floor, Fruit Slash, Balloon Joust, Gem Miner, Spike Climb, Hoop Shot, Chair Dash | 20 games available |
| **M7 – Optional** | Translations, Play Store listing, stats history ("family hall of fame"), custom avatars via camera | – |

Each game follows the same checklist: rules implemented → placement logic unit-tested (where pure) → works with 2/3/4 players → zones correct on phone + tablet → sounds → how-to-play demo → playtest.

---

## 6. Testing Strategy
- **Unit (Vitest)**: scoring table, tie handling, tie-break order, tournament state machine (select 3–10, can't start with <3, rematch), each game's pure rule functions (e.g. Time Stopper distance, Balloon ranking with pops).
- **Smoke (Playwright, iPad + phone viewports)**: start a tournament with 2 and 4 players, auto-play via a debug "simulate results" hook, reach the podium without errors.
- **Manual**: playtest on real devices – Android phone, Android tablet, iPad, iPhone – focusing on multi-touch with 4 hands at once.

---

## 7. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| iPhone 5-touch limit with 4 players | Tablet-first; on phones, games needing 2 touches per player are limited to 2 players |
| Small phone screen with 4 players | Games declare `phoneMaxPlayers`; phone layouts get larger buttons, smaller play area |
| iOS PWA quirks (audio, storage eviction) | Audio unlock on first tap; storage only holds names/settings (cheap to lose) |
| Scope creep (20 games) | Strict per-game template; ship and playtest every 5 games |

---

## 8. Decisions (2026-11-17)
1. **Game engine**: Phaser 3.
2. **Hosting**: GitHub Pages on the public repo `bunyu/minigames` (`https://bunyu.github.io/minigames/`).
3. **Primary device**: tablet-first, landscape. Phones supported with best effort.
4. **Language**: English only.
5. **Profiles & unlockables**: each player has a persistent profile with a colour and unlockable cosmetics bought with stars earned from tournament points (see §2.5).
