import { Heart, Shield, Zap } from "lucide";
import type { EnemyKind, PowerUpKind } from "../../config/gameConfig";
import { PALETTE } from "./palette";
import { iconToPath2D, MULTI_SHOT_ICON } from "./iconPath";

/**
 * Baked sprite cache. Every vector shape — with its glow — is rendered once into an
 * offscreen canvas at 2× resolution, so the hot render path is `drawImage` only
 * (no per-frame shadowBlur, gradients or path building).
 */
export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Size in world units. */
  w: number;
  h: number;
}

const RES = 2;

type Ctx = CanvasRenderingContext2D;

function bake(w: number, h: number, draw: (ctx: Ctx) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * RES);
  canvas.height = Math.ceil(h * RES);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(RES, RES);
  ctx.translate(w / 2, h / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx);
  return { canvas, w, h };
}

/** White silhouette of a sprite, used for the enemy hit-flash. */
function silhouette(src: Sprite, color = "#ffffff"): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = src.canvas.width;
  canvas.height = src.canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(src.canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, w: src.w, h: src.h };
}

function poly(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Mirror a half outline (x ≥ 0, listed top→bottom) into a full symmetric polygon. */
function mirrored(half: number[]): number[] {
  const out = [...half];
  for (let i = half.length - 2; i >= 0; i -= 2) {
    if (half[i] !== 0) out.push(-half[i], half[i + 1]);
  }
  return out;
}

function diamond(ctx: Ctx, x: number, y: number, s: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.7, y);
  ctx.closePath();
  ctx.fill();
}

function glowStroke(ctx: Ctx, color: string, blur: number, width: number): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function core(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
}

// ───────────────────────────── Player ─────────────────────────────

function drawPlayer(ctx: Ctx): void {
  const hull = mirrored([0, -38, 7, -22, 9, -6, 30, 9, 33, 20, 12, 18, 9, 28, 0, 28]);
  // Outer energy glow
  poly(ctx, hull);
  glowStroke(ctx, PALETTE.cyan, 14, 2);

  const body = ctx.createLinearGradient(0, -38, 0, 28);
  body.addColorStop(0, "#f2f6ff");
  body.addColorStop(0.35, "#8fa8dc");
  body.addColorStop(0.75, "#2a3f8f");
  body.addColorStop(1, "#101a45");
  poly(ctx, hull);
  ctx.fillStyle = body;
  ctx.fill();

  // Side shading for volume
  const side = ctx.createLinearGradient(-33, 0, 33, 0);
  side.addColorStop(0, "rgba(5,10,40,0.55)");
  side.addColorStop(0.45, "rgba(255,255,255,0.05)");
  side.addColorStop(0.55, "rgba(255,255,255,0.05)");
  side.addColorStop(1, "rgba(5,10,40,0.55)");
  ctx.fillStyle = side;
  ctx.fill();

  // Wing leading-edge highlights
  ctx.strokeStyle = "rgba(160,235,255,0.85)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(9, -6);
  ctx.lineTo(30, 9);
  ctx.moveTo(-9, -6);
  ctx.lineTo(-30, 9);
  ctx.stroke();

  // Spine
  ctx.strokeStyle = "rgba(83,230,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22);
  ctx.stroke();

  // Ikat-inspired wing motif (atlas silk diamonds)
  diamond(ctx, 19, 11, 3.6, PALETTE.saffron);
  diamond(ctx, -19, 11, 3.6, PALETTE.saffron);
  diamond(ctx, 19, 11, 1.6, PALETTE.ember);
  diamond(ctx, -19, 11, 1.6, PALETTE.ember);
  diamond(ctx, 26, 16, 2.4, PALETTE.cyan);
  diamond(ctx, -26, 16, 2.4, PALETTE.cyan);

  // Cockpit
  const glass = ctx.createLinearGradient(0, -22, 0, -2);
  glass.addColorStop(0, "#e9fdff");
  glass.addColorStop(0.4, PALETTE.cyan);
  glass.addColorStop(1, "#0b2a6b");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -12, 4.2, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine nozzles
  ctx.fillStyle = "#0a0f24";
  ctx.fillRect(-8, 24, 5, 5);
  ctx.fillRect(3, 24, 5, 5);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillRect(-7, 27, 3, 2);
  ctx.fillRect(4, 27, 3, 2);
}

// ───────────────────────────── Enemies ─────────────────────────────

function hullFill(ctx: Ctx, pts: number[], top: string, bottom: string, edge: string, h: number): void {
  poly(ctx, pts);
  glowStroke(ctx, edge, 12, 2);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  poly(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawFighter(ctx: Ctx): void {
  const pts = mirrored([0, -22, 8, -12, 22, -18, 26, -4, 8, 8, 0, 24]);
  hullFill(ctx, pts, "#3a0a10", "#ff5a3c", "#ff8a5c", 48);
  ctx.strokeStyle = "rgba(255,200,160,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-18, -10);
  ctx.lineTo(0, 12);
  ctx.lineTo(18, -10);
  ctx.stroke();
  core(ctx, 0, -2, 4, PALETTE.saffron);
}

function drawScout(ctx: Ctx): void {
  const pts = mirrored([0, -18, 4, -8, 18, -14, 6, 2, 0, 20]);
  hullFill(ctx, pts, "#0b3a2c", "#9dff5c", "#b8ff8a", 38);
  core(ctx, 0, -4, 3, PALETTE.lime);
}

function drawHeavy(ctx: Ctx): void {
  const pts = mirrored([0, -40, 14, -40, 40, -30, 46, 4, 30, 30, 0, 40]);
  hullFill(ctx, pts, "#170a33", "#6b3fd4", "#b394ff", 80);
  // Armor plates
  ctx.strokeStyle = "rgba(200,180,255,0.35)";
  ctx.lineWidth = 1.2;
  poly(ctx, mirrored([0, -26, 22, -22, 28, 2, 16, 20, 0, 26]));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-40, -8);
  ctx.lineTo(40, -8);
  ctx.stroke();
  // Turrets
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#1c0f3a";
    ctx.beginPath();
    ctx.arc(22 * s, 14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.saffron;
    ctx.stroke();
    ctx.fillStyle = PALETTE.saffron;
    ctx.fillRect(22 * s - 2, 18, 4, 12);
  }
  core(ctx, 0, -8, 8, PALETTE.magenta);
}

function drawShooter(ctx: Ctx): void {
  // Fins
  ctx.fillStyle = "#5a3208";
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 3 + Math.PI / 6);
    poly(ctx, [-5, 0, 5, 0, 3, -30, -3, -30]);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  glowStroke(ctx, PALETTE.saffron, 12, 2);
  const g = ctx.createRadialGradient(0, -6, 2, 0, 0, 24);
  g.addColorStop(0, "#ffd98a");
  g.addColorStop(0.5, "#a85a10");
  g.addColorStop(1, "#2a1404");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,210,140,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cannon
  ctx.fillStyle = "#1a0d02";
  ctx.fillRect(-3.5, 10, 7, 16);
  core(ctx, 0, 0, 6, PALETTE.ember);
}

function drawElite(ctx: Ctx): void {
  const pts = mirrored([0, -30, 14, -14, 42, -26, 34, -4, 40, 20, 12, 14, 0, 30]);
  hullFill(ctx, pts, "#2a0630", "#ff3fa4", "#ff8ad0", 60);
  ctx.strokeStyle = "rgba(255,200,240,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-34, -4);
  ctx.quadraticCurveTo(0, 12, 34, -4);
  ctx.stroke();
  diamond(ctx, 24, -6, 3, PALETTE.saffron);
  diamond(ctx, -24, -6, 3, PALETTE.saffron);
  diamond(ctx, 32, 12, 2.4, PALETTE.saffron);
  diamond(ctx, -32, 12, 2.4, PALETTE.saffron);
  core(ctx, 0, 2, 8, PALETTE.magenta);
}

/** Eight-pointed star (two rotated squares) — the girih rosette of Uyghur architecture. */
function rosette(ctx: Ctx, r: number): void {
  for (const rot of [0, Math.PI / 4]) {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.restore();
    ctx.stroke();
  }
}

function drawBoss(ctx: Ctx): void {
  const pts = mirrored([0, -80, 30, -80, 80, -60, 120, -30, 128, 20, 100, 60, 40, 70, 0, 90]);
  hullFill(ctx, pts, "#16030a", "#8a1234", "#ffc24b", 170);

  // Inner armour
  ctx.strokeStyle = "rgba(255,194,75,0.35)";
  ctx.lineWidth = 1.5;
  poly(ctx, mirrored([0, -62, 60, -48, 96, -18, 100, 18, 74, 44, 0, 62]));
  ctx.stroke();

  // Ikat bands across the wings: alternating saffron / lapis diamonds
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = s * (46 + i * 12);
      const y = -8 + i * 4;
      diamond(ctx, x, y, 5.5, i % 2 ? PALETTE.lapis : PALETTE.saffron);
      diamond(ctx, x, y, 2.2, "#fff4d6");
    }
    // Side cannons
    ctx.fillStyle = "#12040a";
    ctx.fillRect(s * 90 - 7, 36, 14, 30);
    ctx.strokeStyle = PALETTE.saffron;
    ctx.strokeRect(s * 90 - 7, 36, 14, 30);
  }

  // Rosette with core
  ctx.save();
  ctx.translate(0, 4);
  ctx.strokeStyle = PALETTE.saffron;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = PALETTE.saffron;
  ctx.shadowBlur = 12;
  rosette(ctx, 40);
  ctx.lineWidth = 1.5;
  rosette(ctx, 26);
  ctx.restore();
  core(ctx, 0, 4, 12, PALETTE.ember);
}

// ───────────────────────────── Projectiles & FX ─────────────────────────────

function drawPlayerBolt(ctx: Ctx): void {
  // Head at the top; the long tail is the baked laser trail.
  const g = ctx.createLinearGradient(0, -26, 0, 28);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.18, PALETTE.cyan);
  g.addColorStop(0.55, "rgba(61,123,255,0.45)");
  g.addColorStop(1, "rgba(61,123,255,0)");
  ctx.save();
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 10;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-3.2, -26, 6.4, 54, 3.2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(-1.4, -25, 2.8, 16, 1.4);
  ctx.fill();
}

function drawOrb(ctx: Ctx, color: string): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, "#ffffff");
  g.addColorStop(0.45, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(ctx: Ctx, color: string): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, color);
  g.addColorStop(0.5, color + "66");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
}

function drawShield(ctx: Ctx): void {
  const r = 44;
  const g = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
  g.addColorStop(0, "rgba(83,230,255,0)");
  g.addColorStop(0.75, "rgba(83,230,255,0.18)");
  g.addColorStop(1, "rgba(160,245,255,0.75)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Hex lattice
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(160,245,255,0.22)";
  ctx.lineWidth = 0.8;
  const s = 9;
  for (let row = -6; row <= 6; row++) {
    for (let col = -6; col <= 6; col++) {
      const x = col * s * 1.5;
      const y = row * s * 1.732 + (col % 2 ? s * 0.866 : 0);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        const px = x + Math.cos(a) * s;
        const py = y + Math.sin(a) * s;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
  glowStroke(ctx, PALETTE.cyan, 10, 1.5);
}

const POWERUP_STYLE: Record<PowerUpKind, { color: string; icon: Path2D | null }> = {
  multiShot: { color: PALETTE.cyan, icon: null },
  shield: { color: PALETTE.teal, icon: null },
  speed: { color: PALETTE.saffron, icon: null },
  life: { color: PALETTE.magenta, icon: null },
};

function drawPowerUp(ctx: Ctx, kind: PowerUpKind): void {
  const { color } = POWERUP_STYLE[kind];
  const icon =
    kind === "multiShot" ? iconToPath2D(MULTI_SHOT_ICON)
    : kind === "shield" ? iconToPath2D(Shield)
    : kind === "speed" ? iconToPath2D(Zap)
    : iconToPath2D(Heart);

  // Outer halo
  drawGlowRing(ctx, color);
  // Hexagonal capsule
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    const px = Math.cos(a) * 21;
    const py = Math.sin(a) * 21;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(6,12,32,0.82)";
  ctx.fill();
  glowStroke(ctx, color, 10, 2.2);

  // Icon (lucide 24×24, stroke 2)
  ctx.save();
  ctx.translate(-11, -11);
  ctx.scale(22 / 24, 22 / 24);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.2;
  ctx.stroke(icon);
  ctx.restore();
}

function drawGlowRing(ctx: Ctx, color: string): void {
  const g = ctx.createRadialGradient(0, 0, 14, 0, 0, 32);
  g.addColorStop(0, color + "55");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();
}

// ───────────────────────────── Registry ─────────────────────────────

export const GLOW_COLORS = [
  "cyan", "lapis", "saffron", "ember", "magenta", "violet", "lime", "teal", "ivory",
] as const;
export type GlowColor = (typeof GLOW_COLORS)[number];

export interface SpriteSet {
  player: Sprite;
  playerFlash: Sprite;
  enemies: Record<EnemyKind | "boss", Sprite>;
  enemyFlash: Record<EnemyKind | "boss", Sprite>;
  playerBolt: Sprite;
  orbs: { ember: Sprite; magenta: Sprite; saffron: Sprite; violet: Sprite };
  glow: Record<GlowColor, Sprite>;
  shield: Sprite;
  powerups: Record<PowerUpKind, Sprite>;
}

export const POWERUP_COLORS: Record<PowerUpKind, string> = {
  multiShot: POWERUP_STYLE.multiShot.color,
  shield: POWERUP_STYLE.shield.color,
  speed: POWERUP_STYLE.speed.color,
  life: POWERUP_STYLE.life.color,
};

export function createSprites(): SpriteSet {
  const player = bake(80, 86, drawPlayer);
  const enemies = {
    fighter: bake(64, 60, drawFighter),
    scout: bake(48, 50, drawScout),
    heavy: bake(112, 100, drawHeavy),
    shooter: bake(72, 72, drawShooter),
    elite: bake(96, 76, drawElite),
    boss: bake(280, 200, drawBoss),
  };
  const enemyFlash = Object.fromEntries(
    Object.entries(enemies).map(([k, s]) => [k, silhouette(s)]),
  ) as SpriteSet["enemyFlash"];
  const glow = Object.fromEntries(
    GLOW_COLORS.map((c) => [c, bake(32, 32, (ctx) => drawGlow(ctx, PALETTE[c]))]),
  ) as SpriteSet["glow"];

  return {
    player,
    playerFlash: silhouette(player, "#bff6ff"),
    enemies,
    enemyFlash,
    playerBolt: bake(14, 58, drawPlayerBolt),
    orbs: {
      ember: bake(26, 26, (ctx) => drawOrb(ctx, PALETTE.ember)),
      magenta: bake(26, 26, (ctx) => drawOrb(ctx, PALETTE.magenta)),
      saffron: bake(26, 26, (ctx) => drawOrb(ctx, PALETTE.saffron)),
      violet: bake(26, 26, (ctx) => drawOrb(ctx, PALETTE.violet)),
    },
    glow,
    shield: bake(92, 92, drawShield),
    powerups: {
      multiShot: bake(64, 64, (ctx) => drawPowerUp(ctx, "multiShot")),
      shield: bake(64, 64, (ctx) => drawPowerUp(ctx, "shield")),
      speed: bake(64, 64, (ctx) => drawPowerUp(ctx, "speed")),
      life: bake(64, 64, (ctx) => drawPowerUp(ctx, "life")),
    },
  };
}

/** Draws a sprite centred at (x, y). */
export function drawSprite(ctx: Ctx, s: Sprite, x: number, y: number, scale = 1): void {
  const w = s.w * scale;
  const h = s.h * scale;
  ctx.drawImage(s.canvas, x - w / 2, y - h / 2, w, h);
}
