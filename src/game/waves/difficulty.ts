import { CONFIG } from "../../config/gameConfig";

export interface Difficulty {
  hp: number;
  speed: number;
  bulletSpeed: number;
  /** Fire-rate multiplier (intervals are divided by this). */
  fireRate: number;
}

/** Pure per-wave scaling, capped so late waves stay readable. */
export function difficultyFor(wave: number): Difficulty {
  const d = CONFIG.difficulty;
  const n = Math.max(0, wave - 1);
  return {
    hp: Math.min(d.hpCap, 1 + d.hpGrowth * n),
    speed: Math.min(d.speedCap, 1 + d.speedGrowth * n),
    bulletSpeed: Math.min(d.bulletSpeedCap, 1 + d.bulletSpeedGrowth * n),
    fireRate: Math.min(d.fireRateCap, 1 + d.fireRateGrowth * n),
  };
}

export const isBossWave = (wave: number): boolean =>
  wave > 0 && wave % CONFIG.boss.everyNWaves === 0;

export const bossHpFor = (wave: number): number =>
  CONFIG.boss.baseHp + CONFIG.boss.hpPerAppearance * (Math.floor(wave / CONFIG.boss.everyNWaves) - 1);
