/**
 * The estimated time between spawns, from a camp's kill log.
 *
 * The log only records when the button was pressed, and a press can be late (finishing a fight, looting first) but
 * never early. A plain average of the gaps is pulled up by every late press and wrecked by a missed spawn or a break,
 * so instead:
 *  1. Double presses (a few seconds apart) are merged.
 *  2. Each gap is read as a whole number of respawns (1 to 3) of a first guess (the gap that explains the most other
 *     gaps that way, so a log where most spawns were missed still finds the real respawn): 12 min on a 6 min
 *     camp is two respawns, one not logged. A gap that's halfway between (9 min on a 6 min camp) or too long (a break)
 *     can't be placed; it splits the log into separate runs and is left out.
 *  3. Within each run every kill gets its respawn number, and every pair of kills in the run gives an interval
 *     (time apart ÷ respawns apart). The estimate is the middle of all of those (a Theil–Sen fit). Pairs far apart
 *     dominate, and a late press is just one point, so it shifts the estimate very little.
 *  4. The fit is run a second time from its own result, to place gaps that the first guess got wrong.
 */

export interface RespawnEstimate {
  /** Estimated time from one spawn to the next, in ms (to the second). */
  interval: number;
  /** How many respawns the estimate is based on. */
  cycles: number;
  /** Gaps left out or treated as late presses (more than 20% off a whole number of respawns; breaks included). */
  outliers: number;
  /** How far a single respawn usually is from the estimate (median absolute difference, ms): late presses mostly. */
  spread: number;
  /** The latest logged kill (epoch ms). */
  last: number;
}

/** Fewest respawns before an estimate is shown. */
export const MIN_CYCLES = 3;
/** Only the most recent kills count (camps and spawn timers change). */
const RECENT_KILLS = 40;
/** Gaps shorter than this are a second press for the same kill. */
const DOUBLE_PRESS_MS = 15_000;
/** A gap of up to this many respawns can be placed (spawns not logged in between); longer is a break. */
const MAX_CYCLES_PER_GAP = 3;
/** How far a gap may be from a whole number of respawns (share of one respawn) and still be placed in its run. */
const PLACE_TOLERANCE = 0.35;
/** Beyond this share of a respawn, a placed gap still counts as an outlier (a late press). */
const TOLERANCE = 0.2;

interface Fit {
  interval: number;
  cycles: number;
  outliers: number;
  spread: number;
}

export function estimateRespawn(times: readonly number[]): RespawnEstimate | null {
  const sorted = [...times].sort((a, b) => a - b).slice(-RECENT_KILLS);
  const kills: number[] = [];
  for (const t of sorted) if (!kills.length || t - kills[kills.length - 1] >= DOUBLE_PRESS_MS) kills.push(t);
  if (kills.length <= MIN_CYCLES) return null;

  const gaps = kills.slice(1).map((t, i) => t - kills[i]);
  let fit = fitRuns(kills, firstGuess(gaps));
  if (fit) fit = fitRuns(kills, fit.interval) ?? fit;
  if (!fit || fit.cycles < MIN_CYCLES) return null;
  return { ...fit, interval: Math.round(fit.interval / 1000) * 1000, last: kills[kills.length - 1] };
}

/**
 * The gap that explains the most other gaps as whole respawns (1 to 3 of it). On a tie the longer one wins, so a
 * steady 10 minute camp isn't read as a 5 minute camp with every other spawn missed.
 */
function firstGuess(gaps: number[]): number {
  let best = { gap: median(gaps), placed: -1, cycles: Infinity };
  for (const c of gaps) {
    let placed = 0;
    let cycles = 0;
    for (const g of gaps) {
      const k = Math.round(g / c);
      if (k >= 1 && k <= MAX_CYCLES_PER_GAP && Math.abs(g / k - c) <= TOLERANCE * c) {
        placed++;
        cycles += k;
      }
    }
    if (placed > best.placed || (placed === best.placed && cycles < best.cycles)) best = { gap: c, placed, cycles };
  }
  return best.gap;
}

/** Splits the kills into runs whose gaps are whole respawns of `guess`, then fits one interval across all runs. */
function fitRuns(kills: number[], guess: number): Fit | null {
  if (!(guess > 0)) return null;
  const runs: { t: number; n: number }[][] = [[{ t: kills[0], n: 0 }]];
  const perCycle: number[] = [];
  let cycles = 0;
  let outliers = 0;
  for (let i = 1; i < kills.length; i++) {
    const g = kills[i] - kills[i - 1];
    const k = Math.round(g / guess);
    const run = runs[runs.length - 1];
    if (k < 1 || k > MAX_CYCLES_PER_GAP || Math.abs(g - k * guess) > PLACE_TOLERANCE * guess) {
      outliers++;
      runs.push([{ t: kills[i], n: 0 }]);
      continue;
    }
    if (Math.abs(g / k - guess) > TOLERANCE * guess) outliers++;
    run.push({ t: kills[i], n: run[run.length - 1].n + k });
    cycles += k;
    perCycle.push(g / k);
  }

  const slopes: number[] = [];
  for (const run of runs) {
    for (let a = 0; a < run.length; a++) {
      for (let b = a + 1; b < run.length; b++) slopes.push((run[b].t - run[a].t) / (run[b].n - run[a].n));
    }
  }
  if (!slopes.length) return null;
  const interval = median(slopes);
  return { interval, cycles, outliers, spread: median(perCycle.map((p) => Math.abs(p - interval))) };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
