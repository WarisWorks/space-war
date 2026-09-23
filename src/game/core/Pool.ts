/**
 * Dense object pool. Live objects occupy `items[0..count)`; releasing swaps the
 * released object with the last live one, so iteration stays cache-friendly and
 * steady-state gameplay performs zero allocations.
 *
 * When releasing during iteration, iterate backwards.
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;

  constructor(
    private readonly factory: () => T,
    readonly capacity: number,
    prewarm = 0,
  ) {
    for (let i = 0; i < Math.min(prewarm, capacity); i++) this.items.push(factory());
  }

  /** Returns a recycled object, or `null` when the pool is at capacity. */
  acquire(): T | null {
    if (this.count >= this.capacity) return null;
    if (this.count === this.items.length) this.items.push(this.factory());
    return this.items[this.count++];
  }

  releaseAt(index: number): void {
    const last = --this.count;
    if (index !== last) {
      const tmp = this.items[index];
      this.items[index] = this.items[last];
      this.items[last] = tmp;
    }
  }

  clear(): void {
    this.count = 0;
  }
}
