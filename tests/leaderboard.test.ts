import { describe, expect, it } from "vitest";
import { Leaderboard, MemoryStorage, sanitizeName } from "../src/game/scoring/Leaderboard";

describe("Leaderboard", () => {
  it("keeps the top 10 sorted and persists", () => {
    const storage = new MemoryStorage();
    const lb = new Leaderboard(storage, "k", 10);
    for (let i = 1; i <= 12; i++) lb.add(`P${i}`, i * 1000, i);
    expect(lb.all).toHaveLength(10);
    expect(lb.all[0].score).toBe(12000);
    expect(lb.all[9].score).toBe(3000);
    const reloaded = new Leaderboard(storage, "k", 10);
    expect(reloaded.all.map((e) => e.name)).toEqual(lb.all.map((e) => e.name));
  });

  it("reports qualification and rank", () => {
    const lb = new Leaderboard(new MemoryStorage(), "k", 3);
    expect(lb.qualifies(0)).toBe(false);
    expect(lb.add("ئەركىن", 500, 2)).toBe(0);
    expect(lb.add("WARIS", 900, 3)).toBe(0);
    lb.add("ALI", 100, 1);
    expect(lb.qualifies(50)).toBe(false);
    expect(lb.qualifies(200)).toBe(true);
    expect(lb.add("X", 200, 1)).toBe(2);
  });

  it("survives corrupted storage", () => {
    const s = new MemoryStorage();
    s.setItem("k", "{not json");
    expect(new Leaderboard(s, "k").all).toEqual([]);
  });

  it("sanitizes names but keeps Uyghur text", () => {
    expect(sanitizeName("  ئالىم‮  ")).toBe("ئالىم");
    expect(sanitizeName("A".repeat(40)).length).toBeLessThanOrEqual(14);
  });
});
