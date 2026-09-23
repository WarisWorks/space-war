import { CONFIG } from "../../config/gameConfig";
import { Pool } from "../core/Pool";
import { rand, TAU } from "../core/math";
import type { GlowColor, SpriteSet } from "../render/Sprites";
import { PALETTE } from "../render/palette";

export const enum ParticleKind {
  Glow = 0,
  Spark = 1,
  Debris = 2,
  Ring = 3,
}

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  drag: number;
  rot: number;
  vr: number;
  color: GlowColor;
}

const makeParticle = (): Particle => ({
  kind: ParticleKind.Glow, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
  size: 1, endSize: 0, drag: 0, rot: 0, vr: 0, color: "cyan",
});

export interface BurstOptions {
  count: number;
  speed: [number, number];
  life: [number, number];
  size: [number, number];
  endSize?: number;
  color: GlowColor | readonly GlowColor[];
  kind?: ParticleKind;
  drag?: number;
  /** Emission cone: centre angle and spread (radians). Default: full circle. */
  angle?: number;
  spread?: number;
  /** Inherited velocity. */
  vx?: number;
  vy?: number;
}

/**
 * Pooled particle system. Additive-blended glows, velocity-stretched sparks,
 * tumbling debris and expanding shockwave rings.
 */
export class Particles {
  readonly pool = new Pool<Particle>(makeParticle, CONFIG.effects.maxParticles, 600);

  constructor(private readonly sprites: SpriteSet) {}

  spawn(
    kind: ParticleKind, x: number, y: number, vx: number, vy: number,
    life: number, size: number, endSize: number, color: GlowColor, drag = 0,
  ): Particle | null {
    const p = this.pool.acquire();
    if (!p) return null;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.endSize = endSize;
    p.drag = drag;
    p.color = color;
    p.rot = Math.random() * TAU;
    p.vr = rand(-8, 8);
    return p;
  }

  burst(x: number, y: number, o: BurstOptions): void {
    const colors = typeof o.color === "string" ? [o.color] : o.color;
    for (let i = 0; i < o.count; i++) {
      const a = o.angle === undefined ? Math.random() * TAU : o.angle + rand(-1, 1) * (o.spread ?? 0.5);
      const s = rand(o.speed[0], o.speed[1]);
      const size = rand(o.size[0], o.size[1]);
      this.spawn(
        o.kind ?? ParticleKind.Glow, x, y,
        Math.cos(a) * s + (o.vx ?? 0), Math.sin(a) * s + (o.vy ?? 0),
        rand(o.life[0], o.life[1]), size, o.endSize ?? 0,
        colors[(Math.random() * colors.length) | 0], o.drag ?? 2,
      );
    }
  }

  /** Composite explosion; `scale` ≈ 1 for small ships, 3+ for bosses. */
  explosion(x: number, y: number, scale: number, colors: readonly GlowColor[]): void {
    const s = scale;
    this.spawn(ParticleKind.Glow, x, y, 0, 0, 0.18 + 0.06 * s, 60 * s, 90 * s, "ivory");
    this.spawn(ParticleKind.Ring, x, y, 0, 0, 0.35 + 0.1 * s, 8 * s, 70 * s, colors[0]);
    if (s > 1.5) this.spawn(ParticleKind.Ring, x, y, 0, 0, 0.6 + 0.1 * s, 4 * s, 110 * s, "ivory");
    this.burst(x, y, {
      count: Math.round(14 * s), speed: [60, 260 * Math.sqrt(s)], life: [0.35, 0.8],
      size: [10, 22 * Math.sqrt(s)], color: colors, drag: 3,
    });
    this.burst(x, y, {
      count: Math.round(12 * s), speed: [200, 520 * Math.sqrt(s)], life: [0.2, 0.5],
      size: [1.5, 2.5], color: ["ivory", colors[0]], kind: ParticleKind.Spark, drag: 3.5,
    });
    this.burst(x, y, {
      count: Math.round(6 * s), speed: [60, 220 * Math.sqrt(s)], life: [0.6, 1.2],
      size: [2, 4.5], color: colors, kind: ParticleKind.Debris, drag: 1.2,
    });
  }

  impact(x: number, y: number, color: GlowColor, angle = -Math.PI / 2): void {
    this.spawn(ParticleKind.Glow, x, y, 0, 0, 0.1, 16, 26, "ivory");
    this.burst(x, y, {
      count: 5, speed: [120, 320], life: [0.12, 0.28], size: [1, 1.8], color: [color, "ivory"],
      kind: ParticleKind.Spark, angle, spread: 0.9, drag: 5,
    });
  }

  update(dt: number): void {
    const items = this.pool.items;
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.releaseAt(i);
        continue;
      }
      const d = 1 / (1 + p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const items = this.pool.items;
    const n = this.pool.count;
    const glow = this.sprites.glow;

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const p = items[i];
      const t = p.life / p.maxLife;
      if (p.kind === ParticleKind.Glow) {
        const size = p.endSize + (p.size - p.endSize) * t;
        ctx.globalAlpha = t;
        ctx.drawImage(glow[p.color].canvas, p.x - size / 2, p.y - size / 2, size, size);
      } else if (p.kind === ParticleKind.Spark) {
        ctx.globalAlpha = t;
        ctx.strokeStyle = PALETTE[p.color];
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else if (p.kind === ParticleKind.Ring) {
        const r = p.endSize + (p.size - p.endSize) * t;
        ctx.globalAlpha = t * t;
        ctx.strokeStyle = PALETTE[p.color];
        ctx.lineWidth = 1 + 5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < n; i++) {
      const p = items[i];
      if (p.kind !== ParticleKind.Debris) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = PALETTE[p.color];
      const c = Math.cos(p.rot) * p.size;
      const s = Math.sin(p.rot) * p.size;
      ctx.beginPath();
      ctx.moveTo(p.x + c, p.y + s);
      ctx.lineTo(p.x - s * 0.5, p.y + c * 0.5);
      ctx.lineTo(p.x - c, p.y - s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.pool.clear();
  }
}
