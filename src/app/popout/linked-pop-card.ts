import { Component, computed, inject, input } from '@angular/core';
import { CounterItem, TimerItem, TimerStatus } from '../models';
import { formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';
import { RespawnInfo } from '../timer-card/respawn-info';
import { PopoutService } from './popout.service';

/**
 * A timer and the counters linked to it, combined into one compact panel for the pop-out window: the countdown on
 * top, then a row per camp with its counts and kill buttons (which restart the timer, as on the board).
 */
@Component({
  selector: 'app-linked-pop-card',
  imports: [RespawnInfo],
  template: `
    <div class="card" [attr.data-status]="status()">
      <div class="head">
        <span class="name" [title]="timer().name">{{ timer().name }}</span>
        <span class="tag" title="Linked: kills restart the timer">🔗</span>
        <button class="icon" (click)="popout.dock(timer().id)" title="Put back on the board">⤓</button>
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
      <app-respawn-info [timer]="timer()" />
      <div class="bar"><span class="fill" [style.width.%]="progress() * 100"></span></div>

      @for (c of counters(); track c.id) {
        <div class="camp">
          @if (c.kind === 'namedPh') {
            <span class="counts" [title]="c.name + ': ' + c.phSinceNamed + ' PH since the last named'">
              <span class="ph" title="Placeholders">PH <b>{{ c.ph }}</b></span>
              <span class="named" title="Named">N <b>{{ c.named }}</b></span>
            </span>
            <button class="kill ph" (click)="store.phKill(c.id)" title="+1 PH and restart the timer">+ PH</button>
            <button class="kill named" (click)="store.namedKill(c.id)" title="+1 named and restart the timer">+ Named</button>
          } @else {
            <span class="counts" [title]="c.name">
              <span class="cname">{{ c.name }}</span>
              <b>{{ c.value }}</b>
              @if (c.target !== null) {
                <span class="target">/ {{ c.target }}</span>
              }
            </span>
            <button class="kill" (click)="store.bump(c.id, 1)" [title]="'Add ' + c.step + ' and restart the timer'">+</button>
          }
        </div>
      }
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
      .cname {
        overflow: hidden;
        text-overflow: ellipsis;
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
export class LinkedPopCard {
  readonly timer = input.required<TimerItem>();
  readonly counters = input.required<CounterItem[]>();
  protected readonly store = inject(TrackerStore);
  protected readonly popout = inject(PopoutService);

  protected readonly status = computed<TimerStatus>(() => {
    const t = this.timer();
    if (t.pausedRemainingMs !== null) return 'paused';
    if (t.endsAt === null) return 'idle';
    return t.endsAt <= this.store.now() ? 'done' : 'running';
  });

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
