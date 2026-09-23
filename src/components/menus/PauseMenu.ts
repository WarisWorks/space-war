import { House, Play, RotateCcw, Settings as SettingsIcon } from "lucide";
import { t } from "../../i18n";
import { h, icon, num, ornament } from "../ui/dom";
import type { Screen } from "../ui/ScreenManager";

export interface PauseActions {
  resume(): void;
  restart(): void;
  settings(): void;
  mainMenu(): void;
  summary(): { score: number; wave: number };
  select(): void;
}

export class PauseMenu implements Screen {
  readonly el = h("section", { class: "screen backdrop", "aria-labelledby": "pause-title" });
  private summary: HTMLElement | null = null;

  constructor(private readonly actions: PauseActions) {
    this.render();
  }

  render(): void {
    const a = this.actions;
    const btn = (label: string, node: Parameters<typeof icon>[0], fn: () => void, cls = "btn") =>
      h("button", { class: cls, type: "button", onclick: () => { a.select(); fn(); } }, icon(node), label);
    this.summary = h("p", { class: "panel-sub" });
    this.el.replaceChildren(
      h("div", { class: "panel glass" },
        h("h2", { class: "panel-title", id: "pause-title" }, t("pause.title")),
        ornament(),
        this.summary,
        h("div", { class: "menu" },
          btn(t("pause.resume"), Play, a.resume, "btn primary"),
          btn(t("pause.restart"), RotateCcw, a.restart),
          btn(t("menu.settings"), SettingsIcon, a.settings),
          btn(t("menu.backToMainMenu"), House, a.mainMenu, "btn ghost"))),
    );
  }

  onShow(): void {
    const { score, wave } = this.actions.summary();
    this.summary?.replaceChildren(t("hud.score"), " ", num(score), "  ·  ", t("hud.wave"), " ", num(wave));
  }
}
