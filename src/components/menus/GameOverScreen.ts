import { Check, House, RotateCcw, Trophy } from "lucide";
import { CONFIG } from "../../config/gameConfig";
import { formatNumber, t } from "../../i18n";
import type { GameOverEvent } from "../../game/core/Game";
import { sanitizeName } from "../../game/scoring/Leaderboard";
import { h, icon, num, ornament } from "../ui/dom";
import type { Screen } from "../ui/ScreenManager";

export interface GameOverActions {
  playAgain(): void;
  mainMenu(): void;
  highScores(): void;
  enterHighScore(): void;
  save(name: string): void;
  skip(): void;
  lastName(): string;
  select(): void;
  recordSound(): void;
}

/**
 * Game-over summary: animated final score, run stats, record badge and — when the
 * score makes the Top 10 — an inline name entry (HIGH_SCORE state).
 */
export class GameOverScreen implements Screen {
  readonly el = h("section", { class: "screen backdrop", "aria-labelledby": "go-title" });
  private data: GameOverEvent = { score: 0, wave: 0, kills: 0, bestCombo: 0, qualifies: false, isBest: false };
  private raf = 0;
  private revealTimer: number | null = null;

  constructor(private readonly actions: GameOverActions) {
    this.render();
  }

  open(data: GameOverEvent): void {
    this.data = data;
    this.render();
    this.animateScore();
    if (this.revealTimer !== null) window.clearTimeout(this.revealTimer);
    if (data.qualifies) {
      this.revealTimer = window.setTimeout(() => this.revealNameEntry(), 1300);
    }
  }

  private animateScore(): void {
    cancelAnimationFrame(this.raf);
    const el = this.el.querySelector<HTMLElement>(".final-score");
    if (!el) return;
    const target = this.data.score;
    const start = performance.now();
    const dur = 1100;
    const step = (now: number): void => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = formatNumber(target * eased);
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Hides the name entry and restores the action buttons (after Skip). */
  showButtons(): void {
    this.el.querySelector(".name-entry")?.classList.add("hidden");
    this.el.querySelector(".go-buttons")?.classList.remove("hidden");
    this.el.querySelector<HTMLElement>(".go-buttons .btn")?.focus({ preventScroll: true });
  }

  private revealNameEntry(): void {
    this.revealTimer = null;
    const form = this.el.querySelector<HTMLFormElement>(".name-entry");
    const buttons = this.el.querySelector<HTMLElement>(".go-buttons");
    if (!form) return;
    this.actions.enterHighScore();
    this.actions.recordSound();
    form.classList.remove("hidden");
    buttons?.classList.add("hidden");
    const input = form.querySelector<HTMLInputElement>("input");
    input?.focus({ preventScroll: true });
    input?.select();
  }

  render(): void {
    const a = this.actions;
    const d = this.data;
    const btn = (label: string, node: Parameters<typeof icon>[0], fn: () => void, cls = "btn") =>
      h("button", { class: cls, type: "button", onclick: () => { a.select(); fn(); } }, icon(node), label);

    const input = h("input", {
      class: "name-input", type: "text", dir: "auto", maxlength: CONFIG.leaderboard.maxNameLength,
      placeholder: t("nameEntry.placeholder"), "aria-label": t("nameEntry.prompt"),
      autocomplete: "nickname", enterkeyhint: "done", spellcheck: "false",
      value: a.lastName(),
    });
    const form = h("form", { class: "name-entry hidden" },
      h("div", { class: "panel-sub" }, t("nameEntry.subtitle")),
      h("label", null, t("nameEntry.prompt")),
      input,
      h("div", { class: "btn-row" },
        h("button", { class: "btn primary", type: "submit" }, icon(Check), t("nameEntry.save")),
        h("button", { class: "btn ghost", type: "button", onclick: () => { a.select(); a.skip(); } }, t("nameEntry.skip"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      a.select();
      a.save(sanitizeName(input.value) || t("player.name"));
    });

    const badge = d.isBest
      ? h("div", { class: "record-badge" }, icon(Trophy), t("gameOver.newHighScore"))
      : d.qualifies
        ? h("div", { class: "record-badge" }, icon(Trophy), t("gameOver.newRecord"))
        : null;

    this.el.replaceChildren(
      h("div", { class: "panel glass" },
        h("h2", { class: "panel-title", id: "go-title" }, t("gameOver.title")),
        ornament(),
        h("div", { class: "panel-sub", style: "margin:0" }, t("gameOver.finalScore")),
        h("div", { class: "final-score num", dir: "ltr" }, formatNumber(d.score)),
        badge,
        h("div", { class: "stats" },
          h("div", { class: "stat" }, num(d.wave), h("div", { class: "lbl" }, t("gameOver.waveReached"))),
          h("div", { class: "stat" }, num(d.kills), h("div", { class: "lbl" }, t("gameOver.enemiesDestroyed"))),
          h("div", { class: "stat" }, num(d.bestCombo), h("div", { class: "lbl" }, t("gameOver.bestCombo")))),
        form,
        h("div", { class: "menu go-buttons", style: "margin-top:14px" },
          btn(t("gameOver.tryAgain"), RotateCcw, a.playAgain, "btn primary"),
          btn(t("menu.highScores"), Trophy, a.highScores),
          btn(t("menu.mainMenu"), House, a.mainMenu, "btn ghost"))),
    );
  }
}
