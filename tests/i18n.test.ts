import { describe, expect, it } from "vitest";
import ug from "../src/locales/ug.json";
import en from "../src/locales/en.json";
import { LOCALES, formatNumber, getDirection, setLocale, t } from "../src/i18n";

describe("i18n", () => {
  it("every locale has exactly the same keys as Uyghur (the default)", () => {
    const base = Object.keys(ug).sort();
    for (const [code, dict] of Object.entries(LOCALES)) {
      expect(Object.keys(dict).sort(), `locale ${code}`).toEqual(base);
    }
  });

  it("has no empty strings", () => {
    for (const dict of [ug, en]) {
      for (const [k, v] of Object.entries(dict)) expect(v.trim(), k).not.toBe("");
    }
  });

  it("Uyghur strings use Arabic-script letters (no placeholder English)", () => {
    const latinOk = new Set(["app.titleLatin", "meta.dir"]);
    for (const [k, v] of Object.entries(ug)) {
      if (latinOk.has(k)) continue;
      expect(/[؀-ۿ]/.test(v), `${k}: ${v}`).toBe(true);
      expect(/[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, "")), `${k}: ${v}`).toBe(false);
    }
  });

  it("interpolates params and reports direction", () => {
    setLocale("ug");
    expect(t("wave.title", { n: 3 })).toBe("3-دولقۇن");
    expect(getDirection()).toBe("rtl");
    setLocale("en");
    expect(t("wave.title", { n: 3 })).toBe("Wave 3");
    expect(getDirection()).toBe("ltr");
    setLocale("ug");
  });

  it("falls back to the key for unknown strings", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
  });

  it("formats numbers with Western digits and grouping", () => {
    expect(formatNumber(12450)).toBe("12,450");
    expect(formatNumber(0)).toBe("0");
  });
});
