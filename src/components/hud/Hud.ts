import { Heart, Pause, Shield, Zap } from "lucide";
import { CONFIG } from "../../config/gameConfig";
import { formatNumber, t } from "../../i18n";
import type { Game } from "../../game/core/Game";
import { damp } from "../../game/core/math";
import { MULTI_SHOT_ICON } from "../../game/render/iconPath";
import { h, icon } from "../ui/dom";

/**
 * In-game HUD. Built once per locale; `update()` runs every frame but writes to the
 * DOM only when a displayed value changes (no layout thrash in the game loop).
 */
export class Hud {
  readonly el: HTMLElement;
  private scoreValue!: HTMLElement;
  private bestValue!: HTMLElement;
  private waveValue!: HTMLElement;
  private hearts!: HTMLElement;
  private livesPanel!: HTMLElement;
  private combo!: HTMLElement;
  private comboMult!: HTMLElement;
  private comboCount!: HTMLElement;
  private comboBar!: HTMLElement;
  private powerups!: HTMLElement;
  private bossBar!: HTMLElement;
  private bossFill!: HTMLElement;
  private bossLag!: HTMLElement;

  private displayScore = 0;
  private shown = { score: -1, best: -1, wave: -1, lives: -1, maxHearts: -1, mult: -1, combo: -1, chips: "", boss: -1 };
  private chipEls = new Map<string, { el: HTMLElement; fill?: HTMLElement; pips?: HTMLElement[] }>();
  private bossHitTimer = 0;

  constructor(private readonly game: Game, onPause: () => void) {
    this.el = h("div", { class: "hud", "aria-live": "off" });
    this.build(onPause);
  }

  build(onPause: () => void): void {
    this.scoreValue = h("span", { class: "value" }, "0");
    this.bestValue = h("bdi", { class: "num", dir: "ltr" }, "0");
    this.waveValue = h("div", { class: "value num" }, "1");
    this.hearts = h("div", { class: "hearts" });
    this.livesPanel = h("div", { class: "hud-panel glass hud-lives" },
      h("div", { class: "hud-label" }, t("hud.lives")), this.hearts);
    this.comboMult = h("span", { class: "combo-mult num" }, "×1");
    this.comboCount = h("span", null, "");
    this.comboBar = h("i");
    this.combo = h("div", { class: "combo glass" },
      h("div", { class: "combo-row" }, this.comboMult, this.comboCount),
      h("div", { class: "combo-bar" }, this.comboBar));
    this.powerups = h("div", { class: "powerups" });
    this.bossFill = h("div", { class: "boss-fill" });
    this.bossLag = h("div", { class: "boss-lag" });
    const [p1, p2] = CONFIG.boss.phaseThresholds;
    this.bossBar = h("div", { class: "boss-bar", role: "progressbar", "aria-label": t("boss.name") },
      h("div", { class: "boss-name" }, t("boss.name")),
      h("div", { class: "boss-track glass" }, this.bossLag, this.bossFill,
        h("i", { class: "boss-tick", style: `inset-inline-start: ${50 - p1 * 50}%` }),
        h("i", { class: "boss-tick", style: `inset-inline-start: ${50 + p1 * 50}%` }),
        h("i", { class: "boss-tick", style: `inset-inline-start: ${50 - p2 * 50}%` }),
        h("i", { class: "boss-tick", style: `inset-inline-start: ${50 + p2 * 50}%` }),
      ));

    const pauseBtn = h("button", {
      class: "icon-btn glass", type: "button", "aria-label": t("pause.pause"), title: t("pause.pause"),
      onclick: (e: Event) => { e.stopPropagation(); onPause(); },
    }, icon(Pause));

    this.el.replaceChildren(
      h("div", { class: "hud-top" },
        h("div", { class: "hud-panel glass hud-score" },
          h("div", { class: "hud-label" }, t("hud.score")),
          this.scoreValue,
          h("div", { class: "hud-best" }, t("hud.highScore"), this.bestValue)),
        h("div", { class: "hud-panel glass hud-wave" },
          h("div", { class: "hud-label" }, t("hud.wave")), this.waveValue),
        h("div", { class: "hud-end" }, this.livesPanel, pauseBtn)),
      h("div", { class: "hud-sub" }, this.combo, this.powerups),
      this.bossBar,
    );
    this.shown = { score: -1, best: -1, wave: -1, lives: -1, maxHearts: -1, mult: -1, combo: -1, chips: "", boss: -1 };
    this.chipEls.clear();
  }

  reset(): void {
    this.displayScore = 0;
  }

  setVisible(visible: boolean, dimmed = false): void {
    this.el.classList.toggle("visible", visible && !dimmed);
    this.el.classList.toggle("dimmed", visible && dimmed);
  }

  update(dt: number): void {
    const g = this.game;
    const s = g.score;

    // Smooth score counter
    const target = s.score;
    this.displayScore += (target - this.displayScore) * damp(9, dt);
    if (Math.abs(target - this.displayScore) < 1) this.displayScore = target;
    const shownScore = Math.round(this.displayScore);
    if (shownScore !== this.shown.score) {
      this.shown.score = shownScore;
      this.scoreValue.textContent = formatNumber(shownScore);
    }

    const best = g.bestScore;
    if (best !== this.shown.best) {
      this.shown.best = best;
      this.bestValue.textContent = formatNumber(best);
    }

    if (g.wave !== this.shown.wave) {
      this.shown.wave = g.wave;
      this.waveValue.textContent = String(Math.max(1, g.wave));
    }

    this.updateLives();
    this.updateCombo();
    this.updatePowerUps();
    this.updateBoss(dt);
  }

  private updateLives(): void {
    const lives = this.game.lives;
    const maxHearts = Math.max(CONFIG.player.lives, lives);
    if (lives === this.shown.lives && maxHearts === this.shown.maxHearts) return;
    const prev = this.shown.lives;
    this.shown.lives = lives;
    this.shown.maxHearts = maxHearts;
    const hearts: HTMLElement[] = [];
    for (let i = 0; i < maxHearts; i++) {
      const lost = i >= lives;
      const el = h("span", { class: `heart${lost ? " lost" : ""}` }, icon(Heart));
      if (!lost && prev >= 0 && i >= prev) el.classList.add("pop");
      hearts.push(el);
    }
    this.hearts.replaceChildren(...hearts);
    this.hearts.setAttribute("aria-label", `${t("hud.lives")}: ${lives}`);
    if (prev > lives) {
      this.livesPanel.classList.remove("hit");
      void this.livesPanel.offsetWidth;
      this.livesPanel.classList.add("hit");
    }
  }

  private updateCombo(): void {
    const s = this.game.score;
    const visible = s.combo >= 3;
    this.combo.classList.toggle("visible", visible);
    if (!visible) {
      this.shown.combo = -1;
      return;
    }
    const mult = s.multiplier;
    if (mult !== this.shown.mult) {
      this.shown.mult = mult;
      this.comboMult.textContent = `×${mult}`;
      this.comboMult.classList.remove("bump");
      void this.comboMult.offsetWidth;
      this.comboMult.classList.add("bump");
    }
    if (s.combo !== this.shown.combo) {
      this.shown.combo = s.combo;
      this.comboCount.textContent = `${t("hud.combo")} ${s.combo}`;
    }
    this.comboBar.style.transform = `scaleX(${(s.comboTimer / CONFIG.scoring.comboWindow).toFixed(3)})`;
  }

  private updatePowerUps(): void {
    const p = this.game.player;
    const active: string[] = [];
    if (p.multiShot > 0) active.push(`multi${p.multiShot}`);
    if (p.shieldHp > 0) active.push("shield");
    if (p.speedTimer > 0) active.push("speed");
    const key = active.join(",");
    if (key !== this.shown.chips) {
      this.shown.chips = key;
      this.chipEls.clear();
      const chips: HTMLElement[] = [];
      if (p.multiShot > 0) {
        chips.push(h("div", { class: "chip glass", style: "--chip: var(--cyan)" },
          icon(MULTI_SHOT_ICON), t("powerup.multiShot"),
          h("bdi", { class: "num" }, `×${CONFIG.weapon.counts[p.multiShot]}`)));
      }
      if (p.shieldHp > 0) {
        const pips = Array.from({ length: CONFIG.powerups.shieldHits }, () => h("i"));
        const el = h("div", { class: "chip glass", style: "--chip: var(--teal)" },
          icon(Shield), t("powerup.shield"), h("span", { class: "pips" }, pips));
        this.chipEls.set("shield", { el, pips });
        chips.push(el);
      }
      if (p.speedTimer > 0) {
        const fill = h("i");
        const el = h("div", { class: "chip glass", style: "--chip: var(--saffron)" },
          icon(Zap), t("powerup.speedShort"), h("span", { class: "chip-timer" }, fill));
        this.chipEls.set("speed", { el, fill });
        chips.push(el);
      }
      this.powerups.replaceChildren(...chips);
    }
    const shield = this.chipEls.get("shield");
    shield?.pips?.forEach((pip, i) => pip.classList.toggle("off", i >= p.shieldHp));
    const speed = this.chipEls.get("speed");
    if (speed?.fill) {
      const k = p.speedTimer / CONFIG.powerups.speedDuration;
      speed.fill.style.transform = `scaleX(${k.toFixed(3)})`;
      speed.el.classList.toggle("warn", p.speedTimer < 2);
    }
  }

  private updateBoss(dt: number): void {
    const boss = this.game.boss;
    const visible = !!boss;
    this.bossBar.classList.toggle("visible", visible);
    if (!boss) {
      this.shown.boss = -1;
      return;
    }
    const k = Math.max(0, boss.hp / boss.maxHp);
    const rounded = Math.round(k * 1000);
    if (rounded !== this.shown.boss) {
      if (this.shown.boss > rounded) this.bossHitTimer = 0.12;
      this.shown.boss = rounded;
      this.bossFill.style.transform = `scaleX(${k.toFixed(3)})`;
      this.bossLag.style.transform = `scaleX(${k.toFixed(3)})`;
    }
    this.bossHitTimer = Math.max(0, this.bossHitTimer - dt);
    this.bossBar.classList.toggle("hit", this.bossHitTimer > 0);
  }
}
