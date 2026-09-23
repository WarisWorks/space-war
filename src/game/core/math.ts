export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));

export const chance = (p: number): boolean => Math.random() < p;

/** Frame-rate independent exponential smoothing factor for rate `k` (1/s). */
export const damp = (k: number, dt: number): number => 1 - Math.exp(-k * dt);

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const circlesOverlap = (
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
): boolean => {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
};

export function weightedPick<K extends string>(weights: Readonly<Record<K, number>>): K {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  let last!: K;
  for (const k in weights) {
    last = k;
    r -= weights[k];
    if (r <= 0) return k;
  }
  return last;
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
