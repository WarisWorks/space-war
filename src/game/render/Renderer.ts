import { CONFIG } from "../../config/gameConfig";
import type { Game } from "../core/Game";
import { GameState } from "../core/StateMachine";
import { TAU } from "../core/math";
import { drawSprite } from "./Sprites";

/**
 * Draws one frame: screen-space starfield → world-space entities (clipped to the
 * playfield, with screen shake) → screen-space overlays.
 */
export class Renderer {
  private vignette: HTMLCanvasElement | null = null;
  private vignetteKey = "";

  constructor(private readonly game: Game) {}

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const vp = g.viewport;
    const dpr = vp.dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    g.starfield.render(ctx);

    // Dim letterbox areas and outline the playfield on wide screens.
    this.drawFrame(ctx);

    // World transform (+ shake)
    const s = vp.scale;
    ctx.setTransform(
      dpr * s, 0, 0, dpr * s,
      dpr * (vp.offsetX + g.shake.x * s), dpr * (vp.offsetY + g.shake.y * s),
    );
    if (g.shake.angle) {
      ctx.translate(vp.width / 2, vp.height / 2);
      ctx.rotate(g.shake.angle);
      ctx.translate(-vp.width / 2, -vp.height / 2);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, -20, vp.width + 40, vp.height + 40);
    ctx.clip();

    const state = g.state;
    if (state === GameState.MAIN_MENU || state === GameState.LOADING) {
      this.drawMenuShip(ctx);
    } else {
      this.drawPowerUps(ctx);
      this.drawEnemies(ctx);
      this.drawProjectiles(ctx);
      this.drawPlayer(ctx);
    }
    g.particles.render(ctx);
    g.floating.render(ctx);
    ctx.restore();

    // Screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawVignette(ctx);
    if (g.damageFlash > 0) {
      ctx.globalAlpha = g.damageFlash * 0.35;
      ctx.fillStyle = "#ff2a3c";
      ctx.fillRect(0, 0, vp.screenW, vp.screenH);
      ctx.globalAlpha = 1;
    }
  }

  private drawFrame(ctx: CanvasRenderingContext2D): void {
    const vp = this.game.viewport;
    const x0 = vp.offsetX;
    const x1 = vp.offsetX + vp.width * vp.scale;
    if (x0 < 4) return;
    ctx.fillStyle = "rgba(2,3,10,0.55)";
    ctx.fillRect(0, 0, x0, vp.screenH);
    ctx.fillRect(x1, 0, vp.screenW - x1, vp.screenH);
    for (const x of [x0, x1]) {
      const g = ctx.createLinearGradient(0, 0, 0, vp.screenH);
      g.addColorStop(0, "rgba(61,123,255,0)");
      g.addColorStop(0.5, "rgba(83,230,255,0.35)");
      g.addColorStop(1, "rgba(61,123,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 1, 0, 2, vp.screenH);
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    const vp = this.game.viewport;
    const lowLife = this.game.lives === 1 && this.game.sm.simulating;
    const key = `${vp.screenW}x${vp.screenH}`;
    if (key !== this.vignetteKey) {
      this.vignetteKey = key;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(vp.screenW / 4));
      c.height = Math.max(1, Math.ceil(vp.screenH / 4));
      const v = c.getContext("2d")!;
      const r = Math.hypot(c.width, c.height) / 2;
      const g = v.createRadialGradient(c.width / 2, c.height / 2, r * 0.55, c.width / 2, c.height / 2, r);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      v.fillStyle = g;
      v.fillRect(0, 0, c.width, c.height);
      this.vignette = c;
    }
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, vp.screenW, vp.screenH);
    if (lowLife) {
      // Pulsing red edge when on the last life.
      const pulse = 0.12 + 0.08 * Math.sin(this.game.time * 4);
      ctx.globalAlpha = pulse;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(
        vp.screenW / 2, vp.screenH / 2, Math.min(vp.screenW, vp.screenH) * 0.35,
        vp.screenW / 2, vp.screenH / 2, Math.hypot(vp.screenW, vp.screenH) / 2,
      );
      g.addColorStop(0, "rgba(255,40,60,0)");
      g.addColorStop(1, "rgba(255,40,60,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vp.screenW, vp.screenH);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }

  private drawEngines(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, boosted: boolean, time: number): void {
    const glow = this.game.sprites.glow;
    ctx.globalCompositeOperation = "lighter";
    const flicker = 0.85 + 0.15 * Math.sin(time * 50) + 0.1 * Math.random();
    const len = (boosted ? 46 : 28) * flicker * scale;
    for (const side of [-6, 6]) {
      const ex = x + side * scale;
      const ey = y + 30 * scale;
      ctx.globalAlpha = 0.9;
      const outer = boosted ? glow.saffron.canvas : glow.cyan.canvas;
      ctx.drawImage(outer, ex - 9 * scale, ey - 4 * scale, 18 * scale, len);
      ctx.globalAlpha = 1;
      ctx.drawImage(glow.ivory.canvas, ex - 4 * scale, ey - 3 * scale, 8 * scale, len * 0.45);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawMenuShip(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const vp = g.viewport;
    const t = g.time;
    // Slow figure-eight so the ship drifts in and out from behind the menu glass.
    const x = vp.width / 2 + Math.sin(t * 0.23) * vp.width * 0.36;
    const y = vp.height * 0.56 + Math.sin(t * 0.46) * vp.height * 0.3;
    const bank = Math.cos(t * 0.23) * 0.35;
    this.drawShip(ctx, x, y, bank, 1.25, 1, false);
  }

  private drawShip(
    ctx: CanvasRenderingContext2D, x: number, y: number, bank: number, scale: number,
    alpha: number, boosted: boolean,
  ): void {
    const g = this.game;
    this.drawEngines(ctx, x, y, scale, boosted, g.time);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(bank * 0.35);
    // Fake 3D bank: narrow the ship horizontally as it rolls.
    ctx.scale(Math.cos(bank) * scale, scale);
    drawSprite(ctx, g.sprites.player, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const p = g.player;
    if (!p.visible) return;
    const y = p.y + p.recoil;
    const inv = p.invulnerable > 0;
    // Invulnerability: rapid blink + energy outline so it's obvious the ship can't be hit.
    const blink = inv ? (Math.sin(g.time * 30) > 0 ? 0.35 : 1) : 1;
    this.drawShip(ctx, p.x, y, p.bank, 1, blink, p.speedTimer > 0);

    if (inv && p.hurtFlash <= 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(g.time * 12);
      ctx.translate(p.x, y);
      ctx.scale(Math.cos(p.bank) * 1.08, 1.08);
      drawSprite(ctx, g.sprites.playerFlash, 0, 0);
      ctx.restore();
      // Rotating energy ring
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(83,230,255,0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = -g.time * 60;
      ctx.beginPath();
      ctx.arc(p.x, y, 38, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // Muzzle flash
    if (p.muzzleFlash > 0) {
      const k = p.muzzleFlash / CONFIG.weapon.muzzleFlashTime;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = k;
      const glow = g.sprites.glow;
      drawSprite(ctx, glow.cyan, p.x, y - 40, 1.6 + k);
      drawSprite(ctx, glow.ivory, p.x, y - 38, 0.8 + k * 0.5);
      if (p.multiShot > 0) {
        drawSprite(ctx, glow.cyan, p.x - 14, y - 26, 1.1 * k + 0.4);
        drawSprite(ctx, glow.cyan, p.x + 14, y - 26, 1.1 * k + 0.4);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // Shield bubble: fades and flickers as it weakens.
    if (p.shieldHp > 0) {
      const strength = p.shieldHp / CONFIG.powerups.shieldHits;
      const flicker = strength < 0.4 ? (Math.random() < 0.15 ? 0.3 : 1) : 1;
      const hit = p.shieldHitFlash > 0 ? p.shieldHitFlash / 0.3 : 0;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.35 + 0.55 * strength) * flicker + hit * 0.6;
      const pulse = 1 + Math.sin(g.time * 5) * 0.03 + hit * 0.12;
      drawSprite(ctx, g.sprites.shield, p.x, y, pulse);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const items = g.enemies.items;
    const { enemies: sprites, enemyFlash, glow } = g.sprites;
    for (let i = 0; i < g.enemies.count; i++) {
      const e = items[i];
      const sprite = sprites[e.kind];
      // Slight tilt from lateral motion keeps enemies feeling alive.
      const tilt = e.kind === "scout" ? Math.cos(e.t * 3.2 + e.seed) * 0.35 : 0;
      if (e.kind === "boss") {
        // Pulsing reactor core behind the hull
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(g.time * (4 + e.phase * 2));
        drawSprite(ctx, glow.ember, e.x, e.y + 4, 6 + e.phase);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      if (tilt) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(tilt);
        drawSprite(ctx, sprite, 0, 0);
        ctx.restore();
      } else {
        drawSprite(ctx, sprite, e.x, e.y);
      }
      if (e.flash > 0 || e.shielded) {
        ctx.globalAlpha = e.shielded ? 0.15 + 0.1 * Math.sin(g.time * 10) : Math.min(1, e.flash / 0.07) * 0.85;
        drawSprite(ctx, enemyFlash[e.kind], e.x, e.y);
        ctx.globalAlpha = 1;
      }
      // Small health bar for tougher non-boss enemies once damaged.
      if (e.kind !== "boss" && e.maxHp >= 6 && e.hp < e.maxHp) {
        const w = e.radius * 1.4;
        const y = e.y - e.radius - 12;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - w / 2, y, w, 4);
        ctx.fillStyle = e.kind === "elite" ? "#ff3fa4" : "#b394ff";
        ctx.fillRect(e.x - w / 2, y, (w * Math.max(0, e.hp)) / e.maxHp, 4);
      }
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const { playerBolt, orbs } = g.sprites;
    ctx.globalCompositeOperation = "lighter";

    const bolts = g.projectiles.player;
    for (let i = 0; i < bolts.count; i++) {
      const b = bolts.items[i];
      const grow = Math.min(1, b.age * 25 + 0.4);
      if (b.angle === 0) {
        ctx.drawImage(playerBolt.canvas, b.x - playerBolt.w / 2, b.y - 8, playerBolt.w, playerBolt.h * grow);
      } else {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.drawImage(playerBolt.canvas, -playerBolt.w / 2, -8, playerBolt.w, playerBolt.h * grow);
        ctx.restore();
      }
    }

    const shots = g.projectiles.enemy;
    const pulse = 1 + 0.12 * Math.sin(g.time * 20);
    for (let i = 0; i < shots.count; i++) {
      const b = shots.items[i];
      const s = orbs[b.color];
      const size = s.w * pulse * Math.min(1, 0.5 + b.age * 6);
      ctx.drawImage(s.canvas, b.x - size / 2, b.y - size / 2, size, size);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private drawPowerUps(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const pool = g.powerups.pool;
    for (let i = 0; i < pool.count; i++) {
      const u = pool.items[i];
      const remaining = CONFIG.powerups.lifetime - u.t;
      // Blink before expiring
      if (remaining < 3 && Math.sin(u.t * 18) < 0) continue;
      const scale = 1 + Math.sin(u.t * 4) * 0.06;
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(Math.sin(u.t * 1.5) * 0.12);
      drawSprite(ctx, g.sprites.powerups[u.kind], 0, 0, scale);
      ctx.restore();
    }
  }
}
