import { expect, test } from '@playwright/test';
import { TimerItem, TimerSession } from '../../src/app/models';
import {
  allTime,
  cumulative,
  endSession,
  newSession,
  normalizeSessions,
  openSession,
  pauseSession,
  perHour,
  recordCount,
  resumeSession,
  sessionElapsed,
  sessionStatus,
  worthKeeping,
} from '../../src/app/session-timer/session';
import { minuteTicks, niceTicks } from '../../src/app/session-timer/session-charts';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

const timer = (sessions: TimerSession[]): TimerItem => ({
  id: 't',
  name: 'Session',
  autoNamed: true,
  durationMs: 0,
  endsAt: null,
  pausedRemainingMs: null,
  repeat: false,
  x: 0,
  y: 0,
  mode: 'session',
  sessions,
});

test.describe('Session timer sessions', () => {
  test('time counts while running, not while paused', () => {
    let s = newSession('a', T0);
    expect(sessionElapsed(s, T0 + 10 * MIN)).toBe(10 * MIN);
    s = pauseSession(s, T0 + 10 * MIN);
    expect(sessionElapsed(s, T0 + 30 * MIN)).toBe(10 * MIN);
    s = resumeSession(s, T0 + 30 * MIN);
    expect(sessionElapsed(s, T0 + 35 * MIN)).toBe(15 * MIN);
    s = endSession(s, T0 + 40 * MIN);
    expect(s.end).toBe(T0 + 40 * MIN);
    expect(s.runningSince).toBeNull();
    expect(sessionElapsed(s, T0 + 99 * MIN)).toBe(20 * MIN);
  });

  test('status follows the last session', () => {
    expect(sessionStatus(timer([]))).toBe('idle');
    const going = newSession('a', T0);
    expect(sessionStatus(timer([going]))).toBe('running');
    expect(sessionStatus(timer([pauseSession(going, T0 + MIN)]))).toBe('paused');
    expect(sessionStatus(timer([endSession(going, T0 + MIN)]))).toBe('idle');
    expect(openSession(timer([endSession(going, T0 + MIN)]))).toBeNull();
  });

  test('counts land in the minute of session time they happened, merged per minute', () => {
    let s = newSession('a', T0);
    s = recordCount(s, 'k', 'Kills', 1, T0 + 10_000);
    s = recordCount(s, 'k', 'Kills', 1, T0 + 50_000);
    s = recordCount(s, 'k', 'Kills', 1, T0 + 3 * MIN + 1);
    s = pauseSession(s, T0 + 4 * MIN);
    // While paused, session time stands still: a count 20 minutes later is still minute 4.
    s = recordCount(s, 'k', 'Kills', -1, T0 + 24 * MIN);
    expect(s.counts['k']).toEqual({ name: 'Kills', total: 2, marks: [[0, 2], [3, 1], [4, -1]] });
    expect(recordCount(s, 'k', 'Kills', 0, T0)).toBe(s);
  });

  test('running total for the chart', () => {
    const c = { name: 'Kills', total: 3, marks: [[0, 2], [3, 1]] as [number, number][] };
    expect(cumulative(c, 10)).toEqual([[0, 0], [1, 2], [4, 3], [10, 3]]);
    // A change in the last, unfinished minute shows at the end, not past it.
    expect(cumulative(c, 3.5)).toEqual([[0, 0], [1, 2], [3.5, 3]]);
    expect(cumulative(undefined, 5)).toEqual([[0, 0], [5, 0]]);
  });

  test('per hour needs at least a minute', () => {
    expect(perHour(10, 30 * MIN)).toBe(20);
    expect(perHour(10, 30_000)).toBeNull();
  });

  test('a start clicked by mistake is not worth keeping', () => {
    const s = endSession(newSession('a', T0), T0 + 2000);
    expect(worthKeeping(s)).toBe(false);
    expect(worthKeeping(recordCount(s, 'k', 'Kills', 1, T0))).toBe(true);
    expect(worthKeeping(endSession(newSession('b', T0), T0 + MIN))).toBe(true);
  });

  test('all time: totals, rate over the sessions it was in, and the best session', () => {
    let a = recordCount(newSession('a', T0), 'k', 'Kills', 30, T0 + MIN);
    a = endSession(a, T0 + 60 * MIN);
    let b = recordCount(newSession('b', T0 + 100 * MIN), 'k', 'Kills', 50, T0 + 101 * MIN);
    b = recordCount(b, 'l', 'Loot', 4, T0 + 102 * MIN);
    b = endSession(b, T0 + 130 * MIN);
    const r = allTime([a, b], T0 + 200 * MIN);
    expect(r.count).toBe(2);
    expect(r.ms).toBe(90 * MIN);
    expect(r.counters).toEqual([
      { id: 'k', name: 'Kills', total: 80, perHour: 80 / 1.5, best: { sessionId: 'b', total: 50 } },
      { id: 'l', name: 'Loot', total: 4, perHour: 8, best: { sessionId: 'b', total: 4 } },
    ]);
  });

  test('saved sessions are cleaned up: bad ones dropped, totals from the marks, only the last one still going', () => {
    const out = normalizeSessions([
      null,
      { id: 'x' },
      { id: 'a', start: T0, end: null, elapsedMs: 5 * MIN, runningSince: null, counts: { k: { name: 'Kills', total: 99, marks: [[0, 2], 'bad', [1, 3]] } } },
      { id: 'b', start: T0 + HOUR(1), end: null, elapsedMs: 0, runningSince: T0 + HOUR(1), counts: {} },
    ]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
    expect(out[0].end).toBe(T0 + 5 * MIN);
    expect(out[0].counts['k']).toEqual({ name: 'Kills', total: 5, marks: [[0, 2], [1, 3]] });
    expect(out[1].end).toBeNull();
    expect(normalizeSessions('nope')).toEqual([]);
  });
});

test.describe('chart ticks', () => {
  test('round value ticks from 0', () => {
    expect(niceTicks(0, 7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(-3, 9)).toEqual([-5, 0, 5, 10]);
  });

  test('minute ticks with a round step', () => {
    expect(minuteTicks(10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(minuteTicks(95)).toEqual([0, 30, 60, 90]);
    expect(minuteTicks(0.5)).toEqual([0]);
  });
});

function HOUR(n: number): number {
  return n * 60 * MIN;
}
