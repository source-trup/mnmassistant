import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { TimerItem, TimerStatus } from '../models';
import { NameInput } from '../name-input';
import { PanelTitle } from '../panel-title';
import { formatDuration, parseDuration } from '../time';
import { TrackerStore } from '../tracker.store';
import { PopoutService } from '../popout/popout.service';
import { TimerFace, timerStatus } from './timer-face';

/** A plain countdown panel. (A Named / PH timer has the same countdown plus the camp's kill counts.) */
@Component({
  selector: 'app-timer-card',
  imports: [PanelTitle, NameInput, TimerFace],
  templateUrl: './timer-card.html',
  styleUrl: './timer-card.scss',
})
export class TimerCard {
  readonly timer = input.required<TimerItem>();
  protected readonly store = inject(TrackerStore);
  protected readonly popout = inject(PopoutService);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly durationError = signal(false);
  protected readonly status = computed<TimerStatus>(() => timerStatus(this.timer(), this.store.now()));
  protected readonly durationText = computed(() => formatDuration(this.timer().durationMs));

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

  /** Shift+click skips the confirmation. */
  protected async remove(e?: MouseEvent): Promise<void> {
    const t = this.timer();
    if (e?.shiftKey || (await this.confirm.ask('Delete timer?', `Delete "${t.name}"?`))) {
      this.closeEdit();
      this.store.removeTimer(t.id);
    }
  }
}
