import { CONFIG } from "../../config/gameConfig";
import { Pool } from "../core/Pool";

export type OrbColor = "ember" | "magenta" | "saffron" | "violet";

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  /** Visual rotation for player bolts (radians from straight up). */
  angle: number;
  color: OrbColor;
  /** Seconds alive — used for spawn-in scale and homing-free lifetime cap. */
  age: number;
}

const make = (): Projectile => ({
  x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 1, angle: 0, color: "ember", age: 0,
});

/** Player and enemy projectile pools with shared off-screen culling. */
export class Projectiles {
  readonly player = new Pool<Projectile>(make, 400, 120);
  readonly enemy = new Pool<Projectile>(make, 700, 200);

  firePlayer(x: number, y: number, angle: number, speed: number, damage: number): void {
    const p = this.player.acquire();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = Math.sin(angle) * speed;
    p.vy = -Math.cos(angle) * speed;
    p.angle = angle;
    p.radius = CONFIG.weapon.bulletRadius;
    p.damage = damage;
    p.age = 0;
  }

  fireEnemy(x: number, y: number, angle: number, speed: number, color: OrbColor = "ember"): void {
    const p = this.enemy.acquire();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.radius = CONFIG.enemyBullet.radius;
    p.damage = 1;
    p.color = color;
    p.age = 0;
  }

  update(dt: number, width: number, height: number): void {
    step(this.player, dt, width, height);
    step(this.enemy, dt, width, height);
  }

  clearEnemy(): void {
    this.enemy.clear();
  }

  clear(): void {
    this.player.clear();
    this.enemy.clear();
  }
}

function step(pool: Pool<Projectile>, dt: number, w: number, h: number): void {
  const items = pool.items;
  const m = 60;
  for (let i = pool.count - 1; i >= 0; i--) {
    const p = items[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += dt;
    if (p.x < -m || p.x > w + m || p.y < -m || p.y > h + m) pool.releaseAt(i);
  }
}
