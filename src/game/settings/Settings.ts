import { CONFIG } from "../../config/gameConfig";
import { DEFAULT_LOCALE, isLocale, type LocaleCode } from "../../i18n";
import type { KeyValueStorage } from "../scoring/Leaderboard";

export interface SettingsData {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  screenShake: boolean;
  /** null = automatic (on for touch devices). */
  autoFire: boolean | null;
  locale: LocaleCode;
}

export const DEFAULT_SETTINGS: SettingsData = {
  musicVolume: CONFIG.audio.defaultMusicVolume,
  sfxVolume: CONFIG.audio.defaultSfxVolume,
  musicMuted: false,
  sfxMuted: false,
  screenShake: true,
  autoFire: null,
  locale: DEFAULT_LOCALE,
};

type Listener = (s: Readonly<SettingsData>) => void;

export class Settings {
  private data: SettingsData = { ...DEFAULT_SETTINGS };
  private listeners = new Set<Listener>();

  constructor(private readonly storage: KeyValueStorage) {
    try {
      const raw = storage.getItem(CONFIG.storageKeys.settings);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsData>;
        const num = (v: unknown, d: number): number =>
          typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
        const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
        this.data = {
          musicVolume: num(parsed.musicVolume, DEFAULT_SETTINGS.musicVolume),
          sfxVolume: num(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
          musicMuted: bool(parsed.musicMuted, false),
          sfxMuted: bool(parsed.sfxMuted, false),
          screenShake: bool(parsed.screenShake, true),
          autoFire: typeof parsed.autoFire === "boolean" ? parsed.autoFire : null,
          locale: isLocale(parsed.locale) ? parsed.locale : DEFAULT_LOCALE,
        };
      }
    } catch {
      /* corrupted settings → defaults */
    }
  }

  get values(): Readonly<SettingsData> {
    return this.data;
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    if (this.data[key] === value) return;
    this.data = { ...this.data, [key]: value };
    try {
      this.storage.setItem(CONFIG.storageKeys.settings, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
    this.listeners.forEach((fn) => fn(this.data));
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
