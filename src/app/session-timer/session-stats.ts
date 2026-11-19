import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { TimerItem, TimerSession } from '../models';
import { formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';
import { allTime, countersIn, cumulative, perHour, sessionElapsed, sessionSpan } from './session';
import { Bar, LineSeries, MAX_SERIES, SERIES_COLORS, SessionBarChart, SessionLineChart } from './session-charts';

/** Sessions shown in the all-time bar chart (the newest). */
const BAR_SESSIONS = 30;

/** "Nov 19, 2:05 PM": when a session started. */
export function sessionLabel(t: number): string {
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function rate(n: number | null): string {
  return n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** A Session timer's stats: one session (with its running-total chart) or all time (with a bar per session). */
@Component({
  selector: 'app-session-stats',
  imports: [SessionLineChart, SessionBarChart],
  templateUrl: './session-stats.html',
  styleUrl: './session-stats.scss',
})
export class SessionStats {
  readonly timer = input.required<TimerItem>();
  readonly closed = output<void>();
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);

  protected readonly scope = signal<'session' | 'all'>('session');
  protected readonly label = sessionLabel;
  protected readonly rate = rate;

  protected readonly sessions = computed(() => this.timer().sessions ?? []);
  /** Newest first, for the picker and the list. */
  protected readonly newestFirst = computed(() => [...this.sessions()].reverse());

  /** Every counter in this timer or its history, in a fixed order: a counter keeps its colour in every view. */
  protected readonly palette = computed(() => {
    const ids = [...this.store.countersIn(this.timer().id).map((c) => c.id), ...countersIn(this.sessions()).map((c) => c.id)];
    const order = [...new Set(ids)];
    return new Map(order.map((id, i) => [id, SERIES_COLORS[i % SERIES_COLORS.length]]));
  });

  /** A counter's current name (or the one it had in the session, if it's been deleted). */
  private nameOf(id: string, fallback: string): string {
    return this.store.counters().find((c) => c.id === id)?.name ?? fallback;
  }

  // ---------- one session ----------

  private readonly picked = signal<string | null>(null);

  protected readonly session = computed<TimerSession | null>(() => {
    const list = this.sessions();
    return list.find((s) => s.id === this.picked()) ?? list.at(-1) ?? null;
  });

  protected pick(id: string): void {
    this.picked.set(id);
    this.scope.set('session');
  }

  protected readonly one = computed(() => {
    const s = this.session();
    if (!s) return null;
    const now = this.store.now();
    const ms = sessionElapsed(s, now);
    const end = ms / 60_000;
    const rows = Object.entries(s.counts).map(([id, c]) => ({
      id,
      name: this.nameOf(id, c.name),
      color: this.palette().get(id) ?? SERIES_COLORS[0],
      total: c.total,
      perHour: perHour(c.total, ms),
      points: cumulative(c, end),
    }));
    const series: LineSeries[] = rows
      .filter((r) => r.points.length > 1 || r.total)
      .slice(0, MAX_SERIES)
      .map((r) => ({ id: r.id, name: r.name, color: r.color, points: r.points }));
    return {
      id: s.id,
      going: s.end === null,
      time: formatDuration(ms, false),
      paused: formatDuration(Math.max(0, sessionSpan(s, now) - ms), false),
      started: sessionLabel(s.start),
      ended: s.end === null ? (s.runningSince === null ? 'Paused' : 'Going') : sessionLabel(s.end),
      end,
      rows,
      series,
    };
  });

  // ---------- all time ----------

  protected readonly all = computed(() => {
    const now = this.store.now();
    const a = allTime(this.sessions(), now);
    const byId = new Map(this.sessions().map((s) => [s.id, s]));
    return {
      count: a.count,
      time: formatDuration(a.ms, false),
      average: a.count ? formatDuration(a.ms / a.count, false) : '—',
      counters: a.counters.map((c) => ({
        ...c,
        name: this.nameOf(c.id, c.name),
        color: this.palette().get(c.id) ?? SERIES_COLORS[0],
        best: c.best && byId.get(c.best.sessionId) ? { ...c.best, when: sessionLabel(byId.get(c.best.sessionId)!.start) } : null,
      })),
    };
  });

  /** The counter the bar chart shows, and whether as totals or per hour. */
  private readonly chosen = signal<string | null>(null);
  protected readonly measure = signal<'total' | 'rate'>('total');

  protected readonly barCounter = computed(() => {
    const list = this.all().counters;
    return list.find((c) => c.id === this.chosen()) ?? list[0] ?? null;
  });

  protected choose(id: string): void {
    this.chosen.set(id);
  }

  protected readonly bars = computed<Bar[]>(() => {
    const c = this.barCounter();
    if (!c) return [];
    const now = this.store.now();
    return this.sessions()
      .slice(-BAR_SESSIONS)
      .map((s) => {
        const ms = sessionElapsed(s, now);
        const total = s.counts[c.id]?.total ?? 0;
        const value = this.measure() === 'total' ? total : (perHour(total, ms) ?? 0);
        const d = new Date(s.start);
        return {
          id: s.id,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: Math.round(value * 10) / 10,
          detail: `${sessionLabel(s.start)} · ${formatDuration(ms, false)}`,
        };
      });
  });

  /** One line per session for the list: when, how long, and what was counted. */
  protected readonly list = computed(() => {
    const now = this.store.now();
    return this.newestFirst().map((s) => ({
      id: s.id,
      when: sessionLabel(s.start),
      going: s.end === null,
      time: formatDuration(sessionElapsed(s, now), false),
      counts: Object.entries(s.counts)
        .map(([id, c]) => `${this.nameOf(id, c.name)} ${c.total}`)
        .join(' · '),
    }));
  });

  // ---------- managing history ----------

  protected async deleteSession(id: string, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    const s = this.sessions().find((x) => x.id === id);
    if (!s) return;
    if (e.shiftKey || (await this.confirm.ask('Delete session?', `Delete the session from ${sessionLabel(s.start)} from the stats?`))) {
      this.store.deleteSession(this.timer().id, id);
      if (this.picked() === id) this.picked.set(null);
    }
  }

  protected async clearAll(): Promise<void> {
    const n = this.sessions().filter((s) => s.end !== null).length;
    if (await this.confirm.ask('Clear history?', `Delete all ${n} finished session${n === 1 ? '' : 's'} of "${this.timer().name}"? This can't be undone.`, 'Clear')) {
      this.store.clearSessions(this.timer().id);
      this.picked.set(null);
    }
  }
}
