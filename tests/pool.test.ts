import { describe, expect, it } from "vitest";
import { Pool } from "../src/game/core/Pool";
import { SpatialGrid } from "../src/game/core/SpatialGrid";

describe("Pool", () => {
  it("recycles objects without allocating new ones", () => {
    let made = 0;
    const pool = new Pool(() => ({ id: made++ }), 4);
    const a = pool.acquire()!;
    const b = pool.acquire()!;
    expect(pool.count).toBe(2);
    pool.releaseAt(0);
    expect(pool.count).toBe(1);
    expect(pool.items[0]).toBe(b);
    const c = pool.acquire()!;
    expect(c).toBe(a);
    expect(made).toBe(2);
  });

  it("respects capacity", () => {
    const pool = new Pool(() => ({}), 2);
    pool.acquire();
    pool.acquire();
    expect(pool.acquire()).toBeNull();
  });
});

describe("SpatialGrid", () => {
  it("finds nearby bodies once, even when spanning cells", () => {
    const grid = new SpatialGrid<{ x: number; y: number; radius: number; gridStamp: number }>(64);
    grid.resize(720, 1000);
    const big = { x: 100, y: 100, radius: 90, gridStamp: 0 };
    const far = { x: 600, y: 900, radius: 10, gridStamp: 0 };
    grid.insert(big);
    grid.insert(far);
    const seen: unknown[] = [];
    grid.query(120, 120, 5, (b) => void seen.push(b));
    expect(seen).toEqual([big]);
  });
});
