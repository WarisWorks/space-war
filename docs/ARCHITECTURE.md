# ئالەم جەڭچىسى — Architecture & Game Design

A Uyghur-first (RTL) top-down arcade space shooter. Vanilla TypeScript + Canvas 2D,
bundled with Vite. No UI framework: the game loop never triggers a virtual-DOM diff —
DOM UI is built once and patched only when a displayed value actually changes.

## 1. Tech decisions

| Concern | Choice | Why |
|---|---|---|
| Rendering | Canvas 2D, pre-rendered sprite cache | No runtime `shadowBlur`; every glow is baked once into an offscreen canvas and blitted with `drawImage` |
| UI | Plain DOM + CSS (glass panels) | Real text shaping for Uyghur Arabic script, native RTL via `dir="rtl"` |
| Loop | `requestAnimationFrame`, clamped variable `dt` | Smooth on 60/120/144 Hz; `dt` capped at 1/30 s to avoid tunnelling after tab switches |
| Audio | Web Audio API, fully procedural SFX + generative music | Zero asset downloads, instant start, independent music/SFX buses |
| Persistence | `localStorage` (settings, Top-10 leaderboard) | Wrapped in try/catch — private mode never crashes the game |
| Tests | Vitest (logic) + Playwright script (e2e screenshots) | |

## 2. Folder structure

```
src/
  main.ts                    bootstrap: fonts → i18n → Game
  config/gameConfig.ts       ALL balancing values (single source of truth)
  i18n/index.ts              t(), locale switch, <html dir/lang>, number formatting
  locales/ug.json            Uyghur (default)
  locales/en.json            English
  styles/main.css            tokens, glass panels, RTL layout, animations
  game/
    core/        Game (orchestrator), StateMachine, Input, Pool, SpatialGrid,
                 Viewport (world ↔ screen), math, events
    player/      Player (movement, invulnerability, power-up state)
    weapons/     Projectiles (player + enemy pools), Weapon (fire patterns)
    enemies/     Enemy entity, per-type behaviours, Boss patterns
    powerups/    PowerUps (drops, float, pickup)
    waves/       WaveManager (procedural wave composition + formations)
    collision/   Collision system (grid broad-phase, circle narrow-phase)
    effects/     Particles, FloatingText, Starfield (parallax), ScreenShake
    render/      Sprites (baked sprite cache), Renderer, lucide→Path2D
    audio/       AudioEngine (buses), Sfx (synth recipes), Music (sequencer)
    scoring/     ScoreSystem (combo/streak/bonuses), Leaderboard (Top-10)
    settings/    Settings store
  components/
    ui/          dom helper h(), icon(), ScreenManager
    hud/         Hud (score tween, lives, wave, power-up timers, boss bar)
    menus/       MainMenu, PauseMenu, SettingsMenu, ControlsMenu, GameOver, Banner
    leaderboard/ LeaderboardScreen, NameEntry
    touch/       TouchControls (pause, fire button)
tests/           vitest unit tests (i18n parity, pool, leaderboard, waves, scoring)
scripts/e2e.mjs  Playwright smoke test + screenshots
```

Sprite/audio assets are generated at runtime (`render/Sprites.ts`, `audio/Sfx.ts`),
so the game ships as a single static bundle. Replacing a baked sprite with an image
only requires changing its factory in `Sprites.ts`.

## 3. Game states

```
LOADING → MAIN_MENU → WAVE_TRANSITION ⇄ PLAYING
                              ↑            │ hit (lives > 0)
                              │            ▼
                        RESPAWNING ← PLAYER_DEATH
                                           │ hit (lives = 0)
                                           ▼
                        GAME_OVER → HIGH_SCORE (name entry, if Top-10) → leaderboard
PAUSED can be entered from PLAYING / WAVE_TRANSITION / RESPAWNING and returns to the prior state.
```

What updates per state:

| State | Player input | Enemies | Spawning | Bullets/particles | Timers |
|---|---|---|---|---|---|
| PLAYING | ✔ | ✔ | ✔ | ✔ | ✔ |
| WAVE_TRANSITION | ✔ (move+fire) | – (none alive) | ✖ | ✔ | banner timer |
| PLAYER_DEATH | ✖ | ✔ (no firing) | ✖ | ✔ | death timer |
| RESPAWNING | ✖ (fly-in) | ✔ (no firing) | ✖ | ✔ | respawn timer |
| PAUSED / menus | ✖ | ✖ | ✖ | ✖ | ✖ (frame frozen) |

## 4. World & viewport

The playfield is a fixed-width logical world (720–900 × 1000–1400 units) scaled to fit
the screen. The starfield fills the whole canvas; gameplay and HUD are aligned to the
world rectangle so desktop letterboxing never pushes HUD away from the action.

## 5. Gameplay systems

- **Player** – critically-damped velocity smoothing (separate accel/decel rates),
  bank angle from lateral velocity, clamped to world bounds. Keyboard, mouse (hold to
  follow + fire) and touch (relative drag + auto-fire).
- **Weapon** – cooldown-based; multi-shot levels 1 → 3 → 5 projectiles in a fan.
  Muzzle flash, recoil offset, tracer trails, impact sparks.
- **Enemies** – data-driven types (`fighter`, `scout`, `heavy`, `shooter`, `elite`)
  with behaviour functions. Stats scale per wave via config multipliers.
- **Boss** every 5 waves – three phases by HP (fan → spiral + aimed → barrage).
- **Waves** – point-budget composition; types unlock progressively; formations
  (line, V, column, pincer, swarm) scheduled as spawn groups.
- **Power-ups** – multi-shot (persistent until life lost), shield (absorbs N hits,
  visual decay, break burst), speed boost (timed), rare extra life.
- **Scoring** – base values per type × combo multiplier (kills chained within a
  window), streak counter, wave-clear bonus, no-damage bonus.
- **Collision** – uniform spatial grid over enemies; circle tests for narrow phase.

## 6. Performance

- `Pool<T>`: dense arrays with swap-remove; zero allocations in the steady state for
  bullets, enemy bullets, particles, floating texts, power-ups and enemies.
- Additive (`lighter`) blending with pre-rendered glow sprites.
- HUD writes to the DOM only when a rendered value changes.

## 7. Localisation

- All UI strings live in `src/locales/*.json`; `t(key, params)` with `{n}` interpolation.
- `<html lang dir>` updates on locale change; menus use logical CSS properties
  (`margin-inline-start`, `inset-inline-end`) so they mirror automatically.
- Numbers use Western digits with grouping (`12,450`) wrapped in `<bdi>`/`dir="ltr"`
  spans so they never reorder inside RTL sentences.
- Adding a language: drop `xx.json` next to `ug.json`, register it in `i18n/index.ts`.
  A unit test enforces key parity between all locale files.
