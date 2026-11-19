import { SessionCount, SessionStatus, TimerItem, TimerSession } from '../models';

/** Sessions kept per Session timer; the oldest go first. */
export const MAX_SESSIONS = 500;

/** A session shorter than this, with nothing counted, isn't kept when it ends (a start clicked by mistake). */
export const KEEP_SESSION_MS = 5_000;

/** The session still going (not ended), if any. */
export function openSession(t: TimerItem): TimerSession | null {
  const last = t.sessions?.at(-1);
  return last && last.end === null ? last : null;
}

export function sessionStatus(t: TimerItem): SessionStatus {
  const s = openSession(t);
  if (!s) return 'idle';
  return s.runningSince === null ? 'paused' : 'running';
}

/** Time counted in a session (pauses don't count). */
export function sessionElapsed(s: TimerSession, now: number): number {
  return s.elapsedMs + (s.runningSince !== null ? Math.max(0, now - s.runningSince) : 0);
}

/** Wall-clock length of a session, start to end (or to now). */
export function sessionSpan(s: TimerSession, now: number): number {
  return Math.max(0, (s.end ?? now) - s.start);
}

export function newSession(id: string, now: number): TimerSession {
  return { id, start: now, end: null, elapsedMs: 0, runningSince: now, counts: {} };
}

export function pauseSession(s: TimerSession, now: number): TimerSession {
  if (s.runningSince === null) return s;
  return { ...s, elapsedMs: sessionElapsed(s, now), runningSince: null };
}

export function resumeSession(s: TimerSession, now: number): TimerSession {
  return s.runningSince === null && s.end === null ? { ...s, runningSince: now } : s;
}

export function endSession(s: TimerSession, now: number): TimerSession {
  return { ...pauseSession(s, now), end: now };
}

/** Whether an ended session is worth keeping: it ran a few seconds, or something was counted. */
export function worthKeeping(s: TimerSession): boolean {
  return s.elapsedMs >= KEEP_SESSION_MS || Object.values(s.counts).some((c) => c.marks.length > 0);
}

/** Adds a counter change to a session, in the minute of session time it happened. */
export function recordCount(s: TimerSession, counterId: string, name: string, delta: number, now: number): TimerSession {
  if (!delta) return s;
  const minute = Math.floor(sessionElapsed(s, now) / 60_000);
  const prev: SessionCount = s.counts[counterId] ?? { name, total: 0, marks: [] };
  const marks = [...prev.marks];
  const last = marks.at(-1);
  if (last && last[0] === minute) marks[marks.length - 1] = [minute, last[1] + delta];
  else marks.push([minute, delta]);
  return { ...s, counts: { ...s.counts, [counterId]: { name, total: prev.total + delta, marks } } };
}

/** Per hour of session time, or null when there's too little time to say (under a minute). */
export function perHour(total: number, ms: number): number | null {
  if (ms < 60_000) return null;
  return total / (ms / 3_600_000);
}

/**
 * A counter's running total through a session, for the line chart: [minute, total] at the start, after each minute
 * something changed, and at the end. Minutes of session time; `endMinute` (how long the session ran) may be fractional.
 */
export function cumulative(c: SessionCount | undefined, endMinute: number): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  let total = 0;
  for (const [m, d] of c?.marks ?? []) {
    total += d;
    // The change lands at the end of its minute (a click at 0:20 shows by 1:00), clamped to the end.
    out.push([Math.max(m, Math.min(m + 1, endMinute)), total]);
  }
  if (out.at(-1)![0] < endMinute) out.push([endMinute, total]);
  return out;
}

/** Every counter that appears in these sessions (id and latest name), in the order first seen. */
export function countersIn(sessions: TimerSession[]): { id: string; name: string }[] {
  const names = new Map<string, string>();
  for (const s of sessions) for (const [id, c] of Object.entries(s.counts)) names.set(id, c.name);
  return [...names].map(([id, name]) => ({ id, name }));
}

export interface CounterTotals {
  id: string;
  name: string;
  total: number;
  /** Over all the time counted in the sessions it was counted in. */
  perHour: number | null;
  /** The session with its highest total. */
  best: { sessionId: string; total: number } | null;
}

/** All-time numbers across sessions: time counted and each counter's total, rate and best session. */
export function allTime(sessions: TimerSession[], now: number): { count: number; ms: number; counters: CounterTotals[] } {
  const ms = sessions.reduce((n, s) => n + sessionElapsed(s, now), 0);
  const counters = countersIn(sessions).map(({ id, name }) => {
    let total = 0;
    let time = 0;
    let best: CounterTotals['best'] = null;
    for (const s of sessions) {
      const c = s.counts[id];
      if (!c) continue;
      total += c.total;
      time += sessionElapsed(s, now);
      if (!best || c.total > best.total) best = { sessionId: s.id, total: c.total };
    }
    return { id, name, total, perHour: perHour(total, time), best };
  });
  return { count: sessions.length, ms, counters };
}

/** Sessions as saved (any version): well-formed ones only, at most MAX_SESSIONS, and at most one still going (the last). */
export function normalizeSessions(raw: unknown): TimerSession[] {
  if (!Array.isArray(raw)) return [];
  const out: TimerSession[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !Number.isFinite(s.start)) continue;
    const counts: Record<string, SessionCount> = {};
    if (s.counts && typeof s.counts === 'object') {
      for (const [id, c] of Object.entries<any>(s.counts)) {
        if (!c || typeof c.name !== 'string' || !Array.isArray(c.marks)) continue;
        const marks = c.marks.filter((m: unknown) => Array.isArray(m) && Number.isFinite(m[0]) && Number.isFinite(m[1])) as [number, number][];
        counts[id] = { name: c.name, total: marks.reduce((n, m) => n + m[1], 0), marks };
      }
    }
    out.push({
      id: s.id,
      start: s.start,
      end: Number.isFinite(s.end) ? s.end : null,
      elapsedMs: Math.max(0, Number(s.elapsedMs) || 0),
      runningSince: Number.isFinite(s.runningSince) ? s.runningSince : null,
      counts,
    });
  }
  // Only the newest can still be going; any older open one is closed where it got to.
  for (let i = 0; i < out.length - 1; i++) {
    const s = out[i];
    if (s.end === null) out[i] = { ...s, end: s.runningSince ?? s.start + s.elapsedMs, runningSince: null };
  }
  return out.slice(-MAX_SESSIONS);
}
