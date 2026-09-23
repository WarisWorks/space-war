import { CONFIG } from "../../config/gameConfig";
import { clamp } from "./math";

/**
 * Maps the fixed-width logical world onto the screen. The world keeps a portrait-ish
 * aspect (720–900 × 1000–1400) so difficulty is identical on phones and desktops;
 * the starfield fills any leftover screen area.
 */
export class Viewport {
  /** Screen size in CSS pixels. */
  screenW = 1;
  screenH = 1;
  dpr = 1;
  /** Logical world size. */
  width: number = CONFIG.world.minWidth;
  height: number = CONFIG.world.minHeight;
  /** World → CSS pixel scale and offset. */
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  update(screenW: number, screenH: number, dpr: number): void {
    const w = CONFIG.world;
    this.screenW = Math.max(1, screenW);
    this.screenH = Math.max(1, screenH);
    this.dpr = Math.min(dpr || 1, 2);
    const aspect = this.screenW / this.screenH;
    if (aspect >= w.wideAspect) {
      this.height = w.minHeight;
      this.width = clamp(w.minHeight * aspect, w.minWidth, w.maxWidth);
    } else {
      this.width = w.minWidth;
      this.height = clamp(w.minWidth / aspect, w.minHeight, w.maxHeight);
    }
    this.scale = Math.min(this.screenW / this.width, this.screenH / this.height);
    this.offsetX = (this.screenW - this.width * this.scale) / 2;
    this.offsetY = (this.screenH - this.height * this.scale) / 2;
  }

  toWorldX(screenX: number): number {
    return (screenX - this.offsetX) / this.scale;
  }

  toWorldY(screenY: number): number {
    return (screenY - this.offsetY) / this.scale;
  }
}
