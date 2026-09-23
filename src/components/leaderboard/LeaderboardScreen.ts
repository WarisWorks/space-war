import { ArrowLeft, ArrowRight, House, RotateCcw, Trash2, Trophy } from "lucide";
import { getDirection, t } from "../../i18n";
import type { Leaderboard } from "../../game/scoring/Leaderboard";
import { h, icon, num, ornament } from "../ui/dom";
import type { Screen } from "../ui/ScreenManager";

export interface LeaderboardActions {
  back(): void;
  playAgain(): void;
  mainMenu(): void;
  select(): void;
}

/** Top-10 table. After a run it highlights the new entry and offers replay. */
export class LeaderboardScreen implements Screen {
  readonly el = h("section", { class: "screen backdrop", "aria-labelledby": "board-title" });
  private highlight = -1;
  private postGame = false;

  constructor(private readonly board: Leaderboard, private readonly actions: LeaderboardActions) {
    this.render();
  }

  open(highlight = -1, postGame = false): void {
    this.highlight = highlight;
    this.postGame = postGame;
    this.render();
  }

  render(): void {
    const a = this.actions;
    const entries = this.board.all;
    const BackIcon = getDirection() === "rtl" ? ArrowRight : ArrowLeft;
    const btn = (label: string, node: Parameters<typeof icon>[0], fn: () => void, cls = "btn") =>
      h("button", { class: cls, type: "button", onclick: () => { a.select(); fn(); } }, icon(node), label);

    const table = entries.length
      ? h("table", { class: "board" },
          h("thead", null, h("tr", null,
            h("th", { scope: "col" }, t("leaderboard.rank")),
            h("th", { scope: "col" }, t("leaderboard.name")),
            h("th", { scope: "col" }, t("leaderboard.score")),
            h("th", { scope: "col" }, t("leaderboard.wave")))),
          h("tbody", null, entries.map((e, i) =>
            h("tr", { class: `rank-${i + 1}${i === this.highlight ? " highlight" : ""}` },
              h("td", null, h("span", { class: "rank-badge" }, String(i + 1))),
              h("td", { class: "name-cell", dir: "auto" }, e.name),
              h("td", { class: "score-cell" }, num(e.score)),
              h("td", null, num(e.wave))))))
      : h("div", { class: "empty" }, icon(Trophy), t("leaderboard.empty"));

    this.el.replaceChildren(
      h("div", { class: "panel glass wide" },
        h("h2", { class: "panel-title", id: "board-title" }, t("leaderboard.title")),
        ornament(),
        this.highlight >= 0 ? h("div", { class: "record-badge" }, icon(Trophy), t("gameOver.newRecord")) : null,
        table,
        this.postGame
          ? h("div", { class: "btn-row" },
              btn(t("gameOver.tryAgain"), RotateCcw, a.playAgain, "btn primary"),
              btn(t("menu.mainMenu"), House, a.mainMenu))
          : h("div", { class: "btn-row" },
              btn(t("menu.back"), BackIcon, a.back),
              entries.length ? this.clearButton() : null)),
    );
  }

  /** Two-step clear: first press asks for confirmation, second press deletes. */
  private clearButton(): HTMLElement {
    let armed = false;
    const label = h("span", null, t("leaderboard.clear"));
    const el = h("button", { class: "btn ghost", type: "button" }, icon(Trash2), label);
    el.addEventListener("click", () => {
      this.actions.select();
      if (!armed) {
        armed = true;
        label.textContent = t("leaderboard.clearConfirm");
        el.style.borderColor = "var(--ember)";
        return;
      }
      this.board.clear();
      this.render();
    });
    el.addEventListener("blur", () => {
      armed = false;
      label.textContent = t("leaderboard.clear");
      el.style.borderColor = "";
    });
    return el;
  }
}
