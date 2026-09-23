/**
 * Generative soundtrack. A lookahead step-sequencer plays in D Hijaz (Phrygian
 * dominant) — the mode behind many Uyghur muqam melodies — with a dap-style drum
 * pattern, a plucked "rawap" lead, bass and a slow pad. Mood changes the tempo and
 * which layers play.
 */
export type MusicMood = "off" | "menu" | "game" | "boss";

const SCALE = [0, 1, 4, 5, 7, 8, 10]; // D Eb F# G A Bb C
const ROOT_MIDI = 50; // D3

/** Four-bar progression: D – Eb – Cm – D (all diatonic to D Hijaz). */
const PROGRESSION: { root: number; chord: number[] }[] = [
  { root: 0, chord: [0, 4, 7] },
  { root: 1, chord: [1, 5, 8] },
  { root: -2, chord: [-2, 1, 5] },
  { root: 0, chord: [0, 4, 7] },
];

// Dap (frame drum) pattern on 16th steps: DUM (low), TEK (rim), KA (ghost).
const DUM = new Set([0, 7, 10]);
const TEK = new Set([3, 4, 12, 14]);
const KA = new Set([2, 6, 8, 11, 15]);

const MOODS: Record<MusicMood, { bpm: number; drums: number; lead: number; bass: number; pad: number }> = {
  off: { bpm: 100, drums: 0, lead: 0, bass: 0, pad: 0 },
  menu: { bpm: 92, drums: 0.35, lead: 0.8, bass: 0.6, pad: 1 },
  game: { bpm: 116, drums: 1, lead: 1, bass: 1, pad: 0.7 },
  boss: { bpm: 132, drums: 1.2, lead: 1.1, bass: 1.2, pad: 0.5 },
};

const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

function degreeToMidi(degree: number, octave: number): number {
  const len = SCALE.length;
  const o = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return ROOT_MIDI + (octave + o) * 12 + SCALE[idx];
}

export class Music {
  private mood: MusicMood = "off";
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private motif: (number | null)[] = [];
  private readonly lookahead = 0.12;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
  ) {
    this.motif = this.makeMotif();
  }

  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    const wasOff = this.mood === "off";
    this.mood = mood;
    if (mood === "off") {
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      return;
    }
    if (wasOff || this.timer === null) {
      this.nextTime = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.bar = 0;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }

  private makeMotif(): (number | null)[] {
    // 8 eighth-notes; random walk over scale degrees with phrase-ending on the tonic.
    const m: (number | null)[] = [];
    let d = 7 + Math.floor(Math.random() * 3);
    for (let i = 0; i < 8; i++) {
      if (i > 0 && Math.random() < 0.22) {
        m.push(null);
        continue;
      }
      d += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
      d = Math.max(4, Math.min(12, d));
      m.push(d);
    }
    m[7] = 7;
    return m;
  }

  private schedule(): void {
    if (this.ctx.state !== "running") {
      this.nextTime = this.ctx.currentTime + 0.05;
      return;
    }
    const cfg = MOODS[this.mood];
    const stepDur = 60 / cfg.bpm / 4;
    // Resync if the clock ran away (e.g. tab was hidden).
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + this.lookahead) {
      this.playStep(this.step, this.nextTime, stepDur, cfg);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) {
        this.bar++;
        if (this.bar % 8 === 0) this.motif = this.makeMotif();
      }
    }
  }

  private playStep(step: number, t: number, stepDur: number, cfg: (typeof MOODS)[MusicMood]): void {
    const chord = PROGRESSION[this.bar % PROGRESSION.length];

    if (cfg.drums > 0) {
      if (DUM.has(step)) this.dum(t, 0.42 * cfg.drums);
      if (TEK.has(step)) this.tek(t, 0.12 * cfg.drums);
      if (KA.has(step)) this.ka(t, 0.04 * cfg.drums);
      if (this.mood === "boss" && step % 2 === 1) this.ka(t, 0.03);
    }

    if (cfg.bass > 0 && (step % 4 === 0 || step === 7 || step === 10)) {
      const midi = ROOT_MIDI - 12 + chord.root + (step === 10 ? 7 : 0);
      this.bass(t, midiToFreq(midi), stepDur * (step % 4 === 0 ? 2.5 : 1.5), 0.16 * cfg.bass);
    }

    if (cfg.pad > 0 && step === 0) {
      this.pad(t, chord.chord.map((s) => midiToFreq(ROOT_MIDI + 12 + s)), stepDur * 16, 0.028 * cfg.pad);
    }

    if (cfg.lead > 0 && step % 2 === 0) {
      // Motif plays on bars 2–4 of each 4-bar phrase, transposed to follow the chord.
      if (this.bar % 4 === 0 && this.mood !== "boss") return;
      const deg = this.motif[step / 2];
      if (deg === null) return;
      const shift = chord.root === 1 ? 1 : chord.root === -2 ? -1 : 0;
      const midi = degreeToMidi(deg + shift, 1);
      this.pluck(t, midiToFreq(midi), 0.09 * cfg.lead);
      // Echo (rawap-style tremolo tail) a dotted-eighth later
      this.pluck(t + stepDur * 3, midiToFreq(midi), 0.03 * cfg.lead);
    }
  }

  private dum(t: number, peak: number): void {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.32);
  }

  private noiseHit(t: number, peak: number, freq: number, dur: number, type: BiquadFilterType): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.02);
  }

  private tek(t: number, peak: number): void {
    this.noiseHit(t, peak, 3200, 0.06, "bandpass");
  }

  private ka(t: number, peak: number): void {
    this.noiseHit(t, peak, 7000, 0.03, "highpass");
  }

  private bass(t: number, freq: number, dur: number, peak: number): void {
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private pad(t: number, freqs: number[], dur: number, peak: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1100;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    f.connect(g).connect(this.out);
    for (const freq of freqs) {
      for (const det of [-9, 9]) {
        const o = this.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = freq;
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur * 1.1);
      }
    }
  }

  /** Plucked lead with a tiny upward slide — evokes the rawap lute. */
  private pluck(t: number, freq: number, peak: number): void {
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    const o2 = this.ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = freq * 2;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.18;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.out);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.4);
    o2.stop(t + 0.4);
  }
}
