import { expect, test } from '@playwright/test';
import { estimateRespawn } from '../../src/app/counter-card/respawn';

const MIN = 60_000;
/** Kill times, in minutes from 0. */
const at = (...minutes: number[]) => minutes.map((m) => m * MIN);

test.describe('respawn estimate', () => {
  test('needs a few respawns first', () => {
    expect(estimateRespawn([])).toBeNull();
    expect(estimateRespawn(at(0, 10, 20))).toBeNull(); // two cycles
    expect(estimateRespawn(at(0, 10, 20, 30))).not.toBeNull();
  });

  test('a steady camp: the interval, and the next spawn one interval after the last kill', () => {
    const e = estimateRespawn(at(0, 10, 20, 30, 40))!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.cycles).toBe(4);
    expect(e.next).toBe(50 * MIN);
    expect(e.last).toBe(40 * MIN);
  });

  test('a late press: the next spawn stays on the rhythm, not the press', () => {
    // Spawns every 10 min; the kill at 40 was pressed 2 minutes late.
    const e = estimateRespawn(at(0, 10, 20, 30, 42))!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.next).toBe(50 * MIN);
  });

  test('a late press followed by an on-time one keeps the interval', () => {
    const e = estimateRespawn(at(0, 10, 20, 32, 40, 50))!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.next).toBe(60 * MIN);
  });

  test('a kill that was never logged counts as two cycles', () => {
    const e = estimateRespawn(at(0, 10, 20, 40, 50))!;
    expect(e.interval).toBe(10 * MIN);
    expect(e.cycles).toBe(5);
    expect(e.next).toBe(60 * MIN);
  });

  test('a 6 minute camp: a 12 minute gap is a missed spawn, a 9 minute gap is an outlier', () => {
    const e = estimateRespawn(at(0, 6, 12, 24, 30, 39, 45))!;
    expect(e.interval).toBe(6 * MIN);
    expect(e.cycles).toBe(6); // 6, 6, 12 (as two), 6, 6
    expect(e.outliers).toBe(1); // the 9
    expect(e.next).toBe(51 * MIN);
  });

  test('a late press on a 6 minute camp is left out of the interval but corrected in the next spawn', () => {
    // Spawns every 6; the kill at 24 was pressed at 26.
    const e = estimateRespawn(at(0, 6, 12, 18, 26))!;
    expect(e.interval).toBe(6 * MIN);
    expect(e.outliers).toBe(1);
    expect(e.next).toBe(30 * MIN);
  });

  test('breaks and double presses are left out', () => {
    // A 2-hour break, then a steady camp with one double press (at 140 + 5s).
    const e = estimateRespawn([...at(0, 10, 20, 140, 150, 160), 160 * MIN + 5_000, 170 * MIN])!;
    expect(e.interval).toBe(10 * MIN);
    // The break ends the run used for the next spawn; the double press is skipped.
    expect(e.next).toBe(180 * MIN);
  });

  test('unordered input is fine, and the slower average of a sluggish camp is kept', () => {
    const e = estimateRespawn(at(36, 0, 12, 24, 48))!;
    expect(e.interval).toBe(12 * MIN);
    expect(e.next).toBe(60 * MIN);
  });
});
