import { CONFIG } from "../../config/gameConfig";

export interface KillResult {
  points: number;
  multiplier: number;
  combo: number;
}

/**
 * Score, combo multiplier (kills chained within a time window), kill streak and
 * wave bonuses. Pure logic — no rendering — so it is unit-tested directly.
 */
export class ScoreSystem {
  score = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  kills = 0;
  /** Kills since the last hit taken. */
  streak = 0;
  hitThisWave = false;

  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.kills = 0;
    this.streak = 0;
    this.hitThisWave = false;
  }

  get multiplier(): number {
    const s = CONFIG.scoring;
    return Math.min(s.maxMultiplier, 1 + Math.floor(this.combo / s.killsPerStep) * s.stepMultiplier);
  }

  /** The multiplier shown in the HUD applies to the *next* kill. */
  registerKill(baseScore: number): KillResult {
    const multiplier = this.multiplier;
    this.combo++;
    this.kills++;
    this.streak++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = CONFIG.scoring.comboWindow;
    const points = Math.round(baseScore * multiplier);
    this.score += points;
    return { points, multiplier, combo: this.combo };
  }

  add(points: number): void {
    this.score += Math.round(points);
  }

  /** Taking damage breaks the combo and the streak. */
  registerHit(): void {
    this.combo = 0;
    this.comboTimer = 0;
    this.streak = 0;
    this.hitThisWave = true;
  }

  startWave(): void {
    this.hitThisWave = false;
  }

  /** Returns [clearBonus, perfectBonus] and adds them to the score. */
  completeWave(wave: number): [number, number] {
    const clear = CONFIG.waves.clearBonusPerWave * wave;
    const perfect = this.hitThisWave ? 0 : CONFIG.waves.perfectBonusPerWave * wave;
    this.score += clear + perfect;
    return [clear, perfect];
  }

  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.combo = 0;
      }
    }
  }
}
