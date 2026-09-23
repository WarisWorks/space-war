/**
 * Central balancing & tuning values. Nothing gameplay-related should be hard-coded
 * elsewhere — tweak here. Units: world units (≈ px at 1× scale), seconds.
 */

export type EnemyKind = "fighter" | "scout" | "heavy" | "shooter" | "elite";
export type PowerUpKind = "multiShot" | "shield" | "speed" | "life";

export interface EnemyStats {
  hp: number;
  speed: number;
  radius: number;
  score: number;
  /** Seconds between shots (0 = never fires). */
  fireInterval: number;
  bulletSpeed: number;
  /** Relative cost in the wave point budget. */
  cost: number;
  /** First wave in which this type can appear. */
  unlockWave: number;
  /** Relative spawn weight once unlocked. */
  weight: number;
  /** Probability of dropping a power-up on death. */
  dropChance: number;
}

export const CONFIG = {
  world: {
    minWidth: 720,
    maxWidth: 900,
    minHeight: 1000,
    maxHeight: 1400,
    /** Aspect ratio (w/h) above which the world uses minHeight and grows wider. */
    wideAspect: 0.72,
    /** Maximum simulation step, avoids tunnelling after tab switches. */
    maxDt: 1 / 30,
  },

  player: {
    lives: 3,
    maxLives: 5,
    radius: 22,
    /** Collision radius is smaller than the sprite for fair near-misses. */
    hitRadius: 11,
    maxSpeed: 560,
    /** Exponential smoothing rates (1/s). Higher = snappier. */
    acceleration: 14,
    deceleration: 9,
    /** Pointer/touch follow gain and speed cap multiplier. */
    pointerGain: 12,
    pointerSpeedFactor: 1.6,
    /** Touch drag sensitivity (relative drag). */
    touchSensitivity: 1.25,
    /** Pointer target sits this far above the mouse so the cursor never hides the ship. */
    pointerOffsetY: 0,
    bankMax: 0.42,
    invulnerableTime: 2.4,
    deathTime: 1.3,
    respawnTime: 1.1,
    spawnYFromBottom: 150,
    marginX: 28,
    marginY: 40,
  },

  weapon: {
    fireInterval: 0.13,
    damage: 1,
    bulletSpeed: 1350,
    bulletRadius: 6,
    /** Fan spread between projectiles (radians) per multi-shot level. */
    spread: [0, 0.14, 0.12],
    /** Projectile counts per multi-shot level. */
    counts: [1, 3, 5],
    recoil: 5,
    muzzleFlashTime: 0.06,
  },

  enemies: {
    fighter: {
      hp: 2, speed: 150, radius: 24, score: 100, fireInterval: 2.8, bulletSpeed: 300,
      cost: 1, unlockWave: 1, weight: 10, dropChance: 0.05,
    },
    scout: {
      hp: 1, speed: 300, radius: 18, score: 150, fireInterval: 0, bulletSpeed: 0,
      cost: 1, unlockWave: 2, weight: 7, dropChance: 0.06,
    },
    heavy: {
      hp: 12, speed: 65, radius: 42, score: 300, fireInterval: 2.2, bulletSpeed: 260,
      cost: 4, unlockWave: 4, weight: 4, dropChance: 0.3,
    },
    shooter: {
      hp: 4, speed: 140, radius: 26, score: 200, fireInterval: 1.6, bulletSpeed: 360,
      cost: 2, unlockWave: 3, weight: 6, dropChance: 0.12,
    },
    elite: {
      hp: 16, speed: 210, radius: 34, score: 500, fireInterval: 1.3, bulletSpeed: 330,
      cost: 6, unlockWave: 6, weight: 3, dropChance: 0.45,
    },
  } satisfies Record<EnemyKind, EnemyStats>,

  enemyBullet: { radius: 7 },

  boss: {
    everyNWaves: 5,
    baseHp: 260,
    hpPerAppearance: 180,
    radius: 90,
    score: 2000,
    speed: 110,
    bulletSpeed: 280,
    entryY: 200,
    /** HP fractions at which the boss enters phase 2 and 3. */
    phaseThresholds: [0.66, 0.33],
    /** Seconds between attack volleys, per phase. */
    attackInterval: [1.35, 1.05, 0.8],
    /** Enemy bullets on screen when boss dies are converted to score. */
    bulletClearScore: 10,
  },

  difficulty: {
    /** Per-wave multiplicative growth, capped. */
    hpGrowth: 0.09,
    hpCap: 4,
    speedGrowth: 0.03,
    speedCap: 1.6,
    bulletSpeedGrowth: 0.035,
    bulletSpeedCap: 1.7,
    fireRateGrowth: 0.05,
    fireRateCap: 2.2,
    /** Wave point budget = base + perWave * (wave-1). */
    budgetBase: 8,
    budgetPerWave: 3.2,
    /** Seconds between spawn groups: max(min, base - perWave*(wave-1)). */
    groupIntervalBase: 2.6,
    groupIntervalPerWave: 0.12,
    groupIntervalMin: 0.9,
    maxGroupSize: 7,
  },

  waves: {
    bannerTime: 2.2,
    completeTime: 1.8,
    clearBonusPerWave: 250,
    perfectBonusPerWave: 400,
  },

  scoring: {
    comboWindow: 2.2,
    /** Every `killsPerStep` chained kills adds `stepMultiplier` to the multiplier. */
    killsPerStep: 5,
    stepMultiplier: 0.5,
    maxMultiplier: 4,
    /** Kills without taking damage between "kill streak" call-outs. */
    streakMilestone: 25,
  },

  powerups: {
    radius: 22,
    fallSpeed: 85,
    swayAmplitude: 22,
    lifetime: 14,
    /** Relative weights when a drop happens. */
    weights: { multiShot: 4, shield: 3, speed: 3, life: 0.6 } satisfies Record<PowerUpKind, number>,
    shieldHits: 3,
    shieldRadius: 42,
    speedDuration: 8,
    speedMultiplier: 1.55,
    /** Pickup always guaranteed from bosses. */
    bossDrops: 3,
    /** Score when collecting a power-up that is already maxed. */
    maxedScore: 250,
  },

  effects: {
    maxParticles: 2400,
    maxFloatingTexts: 48,
    shakeDecay: 1.8,
    maxShake: 18,
  },

  stars: {
    layers: [
      { count: 110, speed: 22, size: [0.6, 1.3], alpha: [0.25, 0.55] },
      { count: 60, speed: 60, size: [1.0, 2.0], alpha: [0.45, 0.8] },
      { count: 22, speed: 150, size: [1.6, 2.8], alpha: [0.7, 1] },
    ],
    shootingStarChance: 0.22,
  },

  audio: {
    defaultMusicVolume: 0.55,
    defaultSfxVolume: 0.75,
  },

  leaderboard: {
    size: 10,
    maxNameLength: 14,
  },

  storageKeys: {
    settings: "alem-jengchisi.settings.v1",
    leaderboard: "alem-jengchisi.leaderboard.v1",
    lastName: "alem-jengchisi.lastName.v1",
  },
} as const;

export type GameConfig = typeof CONFIG;
