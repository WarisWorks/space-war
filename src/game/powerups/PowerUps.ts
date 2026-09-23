import { CONFIG, type PowerUpKind } from "../../config/gameConfig";
import { Pool } from "../core/Pool";
import { weightedPick } from "../core/math";

export interface PowerUp {
  kind: PowerUpKind;
  x: number;
  y: number;
  baseX: number;
  t: number;
  radius: number;
}

/** Glowing capsules that float down in a gentle sway until collected or expired. */
export class PowerUps {
  readonly pool = new Pool<PowerUp>(
    () => ({ kind: "shield", x: 0, y: 0, baseX: 0, t: 0, radius: CONFIG.powerups.radius }),
    24,
    8,
  );

  spawn(x: number, y: number, kind: PowerUpKind = weightedPick(CONFIG.powerups.weights)): void {
    const p = this.pool.acquire();
    if (!p) return;
    p.kind = kind;
    p.x = p.baseX = x;
    p.y = y;
    p.t = Math.random() * 3;
  }

  update(dt: number, width: number, height: number): void {
    const c = CONFIG.powerups;
    const items = this.pool.items;
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const p = items[i];
      p.t += dt;
      p.y += c.fallSpeed * dt;
      p.x = Math.min(width - 30, Math.max(30, p.baseX + Math.sin(p.t * 1.8) * c.swayAmplitude));
      if (p.y > height + 40 || p.t > c.lifetime + 3) this.pool.releaseAt(i);
    }
  }

  clear(): void {
    this.pool.clear();
  }
}
