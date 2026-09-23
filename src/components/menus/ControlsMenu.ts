import { ArrowLeft, ArrowRight, Hand, Keyboard, MousePointer2, Pause, Smartphone } from "lucide";
import { CONFIG, type EnemyKind, type PowerUpKind } from "../../config/gameConfig";
import { getDirection, t } from "../../i18n";
import type { SpriteSet } from "../../game/render/Sprites";
import { h, icon, num, ornament } from "../ui/dom";
import type { Screen } from "../ui/ScreenManager";

const POWERUP_INFO: [PowerUpKind, string, string][] = [
  ["multiShot", "powerup.multiShot", "controls.multiShotDesc"],
  ["shield", "powerup.shield", "controls.shieldDesc"],
  ["speed", "powerup.speed", "controls.speedDesc"],
  ["life", "powerup.extraLife", "controls.extraLifeDesc"],
];

const ENEMIES: EnemyKind[] = ["fighter", "scout", "heavy", "shooter", "elite"];

export class ControlsMenu implements Screen {
  readonly el = h("section", { class: "screen backdrop", "aria-labelledby": "controls-title" });
  private images = new Map<string, string>();

  constructor(private readonly sprites: SpriteSet, private readonly back: () => void) {
    this.render();
  }

  private img(key: string, canvas: HTMLCanvasElement): HTMLElement {
    let src = this.images.get(key);
    if (!src) {
      src = canvas.toDataURL();
      this.images.set(key, src);
    }
    return h("img", { src, alt: "" });
  }

  render(): void {
    const kbd = (k: string) => h("kbd", null, k);
    const or = () => h("span", { class: "or", dir: "auto" }, t("controls.or"));
    const BackIcon = getDirection() === "rtl" ? ArrowRight : ArrowLeft;
    this.el.replaceChildren(
      h("div", { class: "panel glass wide" },
        h("h2", { class: "panel-title", id: "controls-title" }, t("controls.title")),
        ornament(),
        h("div", { class: "controls-grid" },
          h("div", { class: "controls-card" },
            h("h3", null, icon(Keyboard), t("controls.keyboard")),
            h("div", { class: "control-row" }, t("controls.move"),
              h("span", { class: "keys" }, kbd("W"), kbd("A"), kbd("S"), kbd("D"), or(),
                h("span", { class: "keys", title: t("controls.arrows"), "aria-label": t("controls.arrows") },
                  kbd("↑"), kbd("←"), kbd("↓"), kbd("→")))),
            h("div", { class: "control-row" }, t("controls.fire"), h("span", { class: "keys" }, kbd("Space"))),
            h("div", { class: "control-row" }, t("controls.pause"), h("span", { class: "keys" }, kbd("P"), or(), kbd("Esc"))),
            h("div", { class: "control-row" }, icon(MousePointer2), h("span", null, t("controls.mouse")))),
          h("div", { class: "controls-card" },
            h("h3", null, icon(Smartphone), t("controls.touch")),
            h("div", { class: "control-row" }, icon(Hand), h("span", null, t("controls.drag"))),
            h("div", { class: "control-row" }, t("controls.fire"), h("span", null, t("controls.autoFireHint"))),
            h("div", { class: "control-row" }, t("controls.pause"), h("span", { class: "keys" }, icon(Pause))))),
        h("h3", { class: "section-title" }, t("controls.powerups")),
        h("div", { class: "legend" },
          POWERUP_INFO.map(([kind, name, desc]) =>
            h("div", { class: "legend-item" },
              this.img(`p-${kind}`, this.sprites.powerups[kind].canvas),
              h("div", null, h("div", { class: "name" }, t(name)), h("div", { class: "desc" }, t(desc)))))),
        h("h3", { class: "section-title" }, t("controls.enemies")),
        h("div", { class: "legend" },
          ENEMIES.map((kind) =>
            h("div", { class: "legend-item" },
              this.img(`e-${kind}`, this.sprites.enemies[kind].canvas),
              h("div", null,
                h("div", { class: "name" }, t(`enemy.${kind}`)),
                h("div", { class: "pts" }, num(`+${CONFIG.enemies[kind].score}`)))))),
        h("div", { class: "btn-row" },
          h("button", { class: "btn", type: "button", onclick: this.back }, icon(BackIcon), t("menu.back")))),
    );
  }
}
