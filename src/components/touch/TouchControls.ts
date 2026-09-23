import { Crosshair, Hand } from "lucide";
import { t } from "../../i18n";
import type { Input } from "../../game/core/Input";
import { h, icon } from "../ui/dom";

/**
 * Mobile overlay: a large fire button (only when auto-fire is off) and a one-time
 * "drag to steer" hint. Movement itself is relative drag anywhere on the canvas,
 * so the finger never covers the ship.
 */
export class TouchControls {
  readonly el = h("div", { class: "touch-controls" });
  private fireBtn: HTMLElement;
  private hint: HTMLElement;
  private hintShown = false;

  constructor(private readonly input: Input) {
    this.fireBtn = h("button", { class: "fire-btn", type: "button", "aria-label": t("touch.fire") }, icon(Crosshair));
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      this.fireBtn.setPointerCapture?.(e.pointerId);
      input.touchFireHeld = true;
      this.fireBtn.classList.add("active");
    };
    const release = (): void => {
      input.touchFireHeld = false;
      this.fireBtn.classList.remove("active");
    };
    this.fireBtn.addEventListener("pointerdown", press);
    this.fireBtn.addEventListener("pointerup", release);
    this.fireBtn.addEventListener("pointercancel", release);
    this.hint = h("div", { class: "drag-hint glass" }, icon(Hand), t("controls.drag"));
    this.el.append(this.hint, this.fireBtn);
  }

  rebuild(): void {
    this.fireBtn.setAttribute("aria-label", t("touch.fire"));
    this.hint.replaceChildren(icon(Hand), t("controls.drag"));
  }

  update(visible: boolean, autoFire: boolean): void {
    const touch = this.input.lastPointer === "touch" || this.input.isTouchDevice;
    this.el.classList.toggle("visible", visible && touch);
    this.fireBtn.classList.toggle("hidden", autoFire);
  }

  /** Shows the drag hint once per session at the start of the first wave. */
  showHint(): void {
    if (this.hintShown) return;
    this.hintShown = true;
    this.hint.classList.add("visible");
    window.setTimeout(() => this.hint.classList.remove("visible"), 3500);
  }
}
