import { CONFIG } from "../../config/gameConfig";

export interface ScoreEntry {
  name: string;
  score: number;
  wave: number;
  /** ISO date. */
  date: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory fallback when localStorage is unavailable (private mode, sandboxed iframes). */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function safeStorage(): KeyValueStorage {
  try {
    const s = window.localStorage;
    const probe = "__alem_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return new MemoryStorage();
  }
}

/** Removes control/bidi-override characters and trims; allows Uyghur and Latin names. */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CONFIG.leaderboard.maxNameLength);
}

/** Persistent Top-N leaderboard, sorted by score (desc) then wave (desc), then oldest first. */
export class Leaderboard {
  private entries: ScoreEntry[] = [];

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = CONFIG.storageKeys.leaderboard,
    private readonly size: number = CONFIG.leaderboard.size,
  ) {
    this.load();
  }

  private load(): void {
    try {
      const raw = this.storage.getItem(this.key);
      const data: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return;
      this.entries = data
        .filter(
          (e): e is ScoreEntry =>
            e && typeof e.name === "string" && Number.isFinite(e.score) && Number.isFinite(e.wave),
        )
        .map((e) => ({ name: sanitizeName(e.name) || "—", score: e.score, wave: e.wave, date: String(e.date ?? "") }));
      this.sort();
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.entries));
    } catch {
      /* quota / private mode — keep in memory */
    }
  }

  private sort(): void {
    this.entries.sort((a, b) => b.score - a.score || b.wave - a.wave || a.date.localeCompare(b.date));
    this.entries.length = Math.min(this.entries.length, this.size);
  }

  get all(): readonly ScoreEntry[] {
    return this.entries;
  }

  get best(): number {
    return this.entries[0]?.score ?? 0;
  }

  qualifies(score: number): boolean {
    if (score <= 0) return false;
    return this.entries.length < this.size || score > this.entries[this.entries.length - 1].score;
  }

  /** Inserts and returns the 0-based rank, or -1 if it did not place. */
  add(name: string, score: number, wave: number, date = new Date().toISOString()): number {
    if (!this.qualifies(score)) return -1;
    const entry: ScoreEntry = { name: sanitizeName(name) || "—", score, wave, date };
    this.entries.push(entry);
    this.sort();
    this.save();
    return this.entries.indexOf(entry);
  }

  clear(): void {
    this.entries = [];
    this.save();
  }
}
