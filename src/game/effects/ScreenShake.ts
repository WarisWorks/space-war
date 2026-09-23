import { CONFIG } from "../../config/gameConfig";

/** Trauma-based screen shake: offset ∝ trauma², smooth pseudo-noise, decays over time. */
export class ScreenShake {
  enabled = true;
  private trauma = 0;
  private time = 0;
  x = 0;
  y = 0;
  angle = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - CONFIG.effects.shakeDecay * dt);
    const k = this.enabled ? this.trauma * this.trauma : 0;
    const m = CONFIG.effects.maxShake;
    const t = this.time * 38;
    this.x = k * m * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.9 + 1.7) * 0.4);
    this.y = k * m * (Math.sin(t * 1.7 + 4.1) * 0.6 + Math.sin(t * 3.3 + 0.3) * 0.4);
    this.angle = k * 0.02 * Math.sin(t * 1.1 + 2.2);
  }

  reset(): void {
    this.trauma = 0;
    this.x = this.y = this.angle = 0;
  }
}
