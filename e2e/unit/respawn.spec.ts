import { expect, test } from '@playwright/test';
import { estimateRespawn } from '../../src/app/counter-card/respawn';

const MIN = 60_000;
const SEC = 1000;
/** Kill times, in minutes from 0. */
const at = (...minutes: number[]) => minutes.map((m) => m * MIN);

test.describe('respawn estimate', () => {
  test('needs a few respawns first', () => {
    expect(estimateRespawn([])).toBeNull();
    expect(estimateRespawn(at(0, 10, 20))).toBeNull(); // two respawns
    expect(estimateRespawn(at(0, 10, 20, 30))).not.toBeNull();
  });

  test('a steady camp', () => {
    const e = estimateRespawn(at(0, 10, 20, 30, 40))!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.cycles).toBe(4);
    expect(e.outliers).toBe(0);
    expect(e.spread).toBe(0);
    expect(e.last).toBe(40 * MIN);
  });

  test('a late press barely moves it', () => {
    // Spawns every 10 min; the kill at 40 was pressed 2 minutes late.
    expect(estimateRespawn(at(0, 10, 20, 30, 42))!.interval).toBe(10 * MIN);
    // Late, then back on time: the long gap and the short one don't count against it.
    expect(estimateRespawn(at(0, 10, 20, 32, 40, 50))!.interval).toBe(10 * MIN);
  });

  test('a kill that was never logged counts as two respawns', () => {
    const e = estimateRespawn(at(0, 10, 20, 40, 50))!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.cycles).toBe(5);
  });

  test('a 6 minute camp: a 12 minute gap is a missed spawn, a 9 minute gap is left out', () => {
    const e = estimateRespawn(at(0, 6, 12, 24, 30, 39, 45))!;
    expect(e.interval).toBe(6 * MIN);
    expect(e.cycles).toBe(6); // 6, 6, 12 (as two), 6, then 6 after the 9
    expect(e.outliers).toBe(1); // the 9
  });

  test('late presses on a 6 minute camp are counted as outliers but kept in the fit', () => {
    // Spawns every 6; the kill at 24 was pressed at 26.
    const e = estimateRespawn(at(0, 6, 12, 18, 26))!;
    expect(e.interval).toBe(6 * MIN);
    expect(e.outliers).toBe(1);
  });

  test('breaks and double presses are left out', () => {
    // A 2-hour break, then a steady camp with one double press (at 160 + 5s).
    const e = estimateRespawn([...at(0, 10, 20, 140, 150, 160), 160 * MIN + 5_000, 170 * MIN])!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.cycles).toBe(5);
    expect(e.outliers).toBe(1); // the break
  });

  test('unordered input is fine', () => {
    expect(estimateRespawn(at(36, 0, 12, 24, 48))!.interval).toBe(12 * MIN);
  });

  test('finds the real respawn under everyday late presses, closer than a plain average', () => {
    // A 6:40 respawn, pressed 0–45 s late each time (a fight, looting), with one spawn not logged.
    const spawn = 400 * SEC;
    const delays = [5, 30, 0, 45, 10, 20, 2, 40, 8, 15, 0, 35].map((s) => s * SEC);
    const times = delays.map((d, i) => (i >= 6 ? i + 1 : i) * spawn + d);
    const e = estimateRespawn(times)!;
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    const plainAverage = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(Math.abs(e.interval - spawn)).toBeLessThanOrEqual(5 * SEC);
    expect(Math.abs(plainAverage - spawn)).toBeGreaterThan(30 * SEC); // the missed spawn throws it off
    expect(e.cycles).toBe(12);
    expect(e.spread).toBeGreaterThan(0);
  });

  test('a first guess thrown off by many missed spawns is corrected', () => {
    // A 5 minute camp where most gaps are two respawns (every other spawn not logged).
    const e = estimateRespawn(at(0, 10, 20, 25, 35, 45, 50, 60))!;
    expect(e.interval).toBe(5 * MIN);
  });
});
