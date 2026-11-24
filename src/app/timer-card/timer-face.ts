import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { TimerItem, TimerStatus } from '../models';
import { formatDuration, parseDuration } from '../time';
import { TrackerStore } from '../tracker.store';

/** Where a countdown is: not started, counting down, paused, or reached zero. */
export function timerStatus(t: TimerItem, now: number): TimerStatus {
  if (t.pausedRemainingMs !== null) return 'paused';
  if (t.endsAt === null) return 'idle';
  return t.endsAt <= now ? 'done' : 'running';
}

/** Inside its "Warn at" time: counting down, with no more than that left (and the warning shorter than the countdown). */
export function inWarning(t: TimerItem, now: number): boolean {
  if (!t.warnMs || t.warnMs >= t.durationMs || t.endsAt === null || t.pausedRemainingMs !== null) return false;
  const left = t.endsAt - now;
  return left > 0 && left <= t.warnMs;
}

/**
 * A countdown's face: the big clock (click to start or restart, right-click to type the time left), the progress bar
 * and −1m / Pause / +1m / Reset. Shared by the Timer and Named / PH timer panels, which add their own header around
 * it. Anything placed inside it shows between the clock and the bar.
 */
@Component({
  selector: 'app-timer-face',
  template: `
    <div class="clock-wrap">
      <button
        class="clock"
        (click)="primary()"
        (contextmenu)="editRemaining($event)"
        [title]="(status() === 'idle' ? 'Start' : 'Restart') + ' · right-click to set the time left'"
      >
        <span class="time" [class.hidden]="editing()">{{ status() === 'done' ? 'READY' : display() }}</span>
        <span class="sub">
          @switch (status()) {
            @case ('idle') { click to start · {{ durationText() }} }
            @case ('running') { click to restart }
            @case ('paused') { paused · click to resume }
            @case ('done') { {{ overtime() }} · click to restart }
          }
        </span>
      </button>
      @if (editing()) {
        <input
          #left
          class="time-edit"
          [value]="editStart"
          placeholder="4:30"
          title="Time left — Enter to set, Esc to cancel"
          (keydown.enter)="applyRemaining(left)"
          (keydown.escape)="editing.set(false)"
          (blur)="applyRemaining(left)"
        />
      }
    </div>

    <ng-content />
    <div class="bar"><div class="fill" [style.width.%]="progress() * 100"></div></div>

    <div class="actions">
      <button (click)="store.adjustTimer(timer().id, -60000)" [title]="adjustTitle('Subtract')">−1m</button>
      @if (status() === 'running') {
        <button (click)="store.pauseTimer(timer().id)">Pause</button>
      } @else if (status() === 'paused') {
        <button (click)="store.resumeTimer(timer().id)">Resume</button>
      }
      <button (click)="store.adjustTimer(timer().id, 60000)" [title]="adjustTitle('Add')">+1m</button>
      @if (status() !== 'idle') {
        <button (click)="store.resetTimer(timer().id)" title="Stop the countdown">Reset</button>
      }
    </div>
  `,
  styleUrl: './timer-face.scss',
})
export class TimerFace {
  readonly timer = input.required<TimerItem>();
  protected readonly store = inject(TrackerStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly status = computed<TimerStatus>(() => timerStatus(this.timer(), this.store.now()));

  protected readonly remainingMs = computed(() => {
    const t = this.timer();
    switch (this.status()) {
      case 'paused':
        return t.pausedRemainingMs!;
      case 'running':
        return t.endsAt! - this.store.now();
      case 'done':
        return 0;
      default:
        return t.durationMs;
    }
  });

  protected readonly display = computed(() => formatDuration(this.remainingMs()));

  /** How long ago it finished (useful for "spawned X ago"). */
  protected readonly overtime = computed(() => {
    const t = this.timer();
    if (this.status() !== 'done' || t.endsAt === null) return '';
    return '+' + formatDuration(this.store.now() - t.endsAt, false);
  });

  protected readonly progress = computed(() => {
    const d = this.timer().durationMs;
    return d > 0 ? Math.min(1, Math.max(0, this.remainingMs() / d)) : 0;
  });

  protected readonly durationText = computed(() => formatDuration(this.timer().durationMs));

  /** Clicking the big clock: resume if paused, otherwise (re)start. */
  protected primary(): void {
    if (this.status() === 'paused') this.store.resumeTimer(this.timer().id);
    else this.store.startTimer(this.timer().id);
  }

  /** Whether the time-left box is open. */
  protected readonly editing = signal(false);
  /** Time left when the box opened (a snapshot, so the ticking countdown doesn't overwrite what you type). */
  protected editStart = '';

  /** Right-click on the clock: type how long is actually left. */
  protected editRemaining(e: MouseEvent): void {
    e.preventDefault();
    const s = this.status();
    this.editStart = s === 'running' || s === 'paused' ? this.display() : '';
    this.editing.set(true);
    afterNextRender(
      () => {
        const box = this.host.nativeElement.querySelector<HTMLInputElement>('.time-edit');
        box?.focus();
        box?.select();
      },
      { injector: this.injector },
    );
  }

  protected applyRemaining(input: HTMLInputElement): void {
    if (!this.editing()) return; // already applied (Enter, then blur)
    const text = input.value.trim();
    if (text) {
      const ms = parseDuration(text);
      if (ms === null || ms <= 0) {
        input.classList.add('invalid');
        input.select();
        return;
      }
      this.store.setTimerRemaining(this.timer().id, ms);
    }
    this.editing.set(false);
  }

  protected adjustTitle(verb: 'Add' | 'Subtract'): string {
    const s = this.status();
    const what = s === 'running' || s === 'paused' ? 'remaining time' : 'timer duration';
    return `${verb} 1 minute (${what})`;
  }
}
