import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { TimerItem, TimerStatus } from '../models';
import { NameInput } from '../name-input';
import { PanelTitle } from '../panel-title';
import { formatDuration, parseDuration } from '../time';
import { TrackerStore } from '../tracker.store';

@Component({
  selector: 'app-timer-card',
  imports: [PanelTitle, NameInput],
  templateUrl: './timer-card.html',
  styleUrl: './timer-card.scss',
})
export class TimerCard {
  readonly timer = input.required<TimerItem>();
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly durationError = signal(false);

  protected readonly status = computed<TimerStatus>(() => {
    const t = this.timer();
    if (t.pausedRemainingMs !== null) return 'paused';
    if (t.endsAt === null) return 'idle';
    return t.endsAt <= this.store.now() ? 'done' : 'running';
  });

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

  /** Names of counters that restart this timer. */
  protected readonly linkedBy = computed(() =>
    this.store
      .counters()
      .filter((c) => c.linkedTimerId === this.timer().id)
      .map((c) => c.name)
      .join(', '),
  );

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

  protected openEdit(): void {
    this.durationError.set(false);
    this.dlg().nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.dlg().nativeElement.close();
  }

  protected rename(name: string): void {
    if (name && name !== this.timer().name) this.store.renameTimer(this.timer().id, name);
  }

  /** ✕ on an NPC suggestion: forget it and its history, after asking. */
  protected async forgetNpc(name: string): Promise<void> {
    const kills = this.store.npcLog(name)?.history.length ?? 0;
    const what = kills ? ` and its ${kills} logged kill${kills === 1 ? '' : 's'}` : '';
    if (await this.confirm.ask('Forget NPC?', `Forget "${name}"${what}? This can't be undone.`, 'Forget')) {
      this.store.forgetNpc(name);
    }
  }

  protected setDuration(e: Event): void {
    const ms = parseDuration((e.target as HTMLInputElement).value);
    this.durationError.set(ms === null);
    if (ms !== null) this.store.setTimerDuration(this.timer().id, ms);
  }

  protected setRepeat(e: Event): void {
    this.store.updateTimer(this.timer().id, { repeat: (e.target as HTMLInputElement).checked });
  }

  protected adjustTitle(verb: 'Add' | 'Subtract'): string {
    const s = this.status();
    const what = s === 'running' || s === 'paused' ? 'remaining time' : 'timer duration';
    return `${verb} 1 minute (${what})`;
  }

  /** Shift+click skips the confirmation. */
  protected async remove(e?: MouseEvent): Promise<void> {
    const t = this.timer();
    const linked = this.linkedBy();
    const extra = linked ? ` It will be unlinked from: ${linked}.` : '';
    if (e?.shiftKey || (await this.confirm.ask('Delete timer?', `Delete "${t.name}"?${extra}`))) {
      this.closeEdit();
      this.store.removeTimer(t.id);
    }
  }
}
