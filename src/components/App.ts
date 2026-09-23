import { onLocaleChange, setLocale, t } from "../i18n";
import { CONFIG } from "../config/gameConfig";
import type { Game } from "../game/core/Game";
import { GameState } from "../game/core/StateMachine";
import type { KeyValueStorage } from "../game/scoring/Leaderboard";
import { Banner } from "./hud/Banner";
import { Hud } from "./hud/Hud";
import { LeaderboardScreen } from "./leaderboard/LeaderboardScreen";
import { ControlsMenu } from "./menus/ControlsMenu";
import { GameOverScreen } from "./menus/GameOverScreen";
import { MainMenu } from "./menus/MainMenu";
import { PauseMenu } from "./menus/PauseMenu";
import { SettingsMenu } from "./menus/SettingsMenu";
import { TouchControls } from "./touch/TouchControls";
import { ikatPatternUrl } from "./ui/dom";
import { ScreenManager } from "./ui/ScreenManager";

const IN_RUN = new Set([
  GameState.WAVE_TRANSITION, GameState.PLAYING, GameState.PLAYER_DEATH, GameState.RESPAWNING,
]);

/**
 * UI shell: owns every DOM component and maps game state/events to screens.
 * Gameplay never touches the DOM directly.
 */
export class App {
  private readonly hud: Hud;
  private readonly banner = new Banner();
  private readonly touch: TouchControls;
  private readonly screens: ScreenManager;
  private readonly mainMenu: MainMenu;
  private readonly pauseMenu: PauseMenu;
  private readonly settingsMenu: SettingsMenu;
  private readonly controlsMenu: ControlsMenu;
  private readonly leaderboardScreen: LeaderboardScreen;
  private readonly gameOver: GameOverScreen;

  constructor(
    private readonly game: Game,
    private readonly stage: HTMLElement,
    screensRoot: HTMLElement,
    private readonly storage: KeyValueStorage,
  ) {
    document.documentElement.style.setProperty("--ikat", ikatPatternUrl());

    const select = (): void => game.audio.play("menuSelect");
    this.hud = new Hud(game, () => game.pause());
    this.touch = new TouchControls(game.input);
    stage.append(this.hud.el, this.banner.el, this.touch.el);

    this.screens = new ScreenManager(screensRoot);
    this.screens.onNavigate = () => game.audio.play("menuMove");

    this.mainMenu = new MainMenu({
      play: () => game.start(),
      highScores: () => { this.leaderboardScreen.open(); this.screens.push("leaderboard"); },
      controls: () => this.screens.push("controls"),
      settings: () => this.screens.push("settings"),
      best: () => game.leaderboard.best,
      select,
    });
    this.pauseMenu = new PauseMenu({
      resume: () => game.resume(),
      restart: () => game.start(),
      settings: () => this.screens.push("settings"),
      mainMenu: () => game.quitToMenu(),
      summary: () => ({ score: game.score.score, wave: game.wave }),
      select,
    });
    this.settingsMenu = new SettingsMenu(game.settings, {
      back: () => { select(); this.screens.back(); },
      preview: () => game.audio.play("menuMove"),
      isTouch: () => game.input.isTouchDevice,
    });
    this.controlsMenu = new ControlsMenu(game.sprites, () => { select(); this.screens.back(); });
    this.leaderboardScreen = new LeaderboardScreen(game.leaderboard, {
      back: () => this.screens.back(),
      playAgain: () => game.start(),
      mainMenu: () => game.quitToMenu(),
      select,
    });
    this.gameOver = new GameOverScreen({
      playAgain: () => game.start(),
      mainMenu: () => game.quitToMenu(),
      highScores: () => { this.leaderboardScreen.open(); this.screens.push("leaderboard"); },
      enterHighScore: () => game.enterHighScore(),
      save: (name) => {
        this.remember(name);
        const rank = game.submitHighScore(name);
        this.leaderboardScreen.open(rank, true);
        this.screens.show("leaderboard");
      },
      skip: () => this.gameOver.showButtons(),
      lastName: () => this.lastName(),
      select,
      recordSound: () => game.audio.play("newRecord"),
    });

    this.screens.register("mainMenu", this.mainMenu);
    this.screens.register("pause", this.pauseMenu);
    this.screens.register("settings", this.settingsMenu);
    this.screens.register("controls", this.controlsMenu);
    this.screens.register("leaderboard", this.leaderboardScreen);
    this.screens.register("gameOver", this.gameOver);

    // Audio can only start after a user gesture.
    screensRoot.addEventListener("pointerdown", () => game.audio.unlock());
    screensRoot.addEventListener("keydown", () => game.audio.unlock());

    game.input.onPause = () => this.handleEscape();
    game.events.on("state", ({ state, prev }) => this.onState(state, prev));
    game.events.on("banner", (e) => this.banner.show(e));
    game.events.on("gameOver", (e) => {
      this.gameOver.open(e);
      this.screens.show("gameOver");
    });
    game.events.on("resize", (vp) => this.layoutStage(vp.offsetX, vp.offsetY, vp.width * vp.scale, vp.height * vp.scale, vp.scale));
    game.onFrame = (dt) => {
      if (IN_RUN.has(game.state) || game.state === GameState.PAUSED) this.hud.update(dt);
      this.touch.update(IN_RUN.has(game.state), game.autoFire);
    };

    game.settings.onChange((s) => setLocale(s.locale));
    onLocaleChange(() => this.rebuild());
    setLocale(game.settings.values.locale);
    this.layoutStage(game.viewport.offsetX, game.viewport.offsetY,
      game.viewport.width * game.viewport.scale, game.viewport.height * game.viewport.scale, game.viewport.scale);
  }

  private layoutStage(x: number, y: number, w: number, h: number, scale: number): void {
    const s = this.stage.style;
    s.setProperty("--stage-x", `${x}px`);
    s.setProperty("--stage-y", `${y}px`);
    s.setProperty("--stage-w", `${w}px`);
    s.setProperty("--stage-h", `${h}px`);
    // HUD scale: 1 world unit, but never so small that text becomes unreadable on phones.
    s.setProperty("--u", `${Math.max(scale, 0.62)}px`);
  }

  private rebuild(): void {
    document.title = `${t("app.title")} — ${t("app.titleLatin")}`;
    this.hud.build(() => this.game.pause());
    this.touch.rebuild();
    this.screens.renderAll();
    if (this.game.state === GameState.GAME_OVER || this.game.state === GameState.HIGH_SCORE) {
      // Keep the game-over data but re-render in the new language
      this.gameOver.showButtons();
    }
  }

  private onState(state: GameState, prev: GameState): void {
    const inRun = IN_RUN.has(state);
    if (inRun) {
      this.screens.hideAll();
      this.hud.setVisible(true);
      this.banner.setPaused(false);
      if (!IN_RUN.has(prev) && prev !== GameState.PAUSED) {
        this.hud.reset();
        this.banner.clear();
        this.touch.showHint();
      }
      return;
    }
    switch (state) {
      case GameState.MAIN_MENU:
        this.hud.setVisible(false);
        this.banner.clear();
        this.screens.show("mainMenu");
        break;
      case GameState.PAUSED:
        this.hud.setVisible(true, true);
        this.banner.setPaused(true);
        this.screens.show("pause");
        break;
      case GameState.GAME_OVER:
        this.hud.setVisible(true, true);
        this.banner.clear();
        break;
      default:
        break;
    }
  }

  /** Escape / P: pause, resume, or step back out of a sub-screen. */
  private handleEscape(): void {
    const g = this.game;
    if (g.sm.simulating) {
      g.pause();
      return;
    }
    if (this.screens.back()) {
      g.audio.play("menuMove");
      return;
    }
    if (g.state === GameState.PAUSED) g.resume();
  }

  private lastName(): string {
    try {
      return this.storage.getItem(CONFIG.storageKeys.lastName) ?? "";
    } catch {
      return "";
    }
  }

  private remember(name: string): void {
    try {
      this.storage.setItem(CONFIG.storageKeys.lastName, name);
    } catch {
      /* ignore */
    }
  }
}
