/** Size of one grid cell in pixels. */
export const GRID = 20;

export type PanelSizeKind = 'timer' | 'session' | 'standard' | 'namedPh' | 'buffs' | 'note' | 'checklist' | 'players' | 'levels' | 'spells' | 'leveling' | 'map' | 'classes' | 'prices' | 'wiki' | 'wishlist' | 'gear';

/**
 * Footprint of each panel type in grid cells. The footprint includes one cell of gutter on the
 * right and bottom, so panels placed edge-to-edge always have an even 20px gap between them.
 * Drawn size = (w - 1) * GRID by (h - 1) * GRID. (Widths grew from 13 to 15 cells; TrackerStore re-tidies
 * boards saved with the old size if panels would overlap.)
 */
export const PANEL_SIZE: Record<PanelSizeKind, { w: number; h: number }> = {
  timer: { w: 15, h: 10 }, // 280 x 180
  session: { w: 15, h: 15 }, // 280 x 280: the Session timer (count-up clock and its counters)
  standard: { w: 15, h: 9 }, // 280 x 160
  namedPh: { w: 15, h: 18 }, // 280 x 340: the Named / PH timer (countdown and camp)
  buffs: { w: 15, h: 14 }, // 280 x 260
  note: { w: 15, h: 12 }, // 280 x 220 (notes can be resized; this is the starting size)
  checklist: { w: 15, h: 20 }, // 280 x 380
  players: { w: 15, h: 15 }, // 280 x 280
  levels: { w: 15, h: 22 }, // 280 x 420
  leveling: { w: 22, h: 28 }, // 420 x 540 (resizable)
  classes: { w: 25, h: 33 }, // 480 x 640 (resizable)
  prices: { w: 23, h: 31 }, // 440 x 600 (resizable)
  wiki: { w: 24, h: 31 }, // 460 x 600 (resizable)
  wishlist: { w: 22, h: 28 }, // 420 x 540 (resizable)
  gear: { w: 27, h: 34 }, // 520 x 660 (resizable)
  map: { w: 27, h: 30 }, // 520 x 580 (resizable)
  spells: { w: 22, h: 28 }, // 420 x 540 (resizable; this is the starting size)
};

/**
 * Smallest each panel can be resized to (grid cells): enough that its controls never get cut off.
 * Notes, Spells and Leveling have their own minimums in TrackerStore.
 */
export const PANEL_MIN: Record<'timer' | 'session' | 'standard' | 'namedPh' | 'buffs' | 'players' | 'levels', { w: number; h: number }> = {
  timer: { w: 13, h: 9 },
  session: { w: 13, h: 11 },
  standard: { w: 12, h: 8 },
  namedPh: { w: 14, h: 18 },
  buffs: { w: 13, h: 9 },
  players: { w: 13, h: 10 },
  levels: { w: 14, h: 15 },
};

/** A panel's footprint: its saved size, or the default for its kind. */
export function sizeOf(item: { w?: number; h?: number }, def: { w: number; h: number }): { w: number; h: number } {
  return { w: item.w ?? def.w, h: item.h ?? def.h };
}

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

/**
 * Where a panel dropped on an occupied spot can go instead: the biggest footprint, no smaller than `min` and no bigger
 * than the panel, with its top-left at the drop point or up to `reach` cells from it. The biggest wins (so a full-size
 * spot a cell or two away beats shrinking in place); among equals, the one closest to the drop point. Null if nothing
 * fits. `occupied` must leave out the panel being dragged.
 */
export function fitRect(
  drop: Rect,
  min: { w: number; h: number },
  occupied: readonly Rect[],
  cols: number,
  reach = 2,
): Rect | null {
  let best: (Rect & { area: number; dist: number }) | null = null;
  const minW = Math.min(min.w, drop.w);
  const minH = Math.min(min.h, drop.h);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const x = drop.x + dx;
      const y = drop.y + dy;
      if (x < 0 || y < 0) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      // Widest first; for each width, the tallest that's free (anything above the drop row in its columns blocks it).
      for (let w = Math.min(drop.w, cols - x + 1); w >= minW; w--) {
        let room = drop.h;
        for (const o of occupied) {
          if (o.x >= x + w || x >= o.x + o.w) continue; // not in these columns
          if (o.y + o.h <= y) continue; // above
          room = Math.min(room, o.y - y); // below the top edge, or ≤ 0 when it covers the top row
        }
        if (room < minH) continue;
        const area = w * room;
        if (!best || area > best.area || (area === best.area && dist < best.dist)) best = { x, y, w, h: room, area, dist };
      }
    }
  }
  return best && { x: best.x, y: best.y, w: best.w, h: best.h };
}

/**
 * Makes room for a panel dropped at `drop` by pushing the panels in its way straight down, and the ones those land on
 * in turn (top to bottom, so nothing ends up overlapping). Panels not in the way stay put. Returns the new top row of
 * each panel that moves. `others` must leave out the panel being dropped.
 */
export function pushDown(drop: Rect, others: readonly (Rect & { id: string })[]): Map<string, number> {
  const settled: Rect[] = [drop];
  const moved = new Map<string, number>();
  const order = [...others].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const o of order) {
    const r = { ...o };
    for (let hit = settled.filter((s) => overlaps(s, r)); hit.length; hit = settled.filter((s) => overlaps(s, r))) {
      r.y = Math.max(...hit.map((s) => s.y + s.h));
    }
    if (r.y !== o.y) moved.set(o.id, r.y);
    settled.push(r);
  }
  return moved;
}

/**
 * Makes room for a panel dropped at `drop` by sliding the panels in its way sideways, staying in their rows: each one
 * moves away from the side of the dropped panel it's on (left of its centre goes left, otherwise right), and any it
 * bumps into move on the same way. Null if that would push something off either edge of the board (`cols` wide) or
 * can't settle without overlaps. Returns the new left column of each panel that moves.
 */
export function pushSideways(drop: Rect, others: readonly (Rect & { id: string })[], cols: number): Map<string, number> | null {
  const pos = new Map(others.map((o) => [o.id, { ...o }]));
  const moved = new Map<string, number>();
  const centre = (r: Rect) => r.x + r.w / 2;
  // Each pusher shoves whatever it overlaps away from itself; the first pusher is the dropped panel.
  const queue: { r: Rect; id: string | null }[] = [{ r: drop, id: null }];
  for (let steps = 0; queue.length; steps++) {
    if (steps > others.length * 4 + 8) return null; // going round in circles
    const p = queue.shift()!;
    for (const q of pos.values()) {
      if (q.id === p.id || !overlaps(p.r, q)) continue;
      const right = centre(q) >= centre(p.r);
      q.x = right ? p.r.x + p.r.w : p.r.x - q.w;
      if (q.x < 0 || q.x > maxX(cols, q.w)) return null;
      moved.set(q.id, q.x);
      queue.push({ r: q, id: q.id });
    }
  }
  const after = [drop, ...pos.values()];
  for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) if (overlaps(after[i], after[j])) return null;
  return moved;
}

/**
 * Makes room for a panel dropped onto others: sideways if the panels in the way can slide aside (see pushSideways),
 * otherwise straight down (see pushDown). Returns how, and the new spot of each panel that moves.
 */
export function makeRoom(
  drop: Rect,
  others: readonly (Rect & { id: string })[],
  cols: number,
): { how: 'aside' | 'down'; moves: Map<string, { x: number; y: number }> } {
  const byId = new Map(others.map((o) => [o.id, o]));
  const side = pushSideways(drop, others, cols);
  if (side) return { how: 'aside', moves: new Map([...side].map(([id, x]) => [id, { x, y: byId.get(id)!.y }])) };
  const down = pushDown(drop, others);
  return { how: 'down', moves: new Map([...down].map(([id, y]) => [id, { x: byId.get(id)!.x, y }])) };
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
