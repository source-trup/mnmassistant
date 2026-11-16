/**
 * Respawn estimates from a camp's kill log.
 *
 * The log only records when the button was pressed. Pressing late (finishing a fight, looting first) makes a kill
 * look later than it was, never earlier. So:
 *  - the interval is the typical (median) cycle, not a plain average. A gap close to a whole number of cycles
 *    counts as that many (12 min on a 6 min camp is a missed spawn: two cycles of 6). Anything else is an outlier
 *    and left out: a late press (8 min on a 6 min camp), an in-between gap (9 min), a break, a double click;
 *  - the next spawn is projected from each of the last few kills by whole intervals, and the earliest projection
 *    wins. Late presses are part of that run (they're what it corrects for), so one late press doesn't push the
 *    estimate back.
 */

export interface RespawnEstimate {
  /** Typical time from one spawn to the next, in ms. */
  interval: number;
  /** How many respawn cycles the interval is based on. */
  cycles: number;
  /** Gaps left out as outliers (late presses, odd gaps, breaks; double clicks aren't counted). */
  outliers: number;
  /** When the next spawn is expected (epoch ms), from the rhythm of the last few kills. */
  next: number;
  /** The latest logged kill (epoch ms). */
  last: number;
}

/** Fewest cycles before an estimate is shown. */
export const MIN_CYCLES = 3;
/** Only the most recent kills count (camps and spawn timers change). */
const RECENT_KILLS = 40;
/** Kills used to place the next spawn. */
const PHASE_KILLS = 6;
/** Gaps shorter than this are a second press for the same kill. */
const DOUBLE_PRESS_MS = 15_000;
/** A gap of up to this many cycles counts (spawns not logged in between); longer is a break. */
const MAX_CYCLES_PER_GAP = 3;
/** How far a gap may be from a whole number of cycles (as a share of one cycle) and still count. */
const TOLERANCE = 0.2;

export function estimateRespawn(times: readonly number[]): RespawnEstimate | null {
  const t = [...times].sort((a, b) => a - b).slice(-RECENT_KILLS);
  const gaps: number[] = [];
  for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
  const real = gaps.filter((g) => g >= DOUBLE_PRESS_MS);
  if (real.length < MIN_CYCLES) return null;

  // A first guess from the middle gap, then each gap as whole cycles of it.
  const rough = median(real);
  const cyclesIn = (g: number): number => {
    const k = Math.round(g / rough);
    return k >= 1 && k <= MAX_CYCLES_PER_GAP && Math.abs(g / k - rough) <= TOLERANCE * rough ? k : 0;
  };
  // Each counted gap gives one cycle length per cycle in it; the middle one is the interval (so a single late press
  // doesn't stretch it).
  const lengths: number[] = [];
  let outliers = 0;
  for (const g of real) {
    const k = cyclesIn(g);
    if (!k) outliers++;
    for (let i = 0; i < k; i++) lengths.push(g / k);
  }
  const cycles = lengths.length;
  if (cycles < MIN_CYCLES) return null;
  const interval = median(lengths);

  // The latest run of kills up to a break (double presses skipped), then the earliest projection from it.
  const last = t[t.length - 1];
  const run = [last];
  for (let i = t.length - 2; i >= 0 && run.length < PHASE_KILLS; i--) {
    const g = run[run.length - 1] - t[i];
    if (g < DOUBLE_PRESS_MS) continue;
    if (g > (MAX_CYCLES_PER_GAP + 0.5) * interval) break;
    run.push(t[i]);
  }
  let next = Infinity;
  for (const k of run) next = Math.min(next, k + (Math.round((last - k) / interval) + 1) * interval);
  // Never earlier than half a cycle after the last kill (a respawn can't be that quick).
  next = Math.max(next, last + interval / 2);
  return { interval, cycles, outliers, next: Math.round(next), last };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
