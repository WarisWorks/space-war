import { ArrowLeft, ArrowRight, Gamepad2, Languages, Music, Volume2, VolumeX } from "lucide";
import { getDirection, LOCALES, t, type LocaleCode } from "../../i18n";
import type { Settings } from "../../game/settings/Settings";
import { h, icon, ornament } from "../ui/dom";
import type { Screen } from "../ui/ScreenManager";

export interface SettingsActions {
  back(): void;
  preview(): void;
  isTouch(): boolean;
}

export class SettingsMenu implements Screen {
  readonly el = h("section", { class: "screen backdrop", "aria-labelledby": "settings-title" });

  constructor(private readonly settings: Settings, private readonly actions: SettingsActions) {
    this.render();
  }

  private volumeRow(
    label: string, volumeKey: "musicVolume" | "sfxVolume", muteKey: "musicMuted" | "sfxMuted",
  ): HTMLElement {
    const s = this.settings;
    const value = h("bdi", { class: "value num" }, String(Math.round(s.values[volumeKey] * 100)));
    const muted = s.values[muteKey];
    const mute = h("button", {
      class: "mute-btn", type: "button", "aria-pressed": String(muted), "aria-label": `${t("settings.mute")} — ${label}`,
      title: t("settings.mute"),
      onclick: () => {
        s.set(muteKey, !s.values[muteKey]);
        this.render();
        this.actions.preview();
      },
    }, icon(muted ? VolumeX : Volume2));
    const range = h("input", {
      type: "range", min: 0, max: 100, step: 5, value: Math.round(s.values[volumeKey] * 100),
      "aria-label": label,
    });
    range.addEventListener("input", () => {
      s.set(volumeKey, Number(range.value) / 100);
      if (s.values[muteKey]) s.set(muteKey, false);
      value.textContent = range.value;
      mute.setAttribute("aria-pressed", "false");
      mute.replaceChildren(icon(Volume2));
    });
    range.addEventListener("change", () => this.actions.preview());
    return h("div", { class: "setting" }, h("span", { class: "setting-label" }, label), range, value, mute);
  }

  private toggleRow(label: string, checked: boolean, onToggle: () => void): HTMLElement {
    const btn = h("button", {
      class: "toggle", type: "button", role: "switch", "aria-checked": String(checked), "aria-label": label,
      title: checked ? t("settings.on") : t("settings.off"),
      onclick: () => {
        onToggle();
        this.actions.preview();
        this.render();
      },
    });
    return h("div", { class: "setting" }, h("span", { class: "setting-label" }, label), btn);
  }

  render(): void {
    const s = this.settings;
    const v = s.values;
    const autoFire = v.autoFire ?? this.actions.isTouch();
    const locales = Object.keys(LOCALES) as LocaleCode[];
    const BackIcon = getDirection() === "rtl" ? ArrowRight : ArrowLeft;

    this.el.replaceChildren(
      h("div", { class: "panel glass" },
        h("h2", { class: "panel-title", id: "settings-title" }, t("settings.title")),
        ornament(),
        h("div", { class: "settings-group" },
          h("h3", null, icon(Music), t("settings.audio")),
          this.volumeRow(t("settings.music"), "musicVolume", "musicMuted"),
          this.volumeRow(t("settings.sfx"), "sfxVolume", "sfxMuted")),
        h("div", { class: "settings-group" },
          h("h3", null, icon(Gamepad2), t("settings.gameplay")),
          this.toggleRow(t("settings.screenShake"), v.screenShake,
            () => s.set("screenShake", !v.screenShake)),
          this.toggleRow(t("settings.autoFire"), autoFire,
            () => s.set("autoFire", !autoFire))),
        h("div", { class: "settings-group" },
          h("h3", null, icon(Languages), t("settings.language")),
          h("div", { class: "setting" },
            h("div", { class: "segmented", role: "group", "aria-label": t("settings.language") },
              locales.map((code) =>
                h("button", {
                  type: "button", lang: code, dir: getDirection(code), "aria-pressed": String(v.locale === code),
                  onclick: () => s.set("locale", code),
                }, LOCALES[code]["meta.languageName"]))))),
        h("div", { class: "btn-row" },
          h("button", { class: "btn", type: "button", onclick: () => this.actions.back() }, icon(BackIcon), t("menu.back")))),
    );
  }
}
