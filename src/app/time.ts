/**
 * Parses a duration typed by the user. Accepted forms:
 *   "5"        -> 5 minutes
 *   "6:40"     -> 6 min 40 s
 *   "1:30:00"  -> 1 h 30 min
 *   "90s", "5m", "1h30m", "2m 15s"
 * Returns milliseconds, or null if it can't be parsed / is zero.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  let seconds: number | null = null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    seconds = parseFloat(s) * 60;
  } else if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    seconds = s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
  } else {
    const m = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/.exec(s);
    if (m && (m[1] || m[2] || m[3])) {
      seconds =
        parseFloat(m[1] ?? '0') * 3600 + parseFloat(m[2] ?? '0') * 60 + parseFloat(m[3] ?? '0');
    }
  }

  if (seconds === null || !isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds * 1000);
}

/** Compact elapsed time: "45s", "12m", "2h 14m", "3d 4h". */
export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Local clock time, with the date prepended when it isn't today. */
export function formatClock(t: number): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

/** Formats ms as m:ss or h:mm:ss. Rounds up so a countdown shows 0:01 until it truly ends. */
export function formatDuration(ms: number, roundUp = true): string {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
