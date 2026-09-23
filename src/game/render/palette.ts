/**
 * Game palette — the Silk Road tokens (Lapis, Saffron, Ember, Ivory, Umber) pushed
 * into a neon, deep-space register. Mirrors the CSS variables in styles/main.css.
 */
export const PALETTE = {
  space: "#03050f",
  spaceDeep: "#070b1f",
  lapis: "#3d7bff",
  lapisDeep: "#14286b",
  cyan: "#53e6ff",
  saffron: "#ffc24b",
  ember: "#ff5a3c",
  ivory: "#f5f1e8",
  umber: "#1b130f",
  magenta: "#ff3fa4",
  violet: "#9b6bff",
  lime: "#9dff5c",
  teal: "#3dffd0",
  white: "#ffffff",
} as const;

export type PaletteColor = keyof typeof PALETTE;
