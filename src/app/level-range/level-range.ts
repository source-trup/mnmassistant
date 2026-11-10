/** Highest character level. */
export const LEVEL_CAP = 60;

/**
 * How many levels above you a group can reach, by the group's lowest level.
 * Levels 1–13 get 5; from 14 up it's half your level minus one (14 → 6, 16 → 7, … 41 → 19).
 */
export function levelDiff(minLevel: number): number {
  return minLevel <= 13 ? 5 : Math.floor(minLevel / 2) - 1;
}

/** Highest level that can group with someone of `level`. */
export function highestPartner(level: number): number {
  return Math.min(LEVEL_CAP, level + levelDiff(level));
}

/** Lowest level that can group with someone of `level` (the lowest level whose range still reaches it). */
export function lowestPartner(level: number): number {
  for (let l = 1; l <= level; l++) if (highestPartner(l) >= level) return l;
  return level;
}

export interface LevelRow {
  min: number;
  diff: number;
  max: number;
}

/** The chart: every lowest level up to the one whose range reaches the level cap. */
export const LEVEL_CHART: LevelRow[] = (() => {
  const rows: LevelRow[] = [];
  for (let min = 1; ; min++) {
    rows.push({ min, diff: levelDiff(min), max: highestPartner(min) });
    if (min + levelDiff(min) >= LEVEL_CAP) return rows;
  }
})();
