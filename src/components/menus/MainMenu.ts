import { Coffee, Gamepad2, Globe, Instagram, Play, Settings as SettingsIcon, Trophy, Twitter, Youtube } from "lucide";
import { t } from "../../i18n";
import { h, icon, num, ornament } from "../ui/dom";
import type { Screen } from "../ui/ScreenManager";

export interface MainMenuActions {
  play(): void;
  highScores(): void;
  controls(): void;
  settings(): void;
  best(): number;
  select(): void;
}

const FOOTER_LINKS = [
  { href: "https://instagram.com/uyghurai", node: Instagram, label: "Instagram" },
  { href: "https://x.com/uyghurai", node: Twitter, label: "X (Twitter)" },
  { href: "https://youtube.com/@UyghurAI", node: Youtube, label: "YouTube" },
  { href: "https://idirak.com", node: Globe, label: "Website" },
  { href: "https://ko-fi.com/uyghurAI", node: Coffee, label: "Ko-fi" },
] as const;

/** Cinematic title screen. The starfield and drifting ship render on the canvas behind it. */
export class MainMenu implements Screen {
  readonly el = h("section", { class: "screen main-menu", "aria-labelledby": "game-title" });
  private bestChip: HTMLElement | null = null;

  constructor(private readonly actions: MainMenuActions) {
    this.render();
  }

  render(): void {
    const a = this.actions;
    const btn = (label: string, node: Parameters<typeof icon>[0], onClick: () => void, cls = "btn") =>
      h("button", { class: cls, type: "button", onclick: () => { a.select(); onClick(); } }, icon(node), label);

    this.bestChip = h("div", { class: "best-chip glass" });
    this.el.replaceChildren(
      h("div", { class: "menu-hero" },
        h("h1", { class: "game-title", id: "game-title" }, t("app.title")),
        h("div", { class: "title-latin", "aria-hidden": "true" }, t("app.titleLatin")),
        h("p", { class: "tagline" }, t("app.tagline")),
        this.bestChip),
      h("nav", { class: "menu-card glass panel" },
        ornament(),
        h("div", { class: "menu" },
          btn(t("menu.play"), Play, a.play, "btn primary"),
          btn(t("menu.highScores"), Trophy, a.highScores),
          btn(t("menu.controls"), Gamepad2, a.controls),
          btn(t("menu.settings"), SettingsIcon, a.settings))),
      h("footer", { class: "footer" },
        FOOTER_LINKS.map((l) =>
          h("a", { href: l.href, target: "_blank", rel: "noopener noreferrer", "aria-label": l.label }, icon(l.node)))),
    );
    this.onShow();
  }

  onShow(): void {
    if (!this.bestChip) return;
    const best = this.actions.best();
    this.bestChip.classList.toggle("hidden", best <= 0);
    this.bestChip.replaceChildren(icon(Trophy), t("hud.highScore"), num(best));
  }
}
