import type { Viewport } from "./Viewport";

const LEFT = ["ArrowLeft", "KeyA"];
const RIGHT = ["ArrowRight", "KeyD"];
const UP = ["ArrowUp", "KeyW"];
const DOWN = ["ArrowDown", "KeyS"];
const FIRE = ["Space", "KeyJ", "KeyZ"];
const PAUSE = ["Escape", "KeyP"];
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN, ...FIRE]);

export type PointerKind = "mouse" | "touch" | "pen";

const NON_TEXT_INPUTS = new Set(["range", "checkbox", "radio", "button", "submit"]);

/** Typing targets swallow game keys; sliders and buttons do not. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * Unified keyboard / mouse / touch input. Gameplay reads state each frame; one-shot
 * actions (pause) are delivered through callbacks.
 */
export class Input {
  private keys = new Set<string>();
  /** Enables preventDefault on game keys (avoid page scroll) only while playing. */
  captureKeys = false;

  /** Mouse: hold-to-steer target in world units. */
  mouseHeld = false;
  mouseX = 0;
  mouseY = 0;

  /** Touch: accumulated relative drag in world units, consumed by the player each frame. */
  touchActive = false;
  touchDX = 0;
  touchDY = 0;
  touchFireHeld = false;
  private touchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;

  /** Last pointer type seen — the UI adapts (touch controls, auto-fire). */
  lastPointer: PointerKind = "mouse";
  isTouchDevice = false;

  onPause: () => void = () => {};
  onAnyInput: () => void = () => {};
  onPointerKindChange: (kind: PointerKind) => void = () => {};

  constructor(
    private readonly surface: HTMLElement,
    private readonly viewport: Viewport,
  ) {
    this.isTouchDevice =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
      window.matchMedia?.("(pointer: coarse)").matches;
    if (this.isTouchDevice) this.lastPointer = "touch";

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.reset);
    surface.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    surface.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (isTextField(e.target)) return;
    this.onAnyInput();
    if (PAUSE.includes(e.code)) {
      if (!e.repeat) this.onPause();
      return;
    }
    if (this.captureKeys && GAME_KEYS.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private setPointerKind(kind: PointerKind): void {
    if (kind !== this.lastPointer) {
      this.lastPointer = kind;
      this.onPointerKindChange(kind);
    }
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.onAnyInput();
    this.setPointerKind(e.pointerType as PointerKind);
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      if (this.touchId !== null) return;
      this.touchId = e.pointerId;
      this.touchActive = true;
      this.lastTouchX = e.clientX;
      this.lastTouchY = e.clientY;
    } else if (e.button === 0) {
      this.mouseHeld = true;
      this.updateMouse(e);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.touchId) {
      const s = this.viewport.scale;
      this.touchDX += (e.clientX - this.lastTouchX) / s;
      this.touchDY += (e.clientY - this.lastTouchY) / s;
      this.lastTouchX = e.clientX;
      this.lastTouchY = e.clientY;
    } else if (e.pointerType === "mouse") {
      this.updateMouse(e);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.touchId) {
      this.touchId = null;
      this.touchActive = false;
    } else if (e.pointerType === "mouse") {
      this.mouseHeld = false;
    }
  };

  private updateMouse(e: PointerEvent): void {
    const rect = this.surface.getBoundingClientRect();
    this.mouseX = this.viewport.toWorldX(e.clientX - rect.left);
    this.mouseY = this.viewport.toWorldY(e.clientY - rect.top);
  }

  private any(codes: readonly string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  get axisX(): number {
    return (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
  }

  get axisY(): number {
    return (this.any(DOWN) ? 1 : 0) - (this.any(UP) ? 1 : 0);
  }

  get fireHeld(): boolean {
    return this.any(FIRE) || this.mouseHeld || this.touchFireHeld;
  }

  consumeTouchDelta(): [number, number] {
    const d: [number, number] = [this.touchDX, this.touchDY];
    this.touchDX = 0;
    this.touchDY = 0;
    return d;
  }

  reset = (): void => {
    this.keys.clear();
    this.mouseHeld = false;
    this.touchActive = false;
    this.touchId = null;
    this.touchFireHeld = false;
    this.touchDX = 0;
    this.touchDY = 0;
  };
}
