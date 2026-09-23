export interface GridBody {
  x: number;
  y: number;
  radius: number;
  /** Scratch field used by the grid to de-duplicate multi-cell bodies per query. */
  gridStamp: number;
}

/**
 * Uniform-grid broad phase. Rebuilt every frame (O(n)), queried per projectile.
 * Buckets are reused arrays — no per-frame allocation.
 */
export class SpatialGrid<T extends GridBody> {
  private cols = 1;
  private rows = 1;
  private buckets: T[][] = [[]];
  private queryId = 0;

  constructor(private readonly cellSize: number) {}

  /** Cells cover the world plus a margin, so bodies entering from off-screen still register. */
  private get offset(): number {
    return this.cellSize * 2;
  }

  resize(width: number, height: number): void {
    this.cols = Math.max(1, Math.ceil((width + this.offset * 2) / this.cellSize));
    this.rows = Math.max(1, Math.ceil((height + this.offset * 2) / this.cellSize));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const b of this.buckets) b.length = 0;
  }

  private col(v: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((v + this.offset) / this.cellSize)));
  }

  private row(v: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((v + this.offset) / this.cellSize)));
  }

  insert(body: T): void {
    const c0 = this.col(body.x - body.radius);
    const c1 = this.col(body.x + body.radius);
    const r0 = this.row(body.y - body.radius);
    const r1 = this.row(body.y + body.radius);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) this.buckets[r * this.cols + c].push(body);
    }
  }

  /** Visits each candidate near (x, y, r) once. Return `true` from `visit` to stop early. */
  query(x: number, y: number, r: number, visit: (body: T) => boolean | void): void {
    this.queryId = (this.queryId + 1) % 0x7fffffff || 1;
    const c0 = this.col(x - r);
    const c1 = this.col(x + r);
    const r0 = this.row(y - r);
    const r1 = this.row(y + r);
    for (let row = r0; row <= r1; row++) {
      for (let c = c0; c <= c1; c++) {
        const bucket = this.buckets[row * this.cols + c];
        for (let i = 0; i < bucket.length; i++) {
          const body = bucket[i];
          if (body.gridStamp === this.queryId) continue;
          body.gridStamp = this.queryId;
          if (visit(body)) return;
        }
      }
    }
  }
}
