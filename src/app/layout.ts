/** Size of one grid cell in pixels. */
export const GRID = 20;

export type PanelSizeKind = 'timer' | 'standard' | 'namedPh' | 'buffs' | 'note';

/**
 * Footprint of each panel type in grid cells. The footprint includes one cell of gutter on the
 * right and bottom, so panels placed edge-to-edge always have an even 20px gap between them.
 * Drawn size = (w - 1) * GRID by (h - 1) * GRID.
 */
export const PANEL_SIZE: Record<PanelSizeKind, { w: number; h: number }> = {
  timer: { w: 13, h: 10 }, // 240 x 180
  standard: { w: 13, h: 9 }, // 240 x 160
  namedPh: { w: 13, h: 12 }, // 240 x 220
  buffs: { w: 13, h: 14 }, // 240 x 260
  note: { w: 13, h: 12 }, // 240 x 220
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Highest x a panel of width w may sit at so its drawn area stays within `cols`. */
export function maxX(cols: number, w: number): number {
  return Math.max(0, cols - w + 1);
}

/** First free spot scanning rows top-to-bottom, left-to-right. */
export function findFreeSpot(occupied: Rect[], w: number, h: number, cols: number): { x: number; y: number } {
  const limit = maxX(cols, w);
  for (let y = 0; ; y++) {
    for (let x = 0; x <= limit; x++) {
      const r = { x, y, w, h };
      if (!occupied.some((o) => overlaps(o, r))) return { x, y };
    }
  }
}
