import { Component, computed, inject, input } from '@angular/core';
import { NamedPhCounter, TimerItem, TimerStatus } from '../models';
import { formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';
import { RespawnInfo } from '../timer-card/respawn-info';
import { timerStatus } from '../timer-card/timer-face';
import { PopoutService } from './popout.service';

const NO_TIMER: TimerItem = { id: '', name: '', autoNamed: true, durationMs: 0, endsAt: null, pausedRemainingMs: null, repeat: false, x: -1, y: -1 };

/**
 * A Named / PH timer in a compact layout for the pop-out window: the countdown on top, then the camp's counts and
 * kill buttons (which restart the countdown, as on the board).
 */
@Component({
  selector: 'app-camp-pop-card',
  imports: [RespawnInfo],
  template: `
    <div class="card" [attr.data-status]="status()">
      <div class="head">
        <span class="name" [title]="camp().name">{{ camp().name }}</span>
        <button class="icon" (click)="popout.dock(camp().id)" title="Put back on the board">⤓</button>
      </div>

      <div class="clock-row">
        <button class="clock" (click)="primary()" [title]="status() === 'idle' ? 'Start' : status() === 'paused' ? 'Resume' : 'Restart'">
          <span class="time">{{ status() === 'done' ? 'READY' : display() }}</span>
          <span class="sub">
            @switch (status()) {
              @case ('idle') { click to start · {{ duration() }} }
              @case ('running') { click to restart }
              @case ('paused') { paused · click to resume }
              @case ('done') { {{ overtime() }} · click to restart }
            }
          </span>
        </button>
        @if (status() === 'running') {
          <button class="small" (click)="store.pauseTimer(timer().id)" title="Pause">❚❚</button>
        }
      </div>
      <app-respawn-info [camp]="camp()" />
      <div class="bar"><span class="fill" [style.width.%]="progress() * 100"></span></div>

      <div class="camp">
        <span class="counts" [title]="camp().phSinceNamed + ' PH since the last named'">
          <span class="ph" title="Placeholders">PH <b>{{ camp().ph }}</b></span>
          <span class="named" title="Named">N <b>{{ camp().named }}</b></span>
        </span>
        <button class="kill ph" (click)="store.phKill(camp().id)" title="+1 PH and restart the countdown">+ PH</button>
        <button class="kill named" (click)="store.namedKill(camp().id)" title="+1 named and restart the countdown">+ Named</button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      --accent: var(--idle);
      background: var(--panel);
      border: 1px solid var(--border);
      border-left: 4px solid var(--accent);
      border-radius: 8px;
      padding: 6px 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;

      &[data-status='running'] { --accent: var(--running); }
      &[data-status='paused'] { --accent: var(--paused); }
      &[data-status='done'] {
        --accent: var(--done);
        animation: pulse 1.2s ease-in-out infinite;
      }
    }
    @keyframes pulse {
      50% {
        background: var(--done-bg);
        box-shadow: 0 0 22px rgb(255 107 107 / 0.35);
      }
    }
    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--bone);
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tag {
      font-size: 0.8rem;
    }
    .clock-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .clock {
      flex: 1;
      display: flex;
      align-items: baseline;
      gap: 10px;
      background: none;
      border: none;
      padding: 0;
      color: var(--accent);
      text-align: left;
    }
    .time {
      font-size: 2rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .sub {
      font-size: 0.75rem;
      color: var(--muted);
    }
    .small {
      padding: 2px 8px;
      font-size: 0.75rem;
    }
    .bar {
      height: 4px;
      border-radius: 2px;
      background: var(--spirit-soft);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      background: var(--accent);
    }
    .camp {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
    }
    .counts {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      b {
        font-size: 1.15rem;
        font-variant-numeric: tabular-nums;
      }
      .ph b {
        color: var(--counter);
      }
      .named b {
        color: var(--named);
      }
    }
    .kill {
      padding: 4px 10px;
      font-weight: 600;
      &.ph {
        background: var(--counter-bg);
        border-color: var(--spirit-line);
      }
      &.named {
        background: var(--named-bg);
        border-color: var(--named);
        color: var(--named);
      }
    }
  `,
})
export class CampPopCard {
  readonly camp = input.required<NamedPhCounter>();
  protected readonly store = inject(TrackerStore);
  protected readonly popout = inject(PopoutService);

  protected readonly timer = computed(() => this.store.campTimer(this.camp()) ?? NO_TIMER);
  protected readonly status = computed<TimerStatus>(() => timerStatus(this.timer(), this.store.now()));

  private readonly remainingMs = computed(() => {
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
  protected readonly duration = computed(() => formatDuration(this.timer().durationMs));
  protected readonly overtime = computed(() => {
    const t = this.timer();
    return t.endsAt === null ? '' : '+' + formatDuration(this.store.now() - t.endsAt, false);
  });
  protected readonly progress = computed(() => {
    const d = this.timer().durationMs;
    return d > 0 ? Math.min(1, Math.max(0, this.remainingMs() / d)) : 0;
  });

  protected primary(): void {
    if (this.status() === 'paused') this.store.resumeTimer(this.timer().id);
    else this.store.startTimer(this.timer().id);
  }
}
