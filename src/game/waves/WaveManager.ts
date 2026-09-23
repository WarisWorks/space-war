import { CONFIG, type EnemyKind } from "../../config/gameConfig";
import { isBossWave } from "./difficulty";

export type Formation = "line" | "v" | "column" | "pincer" | "swarm" | "single";

export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  formation: Formation;
}

export interface WavePlan {
  wave: number;
  boss: boolean;
  groups: SpawnGroup[];
  /** Seconds between spawn groups. */
  groupInterval: number;
}

export interface Slot {
  x: number;
  /** Extra distance above the top edge — staggers entry without timers. */
  yOffset: number;
}

type Rng = () => number;

const FORMATIONS: Record<EnemyKind, readonly Formation[]> = {
  fighter: ["line", "v", "v", "pincer"],
  scout: ["column", "swarm", "pincer"],
  heavy: ["single", "line"],
  shooter: ["line", "pincer"],
  elite: ["single", "line"],
};

const GROUP_SIZE: Record<EnemyKind, [number, number]> = {
  fighter: [3, 6],
  scout: [3, 5],
  heavy: [1, 2],
  shooter: [2, 3],
  elite: [1, 2],
};

const pick = <T>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

export function unlockedKinds(wave: number): EnemyKind[] {
  return (Object.keys(CONFIG.enemies) as EnemyKind[]).filter(
    (k) => CONFIG.enemies[k].unlockWave <= wave,
  );
}

export function waveBudget(wave: number): number {
  const d = CONFIG.difficulty;
  return d.budgetBase + d.budgetPerWave * (wave - 1);
}

/**
 * Procedurally composes a wave from a point budget. Types unlock progressively; a
 * newly unlocked type is guaranteed to appear in its debut wave.
 */
export function planWave(wave: number, rng: Rng = Math.random): WavePlan {
  const d = CONFIG.difficulty;
  const groupInterval = Math.max(
    d.groupIntervalMin,
    d.groupIntervalBase - d.groupIntervalPerWave * (wave - 1),
  );
  if (isBossWave(wave)) return { wave, boss: true, groups: [], groupInterval };

  const kinds = unlockedKinds(wave);
  const groups: SpawnGroup[] = [];
  let budget = waveBudget(wave);

  const debut = kinds.find((k) => CONFIG.enemies[k].unlockWave === wave && wave > 1);
  const addGroup = (kind: EnemyKind): void => {
    const cost = CONFIG.enemies[kind].cost;
    const [lo, hi] = GROUP_SIZE[kind];
    const wanted = lo + Math.floor(rng() * (hi - lo + 1 + Math.floor(wave / 6)));
    const count = Math.max(1, Math.min(wanted, d.maxGroupSize, Math.floor(budget / cost)));
    const formation = count === 1 ? "single" : pick(FORMATIONS[kind], rng);
    groups.push({ kind, count, formation: formation === "single" && count > 1 ? "line" : formation });
    budget -= count * cost;
  };

  // Warm-up group of basic fighters, then the debuting type.
  addGroup("fighter");
  if (debut && budget >= CONFIG.enemies[debut].cost) addGroup(debut);

  let guard = 0;
  while (budget >= 1 && guard++ < 64) {
    const affordable = kinds.filter((k) => CONFIG.enemies[k].cost <= budget);
    if (!affordable.length) break;
    let total = 0;
    for (const k of affordable) total += CONFIG.enemies[k].weight;
    let r = rng() * total;
    let kind = affordable[0];
    for (const k of affordable) {
      r -= CONFIG.enemies[k].weight;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    addGroup(kind);
  }
  return { wave, boss: false, groups, groupInterval };
}

/** Spawn slots for a formation across a world of `width`. */
export function formationSlots(formation: Formation, count: number, width: number, rng: Rng = Math.random): Slot[] {
  const margin = 70;
  const usable = width - margin * 2;
  const slots: Slot[] = [];
  const center = margin + usable * (0.3 + rng() * 0.4);
  switch (formation) {
    case "single":
    case "line": {
      const spacing = Math.min(110, usable / Math.max(1, count));
      const start = Math.min(Math.max(center - (spacing * (count - 1)) / 2, margin), width - margin - spacing * (count - 1));
      for (let i = 0; i < count; i++) slots.push({ x: start + spacing * i, yOffset: 0 });
      break;
    }
    case "v": {
      const spacing = Math.min(80, usable / Math.max(1, count));
      const mid = (count - 1) / 2;
      const start = Math.min(Math.max(center - spacing * mid, margin), width - margin - spacing * (count - 1));
      for (let i = 0; i < count; i++) {
        slots.push({ x: start + spacing * i, yOffset: Math.abs(i - mid) * 55 });
      }
      break;
    }
    case "column":
      for (let i = 0; i < count; i++) slots.push({ x: center, yOffset: i * 70 });
      break;
    case "pincer":
      for (let i = 0; i < count; i++) {
        const left = i % 2 === 0;
        slots.push({ x: left ? margin + 30 : width - margin - 30, yOffset: Math.floor(i / 2) * 80 });
      }
      break;
    case "swarm":
      for (let i = 0; i < count; i++) {
        slots.push({ x: margin + rng() * usable, yOffset: rng() * 220 });
      }
      break;
  }
  return slots;
}

/** Runtime scheduler that releases a plan's groups over time. */
export class WaveManager {
  plan: WavePlan = { wave: 0, boss: false, groups: [], groupInterval: 1 };
  private index = 0;
  private timer = 0;

  start(wave: number): WavePlan {
    this.plan = planWave(wave);
    this.index = 0;
    this.timer = 0.4;
    return this.plan;
  }

  get wave(): number {
    return this.plan.wave;
  }

  get doneSpawning(): boolean {
    return this.index >= this.plan.groups.length;
  }

  update(dt: number, spawn: (group: SpawnGroup) => void, aliveCount: number): void {
    if (this.doneSpawning) return;
    this.timer -= dt;
    // Release the next group early when the screen has been cleared.
    if (this.timer <= 0 || (aliveCount === 0 && this.timer > 0.35)) {
      spawn(this.plan.groups[this.index++]);
      this.timer = this.plan.groupInterval;
    }
  }
}
