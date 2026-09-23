import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/config/gameConfig";
import { ScoreSystem } from "../src/game/scoring/ScoreSystem";
import { difficultyFor, isBossWave } from "../src/game/waves/difficulty";
import { formationSlots, planWave, unlockedKinds, waveBudget } from "../src/game/waves/WaveManager";
import { StateMachine, GameState } from "../src/game/core/StateMachine";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("waves", () => {
  it("wave 1 only contains basic fighters", () => {
    const plan = planWave(1, seeded(1));
    expect(plan.groups.length).toBeGreaterThan(0);
    expect(plan.groups.every((g) => g.kind === "fighter")).toBe(true);
  });

  it("spends roughly the wave budget and never exceeds it", () => {
    for (let w = 1; w <= 30; w++) {
      if (isBossWave(w)) continue;
      const plan = planWave(w, seeded(w));
      const spent = plan.groups.reduce((s, g) => s + g.count * CONFIG.enemies[g.kind].cost, 0);
      expect(spent).toBeLessThanOrEqual(Math.ceil(waveBudget(w)));
      expect(spent).toBeGreaterThanOrEqual(waveBudget(w) - 1);
    }
  });

  it("introduces each type in its unlock wave", () => {
    for (const kind of unlockedKinds(10)) {
      const w = CONFIG.enemies[kind].unlockWave;
      if (w === 1 || isBossWave(w)) continue;
      expect(planWave(w, seeded(7)).groups.some((g) => g.kind === kind), kind).toBe(true);
    }
  });

  it("boss appears every 5 waves", () => {
    expect(planWave(5).boss).toBe(true);
    expect(planWave(10).boss).toBe(true);
    expect(planWave(6).boss).toBe(false);
  });

  it("difficulty grows monotonically and is capped", () => {
    let prev = difficultyFor(1);
    for (let w = 2; w <= 200; w++) {
      const d = difficultyFor(w);
      expect(d.hp).toBeGreaterThanOrEqual(prev.hp);
      expect(d.speed).toBeGreaterThanOrEqual(prev.speed);
      prev = d;
    }
    expect(prev.hp).toBe(CONFIG.difficulty.hpCap);
  });

  it("formation slots stay inside the world", () => {
    for (const f of ["line", "v", "column", "pincer", "swarm", "single"] as const) {
      for (const slot of formationSlots(f, 7, 720, seeded(3))) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(720);
      }
    }
  });
});

describe("ScoreSystem", () => {
  it("applies combo multiplier and resets on hit / timeout", () => {
    const s = new ScoreSystem();
    for (let i = 0; i < 5; i++) s.registerKill(100);
    expect(s.score).toBe(500);
    expect(s.multiplier).toBe(1.5);
    expect(s.registerKill(100).points).toBe(150);
    s.registerHit();
    expect(s.multiplier).toBe(1);
    s.registerKill(100);
    s.update(CONFIG.scoring.comboWindow + 0.1);
    expect(s.combo).toBe(0);
  });

  it("awards wave clear + perfect bonuses", () => {
    const s = new ScoreSystem();
    s.startWave();
    const [clear, perfect] = s.completeWave(3);
    expect(clear).toBe(CONFIG.waves.clearBonusPerWave * 3);
    expect(perfect).toBe(CONFIG.waves.perfectBonusPerWave * 3);
    s.startWave();
    s.registerHit();
    expect(s.completeWave(4)[1]).toBe(0);
  });
});

describe("StateMachine", () => {
  it("enforces legal transitions and remembers the paused state", () => {
    const sm = new StateMachine();
    expect(sm.transition(GameState.PLAYING)).toBe(false);
    sm.transition(GameState.MAIN_MENU);
    sm.transition(GameState.WAVE_TRANSITION);
    sm.transition(GameState.PLAYING);
    expect(sm.simulating).toBe(true);
    sm.transition(GameState.PAUSED);
    expect(sm.simulating).toBe(false);
    expect(sm.resumeTo).toBe(GameState.PLAYING);
  });
});
