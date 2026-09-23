import { CONFIG } from "../../config/gameConfig";
import type { Player } from "../player/Player";
import type { Projectiles } from "./Projectiles";

/**
 * Fires the player's energy bolts. Multi-shot level selects the projectile count
 * (1 / 3 / 5) and fan spread; returns true when a volley was fired.
 */
export function tryFire(player: Player, projectiles: Projectiles): boolean {
  if (player.fireCooldown > 0) return false;
  const w = CONFIG.weapon;
  const level = Math.min(player.multiShot, w.counts.length - 1);
  const count = w.counts[level];
  const spread = w.spread[level];
  const noseY = player.y - player.radius - 6 + player.recoil;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    const angle = offset * spread;
    // Outer bolts leave from the wings, centre bolt from the nose.
    const x = player.x + offset * 9;
    const y = noseY + Math.abs(offset) * 10;
    projectiles.firePlayer(x, y, angle, w.bulletSpeed, w.damage);
  }
  player.fireCooldown = w.fireInterval;
  player.recoil = w.recoil;
  player.muzzleFlash = w.muzzleFlashTime;
  return true;
}
