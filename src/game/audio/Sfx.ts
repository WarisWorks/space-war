/**
 * Synthesised sound-effect recipes. Each recipe schedules a short node graph that
 * frees itself when finished.
 */
export interface SfxContext {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  t: number;
  intensity: number;
}

type Recipe = (c: SfxContext) => void;

function env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function tone(
  c: SfxContext, type: OscillatorType, f0: number, f1: number, t: number, dur: number,
  peak: number, dest: AudioNode = c.out, detune = 0,
): void {
  const { ctx } = c;
  const o = ctx.createOscillator();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = env(ctx, t, peak, 0.004, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBurst(
  c: SfxContext, t: number, dur: number, peak: number, type: BiquadFilterType,
  f0: number, f1: number, q = 0.8,
): void {
  const { ctx } = c;
  const src = ctx.createBufferSource();
  src.buffer = c.noise;
  src.loop = true; // random start offset + long tails must not run off the 1 s buffer
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = env(ctx, t, peak, 0.005, dur);
  src.connect(filter).connect(g).connect(c.out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const note = (semitonesFromA4: number): number => 440 * Math.pow(2, semitonesFromA4 / 12);

export const SFX = {
  playerShot: (c) => {
    const d = (Math.random() - 0.5) * 60;
    tone(c, "square", 1250, 380, c.t, 0.07, 0.05, c.out, d);
    tone(c, "triangle", 900, 180, c.t, 0.09, 0.07, c.out, d);
    noiseBurst(c, c.t, 0.03, 0.03, "highpass", 5000, 3000);
  },
  enemyShot: (c) => {
    tone(c, "sawtooth", 520, 160, c.t, 0.14, 0.035);
    tone(c, "sine", 260, 120, c.t, 0.12, 0.05);
  },
  hit: (c) => {
    tone(c, "square", 1800, 900, c.t, 0.04, 0.025);
    noiseBurst(c, c.t, 0.05, 0.05, "bandpass", 3000, 1500, 2);
  },
  explosionSmall: (c) => {
    noiseBurst(c, c.t, 0.35, 0.35, "lowpass", 3200, 120);
    tone(c, "sine", 150, 40, c.t, 0.25, 0.3);
  },
  explosionLarge: (c) => {
    noiseBurst(c, c.t, 0.9, 0.55, "lowpass", 2400, 60);
    noiseBurst(c, c.t + 0.05, 0.6, 0.2, "bandpass", 900, 200, 1.4);
    tone(c, "sine", 110, 28, c.t, 0.8, 0.55);
    tone(c, "triangle", 70, 30, c.t + 0.02, 0.9, 0.25);
  },
  explosionBoss: (c) => {
    for (let i = 0; i < 4; i++) {
      const t = c.t + i * 0.22;
      noiseBurst(c, t, 1.4 - i * 0.15, 0.55, "lowpass", 3000 - i * 400, 50);
      tone(c, "sine", 120 - i * 10, 24, t, 1.2, 0.5);
    }
    tone(c, "sawtooth", 220, 55, c.t + 0.9, 1.6, 0.08);
  },
  powerUp: (c) => {
    [0, 4, 7, 12, 16].forEach((s, i) => tone(c, "triangle", note(s + 3), note(s + 3), c.t + i * 0.055, 0.16, 0.12));
    tone(c, "sine", note(27), note(27), c.t + 0.28, 0.3, 0.05);
  },
  extraLife: (c) => {
    [0, 5, 9, 12, 17, 21, 24].forEach((s, i) => tone(c, "triangle", note(s), note(s), c.t + i * 0.06, 0.22, 0.11));
  },
  shieldOn: (c) => {
    tone(c, "sawtooth", 180, 900, c.t, 0.35, 0.05);
    tone(c, "sawtooth", 182, 910, c.t, 0.35, 0.05, c.out, 12);
    tone(c, "sine", 440, 1320, c.t + 0.05, 0.4, 0.08);
  },
  shieldHit: (c) => {
    tone(c, "sine", 1480, 1400, c.t, 0.3, 0.12);
    tone(c, "sine", 2210, 2100, c.t, 0.22, 0.06);
    noiseBurst(c, c.t, 0.08, 0.08, "highpass", 4000, 2000);
  },
  shieldBreak: (c) => {
    tone(c, "sawtooth", 900, 90, c.t, 0.45, 0.08);
    noiseBurst(c, c.t, 0.5, 0.25, "highpass", 6000, 800);
    [0, 0.06, 0.13].forEach((d) => tone(c, "sine", 2400 - d * 6000, 1200, c.t + d, 0.15, 0.05));
  },
  playerHit: (c) => {
    noiseBurst(c, c.t, 0.8, 0.6, "lowpass", 2000, 80);
    tone(c, "square", 220, 40, c.t, 0.6, 0.12);
    tone(c, "sine", 90, 25, c.t, 0.7, 0.5);
  },
  bossArrival: (c) => {
    for (let i = 0; i < 3; i++) {
      const t = c.t + i * 0.55;
      tone(c, "sawtooth", 330, 330, t, 0.25, 0.06);
      tone(c, "sawtooth", 247, 247, t + 0.27, 0.25, 0.06);
    }
    tone(c, "sawtooth", 55, 55, c.t, 2.2, 0.12);
    tone(c, "sawtooth", 55.6, 54, c.t, 2.2, 0.12, c.out, 8);
    noiseBurst(c, c.t, 2, 0.12, "lowpass", 200, 1400);
  },
  menuMove: (c) => {
    tone(c, "sine", 1300, 1300, c.t, 0.035, 0.05);
  },
  menuSelect: (c) => {
    tone(c, "triangle", note(3), note(10), c.t, 0.09, 0.12);
    tone(c, "sine", note(15), note(15), c.t + 0.06, 0.14, 0.07);
  },
  waveStart: (c) => {
    // Rising motif in the game's D-Hijaz mode.
    [-7, -6, -3, 0, 5].forEach((s, i) => tone(c, "triangle", note(s), note(s), c.t + i * 0.08, 0.5 - i * 0.05, 0.1));
    tone(c, "sine", note(-19), note(-19), c.t, 0.9, 0.12);
  },
  waveComplete: (c) => {
    [0, 3, 7, 12].forEach((s, i) => tone(c, "triangle", note(s - 7), note(s - 7), c.t + i * 0.09, 0.35, 0.1));
  },
  gameOver: (c) => {
    [-2, -5, -9, -14, -17].forEach((s, i) =>
      tone(c, "sawtooth", note(s), note(s) * 0.98, c.t + i * 0.28, 0.5, 0.06));
    tone(c, "sine", note(-29), note(-33), c.t, 1.8, 0.2);
  },
  newRecord: (c) => {
    [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone(c, "triangle", note(s), note(s), c.t + i * 0.07, 0.25, 0.1));
  },
} satisfies Record<string, Recipe>;

export type SfxName = keyof typeof SFX;
