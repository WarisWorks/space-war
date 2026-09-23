import { CONFIG, type EnemyKind, type PowerUpKind } from "../../config/gameConfig";
import { t } from "../../i18n";
import { AudioEngine } from "../audio/AudioEngine";
import { BEHAVIORS, type EnemyContext } from "../enemies/behaviors";
import { makeEnemy, type Enemy, type EnemyType } from "../enemies/Enemy";
import { FloatingTexts } from "../effects/FloatingText";
import { Particles, ParticleKind } from "../effects/Particles";
import { ScreenShake } from "../effects/ScreenShake";
import { Starfield } from "../effects/Starfield";
import { Player } from "../player/Player";
import { PowerUps } from "../powerups/PowerUps";
import { Renderer } from "../render/Renderer";
import { createSprites, type GlowColor, type SpriteSet } from "../render/Sprites";
import { Leaderboard } from "../scoring/Leaderboard";
import { ScoreSystem } from "../scoring/ScoreSystem";
import type { Settings } from "../settings/Settings";
import { bossHpFor, difficultyFor, isBossWave, type Difficulty } from "../waves/difficulty";
import { formationSlots, WaveManager, type SpawnGroup } from "../waves/WaveManager";
import { Projectiles } from "../weapons/Projectiles";
import { tryFire } from "../weapons/Weapon";
import { Emitter } from "./events";
import { Input } from "./Input";
import { chance, circlesOverlap, rand } from "./math";
import { Pool } from "./Pool";
import { SpatialGrid } from "./SpatialGrid";
import { GameState, StateMachine } from "./StateMachine";
import { Viewport } from "./Viewport";

export type BannerKind =
  | "wave" | "waveComplete" | "boss" | "bossDefeated" | "lifeLost" | "lastLife";

export interface BannerEvent {
  kind: BannerKind;
  wave: number;
  clearBonus?: number;
  perfectBonus?: number;
}

export interface GameOverEvent {
  score: number;
  wave: number;
  kills: number;
  bestCombo: number;
  qualifies: boolean;
  isBest: boolean;
}

export interface GameEvents extends Record<string, unknown> {
  state: { state: GameState; prev: GameState };
  banner: BannerEvent;
  gameOver: GameOverEvent;
  resize: Viewport;
  pickup: { kind: PowerUpKind };
}

const EXPLOSION_STYLE: Record<EnemyType, { scale: number; colors: GlowColor[] }> = {
  fighter: { scale: 1, colors: ["ember", "saffron"] },
  scout: { scale: 0.75, colors: ["lime", "teal"] },
  heavy: { scale: 2, colors: ["violet", "magenta", "saffron"] },
  shooter: { scale: 1.15, colors: ["saffron", "ember"] },
  elite: { scale: 1.8, colors: ["magenta", "violet", "ivory"] },
  boss: { scale: 4, colors: ["ember", "saffron", "magenta"] },
};

type TransitionPhase = "complete" | "intro";

interface DelayedBlast {
  t: number;
  x: number;
  y: number;
  scale: number;
  colors: GlowColor[];
}

/**
 * Orchestrates the simulation: owns the state machine, entity systems, collisions,
 * scoring and the render loop. UI observes it via `events` and read-only getters.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly sm = new StateMachine();
  readonly viewport = new Viewport();
  readonly input: Input;
  readonly audio = new AudioEngine();
  readonly score = new ScoreSystem();
  readonly leaderboard: Leaderboard;

  readonly sprites: SpriteSet;
  readonly starfield: Starfield;
  readonly particles: Particles;
  readonly floating = new FloatingTexts();
  readonly shake = new ScreenShake();
  readonly player = new Player();
  readonly projectiles = new Projectiles();
  readonly powerups = new PowerUps();
  readonly enemies = new Pool<Enemy>(makeEnemy, 120, 40);
  readonly waves = new WaveManager();
  private readonly grid = new SpatialGrid<Enemy>(96);
  private readonly renderer: Renderer;
  private readonly ctx: CanvasRenderingContext2D;

  lives: number = CONFIG.player.lives;
  wave = 0;
  boss: Enemy | null = null;
  /** Seconds since the current state began. */
  stateTime = 0;
  private transitionPhase: TransitionPhase = "intro";
  private stateTimer = 0;
  private difficulty: Difficulty = difficultyFor(1);
  private blasts: DelayedBlast[] = [];
  private lastFrame = 0;
  private running = false;
  /** Time used by menu/idle animations. */
  time = 0;
  /** Red flash overlay intensity after taking damage. */
  damageFlash = 0;
  autoFire = false;
  /** Per-frame hook for the UI layer (runs after render). */
  onFrame: (dt: number) => void = () => {};

  private readonly enemyCtx: EnemyContext;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly settings: Settings,
    leaderboard: Leaderboard,
  ) {
    this.leaderboard = leaderboard;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.sprites = createSprites();
    this.starfield = new Starfield(this.sprites);
    this.particles = new Particles(this.sprites);
    this.renderer = new Renderer(this);
    this.input = new Input(canvas, this.viewport);
    this.input.onPause = () => this.togglePause();
    this.input.onAnyInput = () => this.audio.unlock();

    const game = this;
    this.enemyCtx = {
      get playerX() { return game.player.x; },
      get playerY() { return game.player.y; },
      get width() { return game.viewport.width; },
      get height() { return game.viewport.height; },
      get canFire() { return game.sm.state === GameState.PLAYING; },
      fire: (x, y, angle, speed, color) =>
        this.projectiles.fireEnemy(x, y, angle, speed * this.difficulty.bulletSpeed, color),
      onEnemyShot: (kind) => this.audio.play("enemyShot", kind === "boss" ? 1.4 : 1),
    };

    this.sm.onChange((next, prev) => this.onStateChange(next, prev));
    this.applySettings();
    settings.onChange(() => this.applySettings());

    window.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      this.audio.setHidden(document.hidden);
      if (document.hidden) this.pause();
    });
    this.resize();
  }

  // ───────────────────────────── Setup ─────────────────────────────

  private applySettings(): void {
    const s = this.settings.values;
    this.audio.setVolumes(s.musicVolume, s.sfxVolume, s.musicMuted, s.sfxMuted);
    this.shake.enabled = s.screenShake;
    this.autoFire = s.autoFire ?? this.input.isTouchDevice;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const vp = this.viewport;
    vp.update(w, h, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * vp.dpr);
    this.canvas.height = Math.round(h * vp.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.starfield.resize(w, h);
    this.grid.resize(vp.width, vp.height);
    if (this.sm.is(GameState.LOADING, GameState.MAIN_MENU)) this.player.reset(vp.width, vp.height);
    this.events.emit("resize", vp);
  }

  startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const frame = (now: number): void => {
      const dt = Math.min(CONFIG.world.maxDt, Math.max(0, (now - this.lastFrame) / 1000));
      this.lastFrame = now;
      this.update(dt);
      this.renderer.render(this.ctx);
      this.onFrame(this.sm.state === GameState.PAUSED ? 0 : dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ───────────────────────────── Public controls ─────────────────────────────

  get state(): GameState {
    return this.sm.state;
  }

  finishLoading(): void {
    this.sm.transition(GameState.MAIN_MENU);
  }

  /** Starts a fresh run from the menu, game over or pause. */
  start(): void {
    this.audio.unlock();
    this.resetRun();
    if (this.sm.state === GameState.PAUSED) this.sm.transition(GameState.MAIN_MENU);
    this.beginWave(1);
  }

  pause(): void {
    if (this.sm.simulating) this.sm.transition(GameState.PAUSED);
  }

  resume(): void {
    const to = this.sm.resumeTo;
    if (this.sm.state === GameState.PAUSED && to) {
      this.sm.transition(to);
      this.lastFrame = performance.now();
    }
  }

  togglePause(): void {
    if (this.sm.state === GameState.PAUSED) this.resume();
    else this.pause();
  }

  quitToMenu(): void {
    this.resetRun();
    this.sm.transition(GameState.MAIN_MENU);
  }

  /** Called by the UI when the game-over screen reveals the name entry. */
  enterHighScore(): void {
    this.sm.transition(GameState.HIGH_SCORE);
  }

  submitHighScore(name: string): number {
    return this.leaderboard.add(name, this.score.score, this.wave);
  }

  get bestScore(): number {
    return Math.max(this.leaderboard.best, this.score.score);
  }

  // ───────────────────────────── State flow ─────────────────────────────

  private resetRun(): void {
    const vp = this.viewport;
    this.score.reset();
    this.lives = CONFIG.player.lives;
    this.wave = 0;
    this.boss = null;
    this.blasts.length = 0;
    this.enemies.clear();
    this.projectiles.clear();
    this.powerups.clear();
    this.particles.clear();
    this.floating.clear();
    this.shake.reset();
    this.player.reset(vp.width, vp.height);
    this.damageFlash = 0;
    this.input.reset();
  }

  private onStateChange(next: GameState, prev: GameState): void {
    this.stateTime = 0;
    this.input.captureKeys = this.sm.simulating;
    this.audio.duck(next === GameState.PAUSED || next === GameState.GAME_OVER || next === GameState.HIGH_SCORE);
    if (next === GameState.MAIN_MENU) this.audio.setMood("menu");
    if (next === GameState.GAME_OVER) this.audio.setMood("menu");
    if (next === GameState.PAUSED) this.input.reset();
    this.events.emit("state", { state: next, prev });
  }

  private beginWave(wave: number): void {
    this.wave = wave;
    this.difficulty = difficultyFor(wave);
    this.score.startWave();
    this.transitionPhase = "intro";
    this.stateTimer = CONFIG.waves.bannerTime;
    this.sm.transition(GameState.WAVE_TRANSITION);
    const boss = isBossWave(wave);
    this.audio.setMood(boss ? "boss" : "game");
    if (boss) {
      this.audio.play("bossArrival");
      this.events.emit("banner", { kind: "boss", wave });
    } else {
      this.audio.play("waveStart");
      this.events.emit("banner", { kind: "wave", wave });
    }
  }

  private completeWave(): void {
    const [clearBonus, perfectBonus] = this.score.completeWave(this.wave);
    this.transitionPhase = "complete";
    this.stateTimer = CONFIG.waves.completeTime;
    this.sm.transition(GameState.WAVE_TRANSITION);
    this.audio.play("waveComplete");
    this.fizzleEnemyBullets();
    this.events.emit("banner", { kind: "waveComplete", wave: this.wave, clearBonus, perfectBonus });
  }

  // ───────────────────────────── Update ─────────────────────────────

  private update(dt: number): void {
    const state = this.sm.state;
    if (state === GameState.PAUSED) return;
    this.time += dt;
    this.stateTime += dt;

    this.shake.update(dt);
    this.starfield.targetWarp =
      state === GameState.WAVE_TRANSITION && this.transitionPhase === "intro" ? 3.2
      : this.player.speedTimer > 0 && this.sm.simulating ? 1.8
      : 1;
    this.starfield.update(dt);
    this.particles.update(dt);
    this.floating.update(dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);

    if (!this.sm.simulating) return;

    const vp = this.viewport;
    const player = this.player;
    player.updateTimers(dt);

    switch (state) {
      case GameState.PLAYING:
      case GameState.WAVE_TRANSITION:
        player.updateMovement(dt, this.input, vp.width, vp.height);
        if ((this.input.fireHeld || this.autoFire) && tryFire(player, this.projectiles)) {
          this.audio.play("playerShot");
        }
        this.emitEngineTrail(dt);
        break;
      case GameState.PLAYER_DEATH:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (this.lives > 0) {
            this.stateTimer = CONFIG.player.respawnTime;
            player.x = vp.width / 2;
            player.y = vp.height + 80;
            player.vx = player.vy = 0;
            player.visible = true;
            player.invulnerable = CONFIG.player.invulnerableTime + CONFIG.player.respawnTime;
            this.sm.transition(GameState.RESPAWNING);
          } else {
            this.gameOver();
            return;
          }
        }
        break;
      case GameState.RESPAWNING: {
        this.stateTimer -= dt;
        const p = 1 - Math.max(0, this.stateTimer) / CONFIG.player.respawnTime;
        const targetY = vp.height - CONFIG.player.spawnYFromBottom;
        player.y = vp.height + 80 - (vp.height + 80 - targetY) * (1 - Math.pow(1 - p, 3));
        player.coast(dt);
        this.emitEngineTrail(dt);
        if (this.stateTimer <= 0) {
          this.input.consumeTouchDelta();
          this.sm.transition(GameState.PLAYING);
        }
        break;
      }
    }

    if (state === GameState.WAVE_TRANSITION) this.updateTransition(dt);

    if (state === GameState.PLAYING) {
      this.score.update(dt);
      this.waves.update(dt, (g) => this.spawnGroup(g), this.enemies.count);
    }

    this.updateEnemies(dt);
    this.projectiles.update(dt, vp.width, vp.height);
    this.powerups.update(dt, vp.width, vp.height);
    this.updateBlasts(dt);
    this.collide();

    if (
      this.sm.state === GameState.PLAYING &&
      this.waves.doneSpawning && this.enemies.count === 0 && !this.boss && this.blasts.length === 0
    ) {
      this.completeWave();
    }
  }

  private updateTransition(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer > 0) return;
    if (this.transitionPhase === "complete") {
      this.beginWave(this.wave + 1);
      return;
    }
    this.waves.start(this.wave);
    if (this.waves.plan.boss) this.spawnBoss();
    this.sm.transition(GameState.PLAYING);
  }

  private emitEngineTrail(dt: number): void {
    const p = this.player;
    if (!p.visible) return;
    const boosted = p.speedTimer > 0;
    const rate = boosted ? 90 : 40;
    const n = Math.random() < rate * dt - Math.floor(rate * dt) ? Math.ceil(rate * dt) : Math.floor(rate * dt);
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -6 : 6;
      this.particles.spawn(
        ParticleKind.Glow, p.x + side + rand(-1.5, 1.5), p.y + 30, rand(-20, 20) + p.vx * 0.2,
        rand(160, 260) + (boosted ? 140 : 0), rand(0.18, 0.32) * (boosted ? 1.5 : 1),
        boosted ? rand(10, 16) : rand(6, 10), 0, boosted ? (Math.random() < 0.5 ? "saffron" : "ember") : "cyan", 1,
      );
    }
  }

  // ───────────────────────────── Enemies ─────────────────────────────

  private initEnemy(e: Enemy, kind: EnemyKind, x: number, y: number): void {
    const s = CONFIG.enemies[kind];
    const d = this.difficulty;
    const vp = this.viewport;
    e.kind = kind;
    e.x = e.baseX = x;
    e.y = y;
    e.vx = e.vy = 0;
    e.radius = s.radius;
    e.maxHp = e.hp = Math.max(1, Math.round(s.hp * d.hp));
    e.score = s.score;
    e.speed = s.speed * d.speed;
    e.bulletSpeed = s.bulletSpeed;
    e.fireInterval = s.fireInterval > 0 ? s.fireInterval / d.fireRate : 0;
    e.fireTimer = e.fireInterval * rand(0.4, 1.1);
    e.dropChance = s.dropChance;
    e.t = 0;
    e.flash = 0;
    e.seed = Math.random() * 10;
    e.mode = 0;
    e.modeTimer = rand(0.8, 1.6);
    e.attackIndex = 0;
    e.holdY = vp.height * rand(0.12, kind === "heavy" ? 0.26 : 0.34);
    e.shielded = false;
    e.dead = false;
    e.burstLeft = 0;
    if (kind === "scout") e.baseX = Math.min(Math.max(x, 110), vp.width - 110);
  }

  private spawnGroup(group: SpawnGroup): void {
    const slots = formationSlots(group.formation, group.count, this.viewport.width);
    for (const slot of slots) {
      const e = this.enemies.acquire();
      if (!e) return;
      this.initEnemy(e, group.kind, slot.x, -CONFIG.enemies[group.kind].radius - 20 - slot.yOffset);
    }
  }

  private spawnBoss(): void {
    const e = this.enemies.acquire();
    if (!e) return;
    this.initEnemy(e, "fighter", this.viewport.width / 2, -140);
    const b = CONFIG.boss;
    e.kind = "boss";
    e.radius = b.radius;
    e.maxHp = e.hp = bossHpFor(this.wave);
    e.score = b.score;
    e.speed = b.speed;
    e.bulletSpeed = b.bulletSpeed;
    e.fireInterval = 0;
    e.dropChance = 0;
    e.shielded = true;
    e.phase = 0;
    e.attackTimer = 1.5;
    e.spin = 0;
    this.boss = e;
  }

  private updateEnemies(dt: number): void {
    const items = this.enemies.items;
    const h = this.viewport.height;
    for (let i = this.enemies.count - 1; i >= 0; i--) {
      const e = items[i];
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      BEHAVIORS[e.kind](e, dt, this.enemyCtx);
      if (e.y - e.radius > h + 40 && e.kind !== "boss") this.enemies.releaseAt(i);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, hitX: number, hitY: number): void {
    if (e.dead || e.shielded) {
      if (e.shielded) this.particles.impact(hitX, hitY, "saffron");
      return;
    }
    e.hp -= dmg;
    e.flash = 0.07;
    this.particles.impact(hitX, hitY, e.kind === "boss" ? "saffron" : "cyan");
    if (e.hp > 0) {
      this.audio.play("hit");
      return;
    }
    e.dead = true;
    this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    const style = EXPLOSION_STYLE[e.kind];
    const result = this.score.registerKill(e.score);
    const label = result.multiplier > 1 ? `+${result.points} ×${result.multiplier}` : `+${result.points}`;
    this.floating.add(e.x, e.y, label, result.multiplier > 1 ? "#ffc24b" : "#e8f6ff", e.kind === "boss" ? 34 : 20);
    if (this.score.streak > 0 && this.score.streak % CONFIG.scoring.streakMilestone === 0) {
      const p = this.player;
      this.floating.add(p.x, p.y - 70, t("hud.streak", { n: this.score.streak }), "#ffc24b", 22, 1.4);
      this.audio.play("waveComplete");
    }

    if (e.kind === "boss") {
      this.killBoss(e);
    } else {
      this.particles.explosion(e.x, e.y, style.scale, style.colors);
      this.audio.play(style.scale >= 1.5 ? "explosionLarge" : "explosionSmall");
      this.shake.add(0.06 * style.scale + 0.04);
      if (chance(e.dropChance)) this.powerups.spawn(e.x, e.y);
    }
  }

  private killBoss(e: Enemy): void {
    const style = EXPLOSION_STYLE.boss;
    this.audio.play("explosionBoss");
    this.shake.add(1);
    this.particles.explosion(e.x, e.y, 2.5, style.colors);
    for (let i = 0; i < 9; i++) {
      this.blasts.push({
        t: 0.12 + i * 0.16, x: e.x + rand(-110, 110), y: e.y + rand(-70, 70),
        scale: rand(1.2, 2.2), colors: style.colors,
      });
    }
    this.blasts.push({ t: 1.6, x: e.x, y: e.y, scale: 5, colors: ["ivory", "saffron", "ember"] });
    // Convert remaining enemy fire into score sparkles.
    const bonus = this.projectiles.enemy.count * CONFIG.boss.bulletClearScore;
    this.fizzleEnemyBullets();
    if (bonus > 0) this.score.add(bonus);
    const kinds: PowerUpKind[] = ["multiShot", "shield", "speed", "life"];
    for (let i = 0; i < CONFIG.powerups.bossDrops; i++) {
      this.powerups.spawn(e.x + (i - 1) * 70, e.y, kinds[i % kinds.length]);
    }
    this.boss = null;
    this.events.emit("banner", { kind: "bossDefeated", wave: this.wave });
  }

  private updateBlasts(dt: number): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.particles.explosion(b.x, b.y, b.scale, b.colors);
        this.shake.add(0.25);
        this.audio.play(b.scale > 3 ? "explosionBoss" : "explosionLarge");
        this.blasts.splice(i, 1);
      }
    }
  }

  private fizzleEnemyBullets(): void {
    const pool = this.projectiles.enemy;
    for (let i = 0; i < pool.count; i++) {
      const b = pool.items[i];
      this.particles.spawn(ParticleKind.Glow, b.x, b.y, 0, 0, 0.3, 14, 0, "ivory");
    }
    this.projectiles.clearEnemy();
  }

  // ───────────────────────────── Collisions ─────────────────────────────

  private collide(): void {
    const grid = this.grid;
    const enemies = this.enemies;
    grid.clear();
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[i];
      if (!e.dead) grid.insert(e);
    }

    // Player bolts → enemies
    const bolts = this.projectiles.player;
    for (let i = bolts.count - 1; i >= 0; i--) {
      const b = bolts.items[i];
      let hit = null as Enemy | null;
      grid.query(b.x, b.y, b.radius, (e) => {
        if (!e.dead && circlesOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius * 0.9)) {
          hit = e;
          return true;
        }
        return false;
      });
      if (hit) {
        this.damageEnemy(hit, b.damage, b.x, b.y);
        bolts.releaseAt(i);
      }
    }
    // Remove killed enemies (backwards for swap-remove).
    for (let i = enemies.count - 1; i >= 0; i--) if (enemies.items[i].dead) enemies.releaseAt(i);

    const p = this.player;
    if (!p.visible) return;
    const vulnerableState = this.sm.state === GameState.PLAYING;

    // Power-ups
    const pu = this.powerups.pool;
    for (let i = pu.count - 1; i >= 0; i--) {
      const u = pu.items[i];
      if (circlesOverlap(p.x, p.y, p.radius + 6, u.x, u.y, u.radius)) {
        this.collect(u.kind, u.x, u.y);
        pu.releaseAt(i);
      }
    }

    if (!vulnerableState || p.invulnerable > 0) return;

    // Enemy bullets → player
    const shots = this.projectiles.enemy;
    const shieldR = CONFIG.powerups.shieldRadius;
    for (let i = shots.count - 1; i >= 0; i--) {
      const b = shots.items[i];
      const r = p.shieldHp > 0 ? shieldR : p.hitRadius;
      if (circlesOverlap(p.x, p.y, r, b.x, b.y, b.radius * 0.8)) {
        shots.releaseAt(i);
        this.hitPlayer(b.x, b.y);
        return;
      }
    }

    // Ramming
    grid.query(p.x, p.y, p.radius, (e) => {
      if (e.dead) return false;
      const r = p.shieldHp > 0 ? shieldR : p.hitRadius;
      if (circlesOverlap(p.x, p.y, r, e.x, e.y, e.radius * 0.8)) {
        if (e.kind !== "boss") this.damageEnemy(e, 6, e.x, e.y);
        this.hitPlayer(e.x, e.y);
        return true;
      }
      return false;
    });
    for (let i = enemies.count - 1; i >= 0; i--) if (enemies.items[i].dead) enemies.releaseAt(i);
  }

  private hitPlayer(hx: number, hy: number): void {
    const p = this.player;
    if (p.shieldHp > 0) {
      p.shieldHp--;
      p.shieldHitFlash = 0.3;
      p.invulnerable = 0.45;
      this.shake.add(0.2);
      const a = Math.atan2(hy - p.y, hx - p.x);
      this.particles.burst(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, {
        count: 10, speed: [80, 260], life: [0.2, 0.4], size: [1.2, 2], color: ["cyan", "ivory"],
        kind: ParticleKind.Spark, angle: a, spread: 0.9,
      });
      if (p.shieldHp === 0) {
        this.audio.play("shieldBreak");
        this.particles.burst(p.x, p.y, {
          count: 36, speed: [120, 380], life: [0.3, 0.7], size: [6, 12], color: ["cyan", "teal", "ivory"], drag: 3,
        });
        this.particles.spawn(ParticleKind.Ring, p.x, p.y, 0, 0, 0.45, 40, 110, "cyan");
        this.floating.add(p.x, p.y - 56, t("powerup.shieldBroken"), "#53e6ff", 20, 1.2);
      } else {
        this.audio.play("shieldHit");
      }
      return;
    }

    // Lose a life
    this.lives--;
    this.score.registerHit();
    p.multiShot = Math.max(0, p.multiShot - 1);
    p.speedTimer = 0;
    p.visible = false;
    p.hurtFlash = 0.4;
    this.damageFlash = 1;
    this.audio.play("playerHit");
    this.shake.add(0.75);
    this.particles.explosion(p.x, p.y, 1.8, ["cyan", "lapis", "ivory"]);
    this.fizzleEnemyBullets();
    this.stateTimer = CONFIG.player.deathTime;
    this.sm.transition(GameState.PLAYER_DEATH);
    if (this.lives === 1) this.events.emit("banner", { kind: "lastLife", wave: this.wave });
    else if (this.lives > 1) this.events.emit("banner", { kind: "lifeLost", wave: this.wave });
  }

  private collect(kind: PowerUpKind, x: number, y: number): void {
    const p = this.player;
    const cfg = CONFIG.powerups;
    const colors: Record<PowerUpKind, [GlowColor, string]> = {
      multiShot: ["cyan", "#53e6ff"], shield: ["teal", "#3dffd0"], speed: ["saffron", "#ffc24b"], life: ["magenta", "#ff8ad0"],
    };
    const [glow, css] = colors[kind];
    let label = "";
    let maxed = false;
    switch (kind) {
      case "multiShot":
        if (p.multiShot < CONFIG.weapon.counts.length - 1) {
          p.multiShot++;
          label = `${t("powerup.multiShot")} ×${CONFIG.weapon.counts[p.multiShot]}`;
        } else maxed = true;
        this.audio.play("powerUp");
        break;
      case "shield":
        p.shieldHp = cfg.shieldHits;
        label = t("powerup.shield");
        this.audio.play("shieldOn");
        break;
      case "speed":
        p.speedTimer = cfg.speedDuration;
        label = t("powerup.speed");
        this.audio.play("powerUp");
        break;
      case "life":
        if (this.lives < CONFIG.player.maxLives) {
          this.lives++;
          label = t("powerup.extraLife");
        } else maxed = true;
        this.audio.play("extraLife");
        break;
    }
    if (maxed) {
      this.score.add(cfg.maxedScore);
      label = `+${cfg.maxedScore}`;
    }
    this.floating.add(x, y - 30, label, css, 22, 1.2);
    this.particles.spawn(ParticleKind.Ring, x, y, 0, 0, 0.4, 20, 70, glow);
    this.particles.burst(x, y, { count: 16, speed: [60, 220], life: [0.3, 0.6], size: [6, 12], color: [glow, "ivory"] });
    this.events.emit("pickup", { kind });
  }

  private gameOver(): void {
    this.sm.transition(GameState.GAME_OVER);
    this.audio.play("gameOver");
    const score = this.score.score;
    this.events.emit("gameOver", {
      score,
      wave: this.wave,
      kills: this.score.kills,
      bestCombo: this.score.bestCombo,
      qualifies: this.leaderboard.qualifies(score),
      isBest: score > this.leaderboard.best,
    });
  }
}
