import { CONFIG } from "../../config/gameConfig";
import { rand, TAU } from "../core/math";
import type { SpriteSet } from "../render/Sprites";
import { PALETTE } from "../render/palette";

interface StarLayer {
  x: Float32Array;
  y: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  twinkle: Float32Array;
  speed: number;
}

interface ShootingStar {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Planet {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  size: number;
  speed: number;
}

/**
 * Screen-space parallax background: baked nebula tile, three star layers, a slowly
 * drifting planet and occasional shooting stars. Everything scrolls downward; the
 * scroll speed can be boosted (warp during wave transitions / speed power-up).
 */
export class Starfield {
  private layers: StarLayer[] = [];
  private nebula: HTMLCanvasElement | null = null;
  private nebulaY = 0;
  private planets: Planet[] = [];
  private shooting: ShootingStar = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 };
  private shootingTimer = 3;
  private time = 0;
  private w = 1;
  private h = 1;
  /** Multiplier applied to scroll speed (1 = cruise). Smoothed towards `targetWarp`. */
  warp = 1;
  targetWarp = 1;

  constructor(private readonly sprites: SpriteSet) {}

  resize(w: number, h: number): void {
    const changed = Math.abs(w - this.w) > 2 || Math.abs(h - this.h) > 2;
    this.w = w;
    this.h = h;
    if (!changed && this.layers.length) return;
    // Star density scales with screen area (relative to a 900×1200 reference).
    const density = Math.min(2.2, Math.max(0.6, (w * h) / (900 * 1200)));
    this.layers = CONFIG.stars.layers.map((cfg) => {
      const n = Math.round(cfg.count * density);
      const layer: StarLayer = {
        x: new Float32Array(n), y: new Float32Array(n), size: new Float32Array(n),
        alpha: new Float32Array(n), twinkle: new Float32Array(n), speed: cfg.speed,
      };
      for (let i = 0; i < n; i++) {
        layer.x[i] = Math.random() * w;
        layer.y[i] = Math.random() * h;
        layer.size[i] = rand(cfg.size[0], cfg.size[1]);
        layer.alpha[i] = rand(cfg.alpha[0], cfg.alpha[1]);
        layer.twinkle[i] = Math.random() * TAU;
      }
      return layer;
    });
    this.nebula = this.bakeNebula(Math.ceil(w), Math.ceil(h * 1.5));
    this.planets = [this.makePlanet(true)];
  }

  private bakeNebula(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    // Nebula is soft — bake at half resolution.
    c.width = Math.max(1, Math.ceil(w / 2));
    c.height = Math.max(1, Math.ceil(h / 2));
    const ctx = c.getContext("2d")!;
    ctx.scale(0.5, 0.5);
    const blobs: [string, number][] = [
      ["61,123,255", 0.2], ["155,107,255", 0.16], ["255,63,164", 0.08], ["83,230,255", 0.08],
      ["255,194,75", 0.05],
    ];
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      const [rgb, a] = blobs[i % blobs.length];
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = rand(0.25, 0.6) * Math.max(w, 600);
      // Draw each blob three times, wrapped vertically, so the tile loops seamlessly.
      for (const dy of [-h, 0, h]) {
        const g = ctx.createRadialGradient(x, y + dy, 0, x, y + dy, r);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y + dy - r, r * 2, r * 2);
      }
    }
    return c;
  }

  private makePlanet(initial: boolean): Planet {
    const size = rand(90, 190);
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(size * 2.4);
    const ctx = c.getContext("2d")!;
    const cx = c.width / 2;
    const r = size / 2;
    const hues = [
      ["#ffc24b", "#b3541e", "#2b1208"],
      ["#8fb4ff", "#2f4fb0", "#070d2a"],
      ["#ff8ad0", "#7a2a8a", "#14051e"],
    ][Math.floor(Math.random() * 3)];
    // Atmosphere halo
    const halo = ctx.createRadialGradient(cx, cx, r * 0.9, cx, cx, r * 1.35);
    halo.addColorStop(0, hues[0] + "55");
    halo.addColorStop(1, hues[0] + "00");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, c.width, c.height);
    // Body with terminator shading
    const g = ctx.createRadialGradient(cx - r * 0.4, cx - r * 0.4, r * 0.1, cx, cx, r);
    g.addColorStop(0, hues[0]);
    g.addColorStop(0.55, hues[1]);
    g.addColorStop(1, hues[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, TAU);
    ctx.fill();
    // Bands
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? "#000000" : "#ffffff";
      ctx.fillRect(cx - r, cx - r + (i / 7) * r * 2 + rand(-4, 4), r * 2, rand(3, r * 0.16));
    }
    ctx.restore();
    // Ring
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.24);
    ctx.strokeStyle = hues[0] + "88";
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, Math.PI * 0.02, Math.PI * 0.98, true);
    ctx.stroke();
    ctx.restore();
    return {
      canvas: c,
      x: rand(0.1, 0.9) * this.w,
      y: initial ? rand(0.1, 0.5) * this.h : -size * 1.5,
      size,
      speed: rand(6, 12),
    };
  }

  update(dt: number): void {
    this.time += dt;
    this.warp += (this.targetWarp - this.warp) * (1 - Math.exp(-3 * dt));
    const w = this.warp;
    for (const layer of this.layers) {
      const dy = layer.speed * w * dt;
      for (let i = 0; i < layer.y.length; i++) {
        layer.y[i] += dy;
        if (layer.y[i] > this.h + 4) {
          layer.y[i] -= this.h + 8;
          layer.x[i] = Math.random() * this.w;
        }
      }
    }
    if (this.nebula) {
      this.nebulaY = (this.nebulaY + 8 * w * dt) % (this.nebula.height * 2);
    }
    for (let i = 0; i < this.planets.length; i++) {
      const p = this.planets[i];
      p.y += p.speed * w * dt;
      if (p.y - p.size * 1.3 > this.h) this.planets[i] = this.makePlanet(false);
    }
    // Shooting stars
    const s = this.shooting;
    if (s.active) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) s.active = false;
    } else if ((this.shootingTimer -= dt) <= 0) {
      this.shootingTimer = rand(3, 9);
      if (Math.random() < CONFIG.stars.shootingStarChance * 3) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        s.active = true;
        s.x = rand(0.2, 0.8) * this.w;
        s.y = rand(0, 0.4) * this.h;
        s.vx = dir * rand(500, 800);
        s.vy = rand(250, 400);
        s.life = rand(0.5, 0.9);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { w, h } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, PALETTE.spaceDeep);
    bg.addColorStop(1, PALETTE.space);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (this.nebula) {
      const nh = this.nebula.height * 2;
      const y = this.nebulaY - nh;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.nebula, 0, y, w, nh);
      ctx.drawImage(this.nebula, 0, y + nh, w, nh);
      ctx.globalAlpha = 1;
    }

    for (const p of this.planets) {
      const d = p.size * 2.4;
      ctx.globalAlpha = 0.32;
      ctx.drawImage(p.canvas, p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;

    const glow = this.sprites.glow.ivory.canvas;
    const warpStretch = Math.max(0, this.warp - 1);
    for (let li = 0; li < this.layers.length; li++) {
      const layer = this.layers[li];
      const stretch = warpStretch * layer.speed * 0.05;
      ctx.fillStyle = li === 0 ? "#b9c8ff" : "#ffffff";
      for (let i = 0; i < layer.x.length; i++) {
        const tw = 0.75 + 0.25 * Math.sin(this.time * 2.2 + layer.twinkle[i]);
        const a = layer.alpha[i] * tw;
        const s = layer.size[i];
        ctx.globalAlpha = a;
        ctx.fillRect(layer.x[i] - s / 2, layer.y[i] - s / 2 - stretch, s, s + stretch);
        if (li === 2) {
          ctx.globalAlpha = a * 0.5;
          ctx.drawImage(glow, layer.x[i] - s * 3, layer.y[i] - s * 3, s * 6, s * 6);
        }
      }
    }

    const sh = this.shooting;
    if (sh.active) {
      const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.18, sh.y - sh.vy * 0.18);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(120,180,255,0)");
      ctx.globalAlpha = Math.min(1, sh.life * 3);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - sh.vx * 0.18, sh.y - sh.vy * 0.18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
