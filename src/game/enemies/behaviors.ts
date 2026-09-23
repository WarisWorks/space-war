import { CONFIG } from "../../config/gameConfig";
import { clamp, damp, easeInOutSine, rand } from "../core/math";
import type { OrbColor } from "../weapons/Projectiles";
import type { Enemy } from "./Enemy";

export interface EnemyContext {
  playerX: number;
  playerY: number;
  width: number;
  height: number;
  /** False during player death / respawn — enemies hold fire. */
  canFire: boolean;
  fire(x: number, y: number, angle: number, speed: number, color?: OrbColor): void;
  /** Called when an enemy starts an attack (for audio). */
  onEnemyShot(kind: Enemy["kind"]): void;
}

const DOWN = Math.PI / 2;

const aim = (e: Enemy, c: EnemyContext): number => Math.atan2(c.playerY - e.y, c.playerX - e.x);

/** Triangle wave in [-1, 1] — sharper zig-zag than a sine. */
const tri = (x: number): number => (2 / Math.PI) * Math.asin(Math.sin(x));

function ready(e: Enemy, c: EnemyContext, dt: number): boolean {
  if (e.fireInterval <= 0) return false;
  e.fireTimer -= dt;
  if (e.fireTimer > 0) return false;
  e.fireTimer = e.fireInterval * rand(0.8, 1.2);
  // Only shoot while clearly on-screen and above the player.
  return c.canFire && e.y > 30 && e.y < c.height * 0.72 && e.y < c.playerY - 60;
}

function spread(
  e: Enemy, c: EnemyContext, center: number, count: number, step: number, speed: number,
  color: OrbColor, oy = 0,
): void {
  for (let i = 0; i < count; i++) {
    c.fire(e.x, e.y + oy, center + (i - (count - 1) / 2) * step, speed, color);
  }
}

function fighter(e: Enemy, dt: number, c: EnemyContext): void {
  e.y += e.speed * dt;
  e.x = e.baseX + Math.sin(e.t * 1.6 + e.seed) * 30;
  if (ready(e, c, dt)) {
    c.fire(e.x, e.y + e.radius * 0.6, DOWN + clamp(aim(e, c) - DOWN, -0.35, 0.35), e.bulletSpeed);
    c.onEnemyShot(e.kind);
  }
}

function scout(e: Enemy, dt: number, _c: EnemyContext): void {
  e.y += e.speed * dt;
  e.x = e.baseX + tri(e.t * 3.2 + e.seed) * 95;
}

/** Ease into a hold line, then drift slowly downward. */
function settle(e: Enemy, dt: number, driftFactor: number): void {
  if (e.y < e.holdY) {
    const k = clamp((e.holdY - e.y) / 180, 0.25, 1);
    e.y = Math.min(e.holdY, e.y + e.speed * 2.2 * k * dt);
  } else {
    e.y += e.speed * driftFactor * dt;
  }
}

function heavy(e: Enemy, dt: number, c: EnemyContext): void {
  settle(e, dt, 0.35);
  e.x = e.baseX + Math.sin(e.t * 0.6 + e.seed) * 40;
  if (ready(e, c, dt)) {
    const a = DOWN + clamp(aim(e, c) - DOWN, -0.5, 0.5);
    spread(e, c, a, 3, 0.22, e.bulletSpeed, "violet", e.radius * 0.5);
    c.onEnemyShot(e.kind);
  }
}

function shooter(e: Enemy, dt: number, c: EnemyContext): void {
  // Keeps its distance: holds a line high on screen and tracks the player laterally.
  if (e.t < 11) {
    settle(e, dt, 0);
    const target = clamp(c.playerX + Math.sin(e.t * 0.9 + e.seed) * 140, 50, c.width - 50);
    e.vx += (clamp((target - e.x) * 2, -e.speed, e.speed) - e.vx) * damp(3, dt);
    e.x += e.vx * dt;
  } else {
    e.y += e.speed * 1.6 * dt; // leave
  }
  if (ready(e, c, dt)) {
    c.fire(e.x, e.y + e.radius * 0.7, aim(e, c), e.bulletSpeed, "ember");
    c.onEnemyShot(e.kind);
  }
}

function elite(e: Enemy, dt: number, c: EnemyContext): void {
  e.modeTimer -= dt;
  if (e.mode === 0) {
    // Enter / hover-strafe
    settle(e, dt, 0);
    e.x += Math.cos(e.t * 1.4 + e.seed) * e.speed * 0.9 * dt;
    e.x = clamp(e.x, 60, c.width - 60);
    if (e.modeTimer <= 0 && e.y >= e.holdY - 2) {
      e.mode = 1;
      e.modeTimer = 0.9;
      e.baseX = e.x;
      e.dir = clamp(c.playerX, 60, c.width - 60);
    }
  } else if (e.mode === 1) {
    // Aggressive swoop toward the player's column, then climb back.
    const p = 1 - e.modeTimer / 0.9;
    e.x = e.baseX + (e.dir - e.baseX) * easeInOutSine(clamp(p, 0, 1));
    e.y = e.holdY + Math.sin(clamp(p, 0, 1) * Math.PI) * c.height * 0.2;
    if (e.modeTimer <= 0) {
      e.mode = 0;
      e.modeTimer = rand(1.4, 2.2);
    }
  }
  if (ready(e, c, dt)) {
    e.attackIndex++;
    if (e.attackIndex % 2 === 0) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        c.fire(e.x, e.y, (i / n) * Math.PI * 2 + e.t, e.bulletSpeed * 0.8, "magenta");
      }
    } else {
      spread(e, c, aim(e, c), 3, 0.16, e.bulletSpeed * 1.15, "magenta");
    }
    c.onEnemyShot(e.kind);
  }
}

// ───────────────────────────── Boss ─────────────────────────────

function bossAttack(e: Enemy, c: EnemyContext): void {
  const speed = e.bulletSpeed;
  e.attackIndex++;
  const pattern = e.phase === 0 ? e.attackIndex % 2 : e.phase === 1 ? e.attackIndex % 3 : e.attackIndex % 4;
  switch (pattern) {
    case 0: // Fan from the core
      spread(e, c, DOWN, e.phase === 0 ? 7 : 9, 0.17, speed, "saffron", 30);
      break;
    case 1: // Aimed side-cannon pairs
      for (const s of [-1, 1]) {
        const x = e.x + s * 90;
        const y = e.y + 66;
        const a = Math.atan2(c.playerY - y, c.playerX - x);
        for (let i = 0; i < 3; i++) c.fire(x, y, a + (i - 1) * 0.08, speed * 1.2, "ember");
      }
      break;
    case 2: // Spiral burst (continues over several frames)
      e.burstLeft = e.phase === 2 ? 26 : 18;
      e.burstTimer = 0;
      break;
    case 3: // Full ring
      for (let i = 0; i < 20; i++) c.fire(e.x, e.y + 10, (i / 20) * Math.PI * 2 + e.t, speed * 0.85, "magenta");
      break;
  }
}

function boss(e: Enemy, dt: number, c: EnemyContext): void {
  const b = CONFIG.boss;
  if (e.shielded) {
    // Dramatic entry
    e.y += (b.entryY - e.y) * damp(1.4, dt);
    if (Math.abs(e.y - b.entryY) < 4) {
      e.shielded = false;
      e.t = 0;
      e.attackTimer = 1;
    }
    return;
  }
  const hpFrac = e.hp / e.maxHp;
  e.phase = hpFrac > b.phaseThresholds[0] ? 0 : hpFrac > b.phaseThresholds[1] ? 1 : 2;
  const sway = c.width * 0.3;
  const tx = c.width / 2 + Math.sin(e.t * (0.45 + e.phase * 0.12)) * sway;
  const ty = b.entryY + Math.sin(e.t * 0.9) * 26 + (e.phase === 2 ? Math.sin(e.t * 2.1) * 20 : 0);
  e.x += (tx - e.x) * damp(2, dt);
  e.y += (ty - e.y) * damp(2, dt);

  if (e.burstLeft > 0) {
    e.burstTimer -= dt;
    if (e.burstTimer <= 0 && c.canFire) {
      e.burstTimer = 0.07;
      e.burstLeft--;
      e.spin += 0.38;
      for (let k = 0; k < 3; k++) {
        c.fire(e.x, e.y + 10, e.spin + (k * Math.PI * 2) / 3, e.bulletSpeed * 0.9, "violet");
      }
    }
  }

  e.attackTimer -= dt;
  if (e.attackTimer <= 0) {
    e.attackTimer = b.attackInterval[e.phase];
    if (c.canFire) {
      bossAttack(e, c);
      c.onEnemyShot("boss");
    }
  }
}

export const BEHAVIORS: Record<Enemy["kind"], (e: Enemy, dt: number, c: EnemyContext) => void> = {
  fighter, scout, heavy, shooter, elite, boss,
};
