import ug from "../locales/ug.json";
import en from "../locales/en.json";

export type Dictionary = Record<string, string>;
export type LocaleCode = "ug" | "en";
export type Direction = "rtl" | "ltr";

/**
 * Registered locales. To add a language (ja, tr, zh…): create `src/locales/xx.json`
 * with the same keys as ug.json, import it here and add an entry. Key parity is
 * enforced by tests/i18n.test.ts.
 */
export const LOCALES: Record<LocaleCode, Dictionary> = { ug, en };
export const DEFAULT_LOCALE: LocaleCode = "ug";

type Listener = (locale: LocaleCode) => void;

let current: LocaleCode = DEFAULT_LOCALE;
const listeners = new Set<Listener>();

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && value in LOCALES;
}

export function getLocale(): LocaleCode {
  return current;
}

export function getDirection(locale: LocaleCode = current): Direction {
  return LOCALES[locale]["meta.dir"] === "rtl" ? "rtl" : "ltr";
}

/** Translate `key`, interpolating `{name}` placeholders. Falls back to Uyghur, then the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = LOCALES[current][key] ?? LOCALES[DEFAULT_LOCALE][key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export function setLocale(locale: LocaleCode): void {
  if (!isLocale(locale)) return;
  current = locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
  }
  listeners.forEach((fn) => fn(locale));
}

export function onLocaleChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const numberFormat = new Intl.NumberFormat("en-US");

/**
 * Scores and counters always use Western digits with grouping (the standard in
 * Uyghur Arabic-script typography). Callers place the result in an LTR-isolated
 * element (`<bdi>` / `.num`) so it never reorders inside RTL text.
 */
export function formatNumber(value: number): string {
  return numberFormat.format(Math.round(value));
}
