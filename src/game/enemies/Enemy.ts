import type { EnemyKind } from "../../config/gameConfig";
import type { GridBody } from "../core/SpatialGrid";

export type EnemyType = EnemyKind | "boss";

export interface Enemy extends GridBody {
  kind: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  score: number;
  speed: number;
  bulletSpeed: number;
  fireInterval: number;
  fireTimer: number;
  dropChance: number;
  /** Age in seconds. */
  t: number;
  /** Hit-flash timer. */
  flash: number;
  /** Behaviour parameters. */
  baseX: number;
  holdY: number;
  dir: number;
  seed: number;
  mode: number;
  modeTimer: number;
  /** Boss: attack pattern state. */
  phase: number;
  attackTimer: number;
  attackIndex: number;
  burstTimer: number;
  burstLeft: number;
  spin: number;
  /** Cannot be damaged (e.g. boss entry). */
  shielded: boolean;
  dead: boolean;
  gridStamp: number;
}

export const makeEnemy = (): Enemy => ({
  kind: "fighter", x: 0, y: 0, vx: 0, vy: 0, radius: 20, hp: 1, maxHp: 1, score: 0,
  speed: 0, bulletSpeed: 0, fireInterval: 0, fireTimer: 0, dropChance: 0, t: 0, flash: 0,
  baseX: 0, holdY: 0, dir: 1, seed: 0, mode: 0, modeTimer: 0, phase: 0, attackTimer: 0,
  attackIndex: 0, burstTimer: 0, burstLeft: 0, spin: 0, shielded: false, dead: false,
  gridStamp: 0,
});
