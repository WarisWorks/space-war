export type ScreenId =
  | "mainMenu" | "pause" | "settings" | "controls" | "leaderboard" | "gameOver";

export interface Screen {
  readonly el: HTMLElement;
  /** Rebuild content (e.g. after a locale change). */
  render(): void;
  onShow?(): void;
}

/**
 * Shows one overlay screen at a time with CSS transitions, manages focus and
 * arrow-key navigation between buttons, and keeps a back-stack for sub-screens.
 */
export class ScreenManager {
  private screens = new Map<ScreenId, Screen>();
  private stack: ScreenId[] = [];
  onNavigate: () => void = () => {};

  constructor(private readonly root: HTMLElement) {
    root.addEventListener("keydown", (e) => this.handleKeys(e));
  }

  register(id: ScreenId, screen: Screen): void {
    this.screens.set(id, screen);
    this.root.append(screen.el);
  }

  get current(): ScreenId | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Replace the whole stack with `id`. */
  show(id: ScreenId): void {
    this.stack = [id];
    this.apply();
  }

  /** Open a sub-screen on top of the current one (Back returns). */
  push(id: ScreenId): void {
    this.stack.push(id);
    this.apply();
  }

  back(): boolean {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    this.apply();
    return true;
  }

  hideAll(): void {
    this.stack = [];
    this.apply();
  }

  renderAll(): void {
    this.screens.forEach((s) => s.render());
    this.apply();
  }

  private apply(): void {
    const current = this.current;
    this.screens.forEach((screen, id) => {
      const active = id === current;
      screen.el.classList.toggle("active", active);
      screen.el.setAttribute("aria-hidden", String(!active));
      screen.el.inert = !active;
    });
    if (current) {
      const screen = this.screens.get(current)!;
      screen.onShow?.();
      // Focus the first actionable element for keyboard / gamepad-style navigation.
      requestAnimationFrame(() => {
        for (const sel of ["[autofocus]", ".btn.primary", ".btn", "button"]) {
          const target = screen.el.querySelector<HTMLElement>(sel);
          if (target && target.offsetParent !== null) {
            target.focus({ preventScroll: true });
            break;
          }
        }
      });
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  private handleKeys(e: KeyboardEvent): void {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const current = this.current && this.screens.get(this.current);
    if (!current) return;
    const focusables = Array.from(
      current.el.querySelectorAll<HTMLElement>(".btn, .toggle, .mute-btn, input[type=range], .segmented button"),
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const idx = focusables.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
    const el = focusables[(next + focusables.length) % focusables.length];
    // Let range inputs keep ←/→; ↑/↓ always navigate.
    e.preventDefault();
    el.focus();
    this.onNavigate();
  }
}
