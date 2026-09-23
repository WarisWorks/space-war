import type { IconNode } from "lucide";

/**
 * Converts a lucide icon node (24×24 viewBox) into a Path2D so the same icon set used
 * by the DOM UI can be baked into canvas sprites. Supports path, circle, line,
 * polyline, polygon and rect — everything lucide emits.
 */
export function iconToPath2D(node: IconNode): Path2D {
  const path = new Path2D();
  for (const [tag, a] of node) {
    const attrs = a as Record<string, string | number | undefined>;
    const n = (k: string): number => Number(attrs[k] ?? 0);
    switch (tag) {
      case "path":
        path.addPath(new Path2D(String(attrs.d)));
        break;
      case "circle":
        path.moveTo(n("cx") + n("r"), n("cy"));
        path.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
        break;
      case "line":
        path.moveTo(n("x1"), n("y1"));
        path.lineTo(n("x2"), n("y2"));
        break;
      case "polyline":
      case "polygon": {
        const pts = String(attrs.points).trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i < pts.length; i += 2) {
          if (i === 0) path.moveTo(pts[i], pts[i + 1]);
          else path.lineTo(pts[i], pts[i + 1]);
        }
        if (tag === "polygon") path.closePath();
        break;
      }
      case "rect":
        if (attrs.rx) path.roundRect(n("x"), n("y"), n("width"), n("height"), n("rx"));
        else path.rect(n("x"), n("y"), n("width"), n("height"));
        break;
    }
  }
  return path;
}

/** Multi-shot glyph drawn in lucide's 24×24 / 2px-stroke style (lucide has no fan icon). */
export const MULTI_SHOT_ICON: IconNode = [
  ["path", { d: "M12 21V5" }],
  ["path", { d: "M12 21 5.5 7" }],
  ["path", { d: "M12 21l6.5-14" }],
  ["path", { d: "m9 8 3-4 3 4" }],
];
