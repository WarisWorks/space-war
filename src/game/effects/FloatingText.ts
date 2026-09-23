import { CONFIG } from "../../config/gameConfig";
import { Pool } from "../core/Pool";

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
  rtl: boolean;
}

const ARABIC = /[؀-ۿ]/;

export const NUMBER_FONT = '"Chakra Petch", "ALKATIP Basma", "Noto Sans Arabic", sans-serif';
export const UYGHUR_FONT = '"ALKATIP Basma", "Noto Sans Arabic", "Chakra Petch", sans-serif';

/** Pooled floating labels (score pops, pickup names). Uyghur labels render RTL. */
export class FloatingTexts {
  private pool = new Pool<FloatText>(
    () => ({ x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: "", color: "#fff", size: 18, rtl: false }),
    CONFIG.effects.maxFloatingTexts,
    16,
  );

  add(x: number, y: number, text: string, color = "#ffffff", size = 20, life = 0.9): void {
    const f = this.pool.acquire();
    if (!f) return;
    f.x = x;
    f.y = y;
    f.vy = -70;
    f.life = life;
    f.maxLife = life;
    f.text = text;
    f.color = color;
    f.size = size;
    f.rtl = ARABIC.test(text);
  }

  update(dt: number): void {
    const items = this.pool.items;
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const f = items[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.pool.releaseAt(i);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 1 / (1 + 2.5 * dt);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const items = this.pool.items;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < this.pool.count; i++) {
      const f = items[i];
      const t = f.life / f.maxLife;
      const age = 1 - t;
      const pop = age < 0.12 ? 0.7 + (age / 0.12) * 0.45 : 1.15 - Math.min(0.15, (age - 0.12) * 0.6);
      ctx.globalAlpha = Math.min(1, t * 2.2);
      ctx.direction = f.rtl ? "rtl" : "ltr";
      ctx.font = `700 ${Math.round(f.size * pop)}px ${f.rtl ? UYGHUR_FONT : NUMBER_FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(3,5,15,0.75)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.direction = "ltr";
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.pool.clear();
  }
}
