import { CONFIG } from "../../config/gameConfig";
import { clamp, damp } from "../core/math";
import type { Input } from "../core/Input";

/**
 * Player ship: smoothed velocity (separate acceleration / deceleration rates), bank
 * angle from lateral velocity, bounds clamping, invulnerability and power-up state.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  bank = 0;
  readonly radius = CONFIG.player.radius;
  readonly hitRadius = CONFIG.player.hitRadius;

  visible = true;
  invulnerable = 0;
  /** 0 → 1 → 2 maps to 1 / 3 / 5 projectiles. */
  multiShot = 0;
  shieldHp = 0;
  /** Seconds since the shield was last hit (drives the flash). */
  shieldHitFlash = 0;
  speedTimer = 0;

  fireCooldown = 0;
  recoil = 0;
  muzzleFlash = 0;
  /** Seconds since the last damage, drives the hurt flash. */
  hurtFlash = 0;
  engineTime = 0;

  reset(worldW: number, worldH: number): void {
    this.x = worldW / 2;
    this.y = worldH - CONFIG.player.spawnYFromBottom;
    this.vx = this.vy = this.bank = 0;
    this.visible = true;
    this.invulnerable = 0;
    this.multiShot = 0;
    this.shieldHp = 0;
    this.speedTimer = 0;
    this.fireCooldown = 0;
    this.recoil = 0;
    this.muzzleFlash = 0;
    this.hurtFlash = 0;
  }

  get speedMultiplier(): number {
    return this.speedTimer > 0 ? CONFIG.powerups.speedMultiplier : 1;
  }

  get maxSpeed(): number {
    return CONFIG.player.maxSpeed * this.speedMultiplier;
  }

  /** Movement from keyboard (axis), mouse (absolute follow) or touch (relative drag). */
  updateMovement(dt: number, input: Input, worldW: number, worldH: number): void {
    const cfg = CONFIG.player;
    let targetVx = 0;
    let targetVy = 0;
    let rate: number = cfg.deceleration;

    const ax = input.axisX;
    const ay = input.axisY;
    const [tdx, tdy] = input.consumeTouchDelta();

    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay);
      targetVx = (ax / len) * this.maxSpeed;
      targetVy = (ay / len) * this.maxSpeed;
      rate = cfg.acceleration;
    } else if (tdx !== 0 || tdy !== 0 || input.touchActive) {
      // Relative drag: move exactly with the finger (1:1 feel), no smoothing lag.
      const s = cfg.touchSensitivity;
      this.x += tdx * s;
      this.y += tdy * s;
      const inst = dt > 0 ? (tdx * s) / dt : 0;
      this.vx += (inst - this.vx) * damp(18, dt);
      this.vy = 0;
      this.clamp(worldW, worldH);
      this.updateBank(dt);
      return;
    } else if (input.mouseHeld) {
      const dx = input.mouseX - this.x;
      const dy = input.mouseY - cfg.pointerOffsetY - this.y;
      const cap = this.maxSpeed * cfg.pointerSpeedFactor;
      targetVx = clamp(dx * cfg.pointerGain, -cap, cap);
      targetVy = clamp(dy * cfg.pointerGain, -cap, cap);
      rate = cfg.acceleration * 1.4;
    }

    const k = damp(rate, dt);
    this.vx += (targetVx - this.vx) * k;
    this.vy += (targetVy - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.clamp(worldW, worldH);
    this.updateBank(dt);
  }

  /** Idle drift used while the ship cannot be controlled (respawn fly-in etc.). */
  coast(dt: number): void {
    const k = damp(CONFIG.player.deceleration, dt);
    this.vx -= this.vx * k;
    this.vy -= this.vy * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.updateBank(dt);
  }

  private updateBank(dt: number): void {
    const target = clamp(this.vx / CONFIG.player.maxSpeed, -1, 1) * CONFIG.player.bankMax;
    this.bank += (target - this.bank) * damp(10, dt);
  }

  private clamp(worldW: number, worldH: number): void {
    const { marginX, marginY } = CONFIG.player;
    const nx = clamp(this.x, marginX, worldW - marginX);
    const ny = clamp(this.y, marginY + 60, worldH - marginY);
    if (nx !== this.x) this.vx = 0;
    if (ny !== this.y) this.vy = 0;
    this.x = nx;
    this.y = ny;
  }

  updateTimers(dt: number): void {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.speedTimer = Math.max(0, this.speedTimer - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 60);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.shieldHitFlash = Math.max(0, this.shieldHitFlash - dt);
    this.engineTime += dt;
  }
}
