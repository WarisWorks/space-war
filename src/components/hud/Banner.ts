import { CONFIG } from "../../config/gameConfig";
import { t } from "../../i18n";
import type { BannerEvent } from "../../game/core/Game";
import { h, num } from "../ui/dom";

/** Large animated centre-screen announcements (wave start, boss warning, etc.). */
export class Banner {
  readonly el = h("div", { class: "banner-layer", role: "status", "aria-live": "polite" });
  private timer: number | null = null;

  show(e: BannerEvent): void {
    let node: HTMLElement;
    let duration: number = CONFIG.waves.bannerTime;
    switch (e.kind) {
      case "wave":
        node = h("div", { class: "banner" },
          h("div", { class: "banner-title" }, t("wave.title", { n: e.wave })),
          h("div", { class: "banner-line" }),
          h("div", { class: "banner-sub" }, t("wave.getReady")));
        break;
      case "boss":
        node = h("div", { class: "banner boss" },
          h("div", { class: "banner-kicker" }, t("wave.title", { n: e.wave })),
          h("div", { class: "banner-title" }, t("boss.warning")),
          h("div", { class: "banner-line" }),
          h("div", { class: "banner-sub" }, t("boss.incoming")));
        break;
      case "waveComplete":
        duration = CONFIG.waves.completeTime;
        node = h("div", { class: "banner complete" },
          h("div", { class: "banner-title" }, t("wave.complete")),
          h("div", { class: "banner-line" }),
          h("div", { class: "bonus-row" }, t("wave.clearBonus"), num(`+${(e.clearBonus ?? 0).toLocaleString("en-US")}`)),
          e.perfectBonus
            ? h("div", { class: "bonus-row" }, t("wave.perfectBonus"), num(`+${e.perfectBonus.toLocaleString("en-US")}`))
            : null,
          h("div", { class: "banner-kicker" }, `${t("wave.next")}: `, num(e.wave + 1)));
        break;
      case "bossDefeated":
        duration = 2.4;
        node = h("div", { class: "banner complete" }, h("div", { class: "banner-title" }, t("boss.defeated")));
        break;
      case "lifeLost":
        duration = 1.3;
        node = h("div", { class: "banner danger small" }, h("div", { class: "banner-title" }, t("player.lifeLost")));
        break;
      case "lastLife":
        duration = 1.6;
        node = h("div", { class: "banner danger" }, h("div", { class: "banner-title" }, t("player.lastLife")));
        break;
    }
    node.style.setProperty("--banner-duration", `${duration}s`);
    this.el.replaceChildren(node);
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => node.remove(), duration * 1000 + 50);
  }

  clear(): void {
    this.el.replaceChildren();
  }

  /** Pause/resume CSS animations together with the game. */
  setPaused(paused: boolean): void {
    for (const child of Array.from(this.el.children) as HTMLElement[]) {
      child.style.animationPlayState = paused ? "paused" : "running";
    }
  }
}
