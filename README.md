# ئالەم جەڭچىسى — Space Shooter

A polished, Uyghur-first (RTL) top-down arcade space shooter.
Written in vanilla TypeScript with Canvas 2D and bundled with Vite. It has no framework and loads no asset files.

> ئۇيغۇرچە ئالەم جېڭى ئويۇنى — دولقۇنمۇ-دولقۇن كېلىۋاتقان دۈشمەنلەرگە قارشى جەڭ قىلىڭ، كۈچەيتكۈچلەرنى يىغىڭ ۋە ئەڭ يۇقىرى نومۇر رېكورتىنى يارىتىڭ!

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production bundle in dist/
npm test             # unit tests (vitest)
npm run build && npm run test:e2e   # headless Chromium smoke test + screenshots in e2e-screens/
```

`dist/` is a fully static site. It uses relative asset paths (`base: "./"`), so you can deploy it to Vercel, Netlify, GitHub Pages or S3 as it is.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | `WASD` / arrow keys, or hold the mouse button and move | Drag anywhere (relative drag, so your finger never covers the ship) |
| Fire | `Space` (or hold the mouse button) | Auto-fire (default), or the fire button when auto-fire is off |
| Pause | `P` / `Esc` | Pause button (top corner) |
| Menus | `↑` `↓` + `Enter`, `Esc` = back | Tap |

## Features

- **Uyghur Arabic script as the primary language.** The layout is RTL (`<html dir="rtl">`, logical CSS properties) and strings are never reversed by hand. Numbers are isolated as LTR (`<bdi class="num">`), so they display as `12,450` inside RTL text. The Uyghur font is ALKATIP Basma, with Noto Sans Arabic as the fallback.
- **i18n.** Every string lives in `src/locales/ug.json` (the default) and `src/locales/en.json`. A unit test checks that all locales have the same keys and that the Uyghur file contains no placeholder English.
- **5 enemy types:** ئاددىي جەڭچى (basic fighter), تېز رازۋېدچىك (fast scout), ئېغىر جەڭ پاراخوتى (heavy ship), ئوق چىقارغۇچى (shooter) and سەرخىل دۈشمەن (elite enemy). Each has its own behaviour and attack pattern.
- **Boss (باش دۈشمەن) every 5 waves.** It has three HP phases with fan, aimed, spiral and ring attacks, a large boss health bar, and a chain-explosion finale.
- **Procedural waves.** Each wave spends a point budget. New enemy types unlock progressively and appear in formations (line, V, column, pincer, swarm). Scaling is capped.
- **Power-ups:**
  - کۆپ ئوق (multi-shot): 1 → 3 → 5 projectiles.
  - قالقان (shield): absorbs 3 hits, visibly weakens and breaks with a burst.
  - سۈرئەت كۈچەيتكۈچى (speed boost): timed, with stronger engine trails and a HUD timer.
  - قوشۇمچە جان (extra life): rare.
- **Scoring.** Kills build a combo multiplier (up to ×4). There are also kill-streak call-outs, a wave-clear bonus, a no-damage bonus and an animated score counter.
- **Top-10 leaderboard** stored in `localStorage`. You enter your name in Uyghur or Latin script, and new records are highlighted with «يېڭى رېكورت!».
- **Game feel:** baked glow sprites, laser trails, muzzle flash, recoil, sparks, debris, shockwave rings, hit flashes, trauma-based screen shake, 3-layer parallax stars, a nebula, planets and shooting stars.
- **Audio.** All sound is synthesised with Web Audio. The soundtrack is generative and plays in D Hijaz (the mode used in Uyghur muqam), with a *dap*-style drum pattern and a plucked *rawap*-style lead. Music and sound-effect volumes are separate settings, and each can be muted.
- **Visual identity.** The Silk Road palette (Lapis, Saffron, Ember, Ivory, Umber) is pushed to neon. Ikat (atlas silk) bands frame the menu, the player ship has ikat diamonds on its wings, and the boss carries a girih rosette.

## Architecture

The full design is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), including the state machine, per-state update table and performance notes.

```
src/
  config/gameConfig.ts   ← every balancing value (speeds, HP, fire rates, drops, waves…)
  i18n/ + locales/       ← t(), locale switch, RTL/LTR, number formatting
  game/
    core/        Game orchestrator, StateMachine, Input, Pool, SpatialGrid, Viewport
    player/ weapons/ enemies/ powerups/ waves/ scoring/ settings/
    effects/     Particles, FloatingText, Starfield, ScreenShake
    render/      Sprites (baked cache), Renderer, lucide→Path2D
    audio/       AudioEngine, Sfx recipes, generative Music
  components/    DOM UI: hud/, menus/, leaderboard/, touch/, ui/ (ScreenManager, h())
tests/           vitest: i18n parity, pools, grid, leaderboard, waves, scoring, state machine
scripts/e2e.mjs  Playwright: full flow on desktop + mobile, 12-minute auto-pilot soak test
```

Game states: `LOADING → MAIN_MENU → WAVE_TRANSITION ⇄ PLAYING → PLAYER_DEATH → RESPAWNING … → GAME_OVER → HIGH_SCORE`. From any in-run state you can enter `PAUSED`, and the game resumes to the state it paused from. The simulation only advances in the four in-run states, and pausing freezes enemies, bullets, spawning, power-up timers, wave progression and banner animations.

## Adding a language

1. Copy `src/locales/en.json` to `src/locales/ja.json` (or `tr`, `zh`, …) and translate the values. Set `"meta.dir"` to `"ltr"` or `"rtl"`.
2. Register it in `src/i18n/index.ts`: `import ja from "../locales/ja.json"` and add it to `LOCALES`.
3. Run `npm test`. The parity test fails if any key is missing. The language then appears in the settings screen automatically.
