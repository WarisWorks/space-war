import { Music, type MusicMood } from "./Music";
import { SFX, type SfxName } from "./Sfx";

/** Minimum seconds between two plays of the same effect (prevents stacking/clipping). */
const THROTTLE: Partial<Record<SfxName, number>> = {
  playerShot: 0.055,
  enemyShot: 0.07,
  hit: 0.04,
  explosionSmall: 0.05,
  shieldHit: 0.08,
  menuMove: 0.04,
};

/**
 * Web Audio graph: sources → (music | sfx) bus → compressor → destination.
 * Everything is synthesised at runtime — no audio files to download.
 * The context is created lazily on the first user gesture (autoplay policy).
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  noise!: AudioBuffer;
  private lastPlayed = new Map<SfxName, number>();
  private music: Music | null = null;
  private pendingMood: MusicMood | null = null;

  private musicVolume = 0.5;
  private sfxVolume = 0.7;
  private musicMuted = false;
  private sfxMuted = false;
  private ducked = false;

  /** Call from a user-gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: "interactive" });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 18000;
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.musicFilter).connect(comp);
      this.sfxBus.connect(comp);
      comp.connect(this.master).connect(ctx.destination);

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.music = new Music(ctx, this.musicBus, this.noise);
      this.applyVolumes();
      if (this.pendingMood) this.music.setMood(this.pendingMood);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  setVolumes(music: number, sfx: number, musicMuted: boolean, sfxMuted: boolean): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.musicMuted = musicMuted;
    this.sfxMuted = sfxMuted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.musicMuted ? 0 : this.musicVolume * this.musicVolume * (this.ducked ? 0.45 : 1);
    const s = this.sfxMuted ? 0 : this.sfxVolume * this.sfxVolume;
    this.musicBus.gain.setTargetAtTime(m * 0.8, t, 0.08);
    this.sfxBus.gain.setTargetAtTime(s, t, 0.03);
    this.musicFilter.frequency.setTargetAtTime(this.ducked ? 900 : 18000, t, 0.15);
  }

  /** Muffles the music (pause menu, game over). */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  setMood(mood: MusicMood): void {
    this.pendingMood = mood;
    this.music?.setMood(mood);
  }

  play(name: SfxName, intensity = 1): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.sfxMuted) return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name];
    if (gap !== undefined) {
      const last = this.lastPlayed.get(name) ?? -1;
      if (now - last < gap) return;
    }
    this.lastPlayed.set(name, now);
    SFX[name]({ ctx, out: this.sfxBus, noise: this.noise, t: now + 0.005, intensity });
  }

  /** Suspends the audio clock while the tab is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}
