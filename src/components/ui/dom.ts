import { createElement, type IconNode } from "lucide";
import { formatNumber } from "../../i18n";

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

/** Tiny hyperscript helper: h("div", { class: "x", onclick: fn }, children...). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2), value as EventListener);
      } else if (key === "class") {
        el.className = String(value);
      } else {
        el.setAttribute(key, value === true ? "" : String(value));
      }
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Lucide icon as an inline SVG element. */
export function icon(node: IconNode, cls = ""): SVGElement {
  const el = createElement(node, { class: "lucide" });
  el.setAttribute("aria-hidden", "true");
  if (cls) el.classList.add(...cls.split(" "));
  return el;
}

/** LTR-isolated number (Western digits with grouping) — safe inside RTL text. */
export function num(value: number | string, cls = ""): HTMLElement {
  return h("bdi", { class: `num ${cls}`.trim(), dir: "ltr" },
    typeof value === "number" ? formatNumber(value) : value);
}

export function ornament(): HTMLElement {
  return h("div", { class: "ornament", "aria-hidden": "true" }, h("i"), h("i"), h("i"));
}

/**
 * Ikat ("atlas" silk) motif: stacked, feather-edged diamonds in saffron, ember and
 * lapis. Generated as an SVG data URI so it tiles crisply at any DPI.
 */
export function ikatPatternUrl(): string {
  const diamond = (cx: number, cy: number, w: number, hgt: number, fill: string, o: number): string =>
    `<path d="M${cx} ${cy - hgt}L${cx + w} ${cy}L${cx} ${cy + hgt}L${cx - w} ${cy}Z" fill="${fill}" opacity="${o}"/>`;
  // Jagged "blurred" edges characteristic of ikat dyeing
  const feather = (cx: number, cy: number, w: number, hgt: number, fill: string): string => {
    let d = "";
    for (let i = -3; i <= 3; i++) {
      const y = cy + (i * hgt) / 3.5;
      const half = w * (1 - Math.abs(i) / 3.5) + 4;
      d += `<rect x="${cx - half}" y="${y - 2}" width="${half * 2}" height="4" fill="${fill}" opacity="0.5"/>`;
    }
    return d;
  };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="128" viewBox="0 0 64 128">` +
    feather(32, 32, 20, 28, "#ffc24b") +
    diamond(32, 32, 20, 28, "#ffc24b", 0.9) +
    diamond(32, 32, 10, 14, "#ff5a3c", 1) +
    diamond(32, 32, 4, 6, "#f5f1e8", 1) +
    feather(32, 96, 20, 28, "#3d7bff") +
    diamond(32, 96, 20, 28, "#3d7bff", 0.9) +
    diamond(32, 96, 10, 14, "#ff3fa4", 1) +
    diamond(32, 96, 4, 6, "#f5f1e8", 1) +
    diamond(0, 64, 8, 12, "#53e6ff", 0.8) +
    diamond(64, 64, 8, 12, "#53e6ff", 0.8) +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
