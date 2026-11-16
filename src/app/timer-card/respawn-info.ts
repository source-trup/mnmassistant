import { Component, computed, inject, input } from '@angular/core';
import { estimateRespawn } from '../counter-card/respawn';
import { TimerItem } from '../models';
import { formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';

/** Differences smaller than this read as "matches the timer". */
const SAME_MS = 15_000;

/**
 * For a timer linked to a Named / PH camp: the camp's average respawn, when the next spawn is expected (local time),
 * and how that compares with the timer. Shows nothing until the camp has a few kills logged.
 */
@Component({
  selector: 'app-respawn-info',
  template: `
    @if (info(); as i) {
      <div class="respawn" [title]="i.tip">
        <span class="avg">⟳ avg {{ i.avg }}</span>
        @if (i.next) {
          <span class="next">next ≈ {{ i.next }}</span>
        }
        @if (i.diff) {
          <span class="diff" [attr.data-dir]="i.dir">{{ i.diff }}</span>
        }
      </div>
    }
  `,
  styles: `
    .respawn {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2px 10px;
      font-size: 0.72rem;
      line-height: 1.25;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .next {
      color: var(--text);
    }
    .diff[data-dir='early'] {
      color: var(--paused);
    }
    .diff[data-dir='late'] {
      color: var(--running);
    }
  `,
})
export class RespawnInfo {
  readonly timer = input.required<TimerItem>();
  private readonly store = inject(TrackerStore);

  /** The Named / PH camp that restarts this timer. */
  private readonly camp = computed(() =>
    this.store.counters().find((c) => c.linkedTimerId === this.timer().id && c.kind === 'namedPh'),
  );

  private readonly estimate = computed(() => {
    const c = this.camp();
    return c ? estimateRespawn(this.store.historyOf(c).map((e) => e.t)) : null;
  });

  protected readonly info = computed(() => {
    const est = this.estimate();
    if (!est) return null;
    const now = this.store.now();
    const t = this.timer();
    const avg = formatDuration(est.interval, false);
    // Only for the cycle in progress: after a long break the old rhythm says nothing about the next spawn.
    const current = now < est.last + 2 * est.interval;
    const next = current ? localTime(est.next) + (now > est.next ? ` (${formatDuration(now - est.next, false)} ago)` : '') : '';

    let diff = '';
    let dir: 'early' | 'late' | 'same' = 'same';
    if (current && t.endsAt !== null && t.pausedRemainingMs === null) {
      const d = est.next - t.endsAt;
      if (Math.abs(d) < SAME_MS) diff = 'matches timer';
      else {
        dir = d < 0 ? 'early' : 'late';
        diff = `${formatDuration(Math.abs(d), false)} ${d < 0 ? 'before' : 'after'} timer`;
      }
    }

    const tip =
      `Average respawn ${avg}: the typical time between spawns, from ${est.cycles} respawns in this camp's kill log. ` +
      `A gap of two or three respawns counts as spawns not logged` +
      (est.outliers ? `; ${est.outliers} odd gap${est.outliers === 1 ? '' : 's'} (late presses, breaks) left out.` : '.') +
      (next ? `\nNext spawn expected about ${localTime(est.next)}, from the rhythm of the last few kills.` : '') +
      (diff && dir !== 'same' ? `\nThat's ${diff}: the timer runs from your last press.` : '');
    return { avg, next, diff, dir, tip };
  });
}

function localTime(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
