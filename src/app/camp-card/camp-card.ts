import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { CampHistory } from '../counter-card/camp-history';
import { NamedPhCounter, TimerStatus } from '../models';
import { NameInput } from '../name-input';
import { PanelTitle } from '../panel-title';
import { PopoutService } from '../popout/popout.service';
import { RespawnInfo } from '../timer-card/respawn-info';
import { TimerFace, timerStatus } from '../timer-card/timer-face';
import { formatAgo, formatDuration, parseDuration } from '../time';
import { TrackerStore } from '../tracker.store';

/**
 * A Named / PH timer: a camp's respawn countdown and its placeholder vs named kills in one panel. + PH and + Named
 * log the kill and restart the countdown.
 */
@Component({
  selector: 'app-camp-card',
  imports: [PanelTitle, NameInput, TimerFace, RespawnInfo, CampHistory],
  templateUrl: './camp-card.html',
  styleUrl: './camp-card.scss',
})
export class CampCard {
  readonly camp = input.required<NamedPhCounter>();
  protected readonly store = inject(TrackerStore);
  protected readonly popout = inject(PopoutService);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly hist = viewChild.required<ElementRef<HTMLDialogElement>>('hist');

  protected readonly timer = computed(() => this.store.campTimer(this.camp()) ?? null);
  protected readonly status = computed<TimerStatus>(() => {
    const t = this.timer();
    return t ? timerStatus(t, this.store.now()) : 'idle';
  });
  protected readonly durationText = computed(() => formatDuration(this.timer()?.durationMs ?? 0));
  protected readonly durationError = signal(false);
  protected readonly npc = computed(() => this.store.npcOf(this.camp()));

  /** Kills per hour since the counts were last reset; hidden for the first minute to avoid silly numbers. */
  protected readonly perHour = computed(() => {
    const c = this.camp();
    const total = c.ph + c.named;
    const hours = (this.store.now() - c.since) / 3_600_000;
    if (hours < 1 / 60 || total <= 0) return null;
    return (total / hours).toFixed(1);
  });

  /** "1 in N" spawns were named. */
  protected readonly namedOdds = computed(() => {
    const c = this.camp();
    return c.named === 0 ? '—' : `1 in ${((c.ph + c.named) / c.named).toFixed(1)}`;
  });

  protected readonly lastNamedText = computed(() => {
    const last = [...this.store.historyOf(this.camp())].reverse().find((e) => e.type === 'named');
    return last ? `named ${formatAgo(this.store.now() - last.t)} ago` : 'no named yet';
  });

  protected readonly historyOpen = signal(false);

  protected openHistory(): void {
    this.historyOpen.set(true);
    this.hist().nativeElement.showModal();
  }

  protected closeHistory(): void {
    this.hist().nativeElement.close();
  }

  protected openEdit(): void {
    this.durationError.set(false);
    this.dlg().nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.dlg().nativeElement.close();
  }

  protected rename(name: string): void {
    if (name && name !== this.camp().name) this.store.renameTimer(this.camp().timerId, name);
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
    if (ms !== null) this.store.setTimerDuration(this.camp().timerId, ms);
  }

  protected setRepeat(e: Event): void {
    this.store.updateTimer(this.camp().timerId, { repeat: (e.target as HTMLInputElement).checked });
  }

  protected setNumber(field: 'ph' | 'named' | 'phSinceNamed', e: Event): void {
    const n = Number((e.target as HTMLInputElement).value.trim());
    if (Number.isFinite(n) && n >= 0) this.store.updateCounter(this.camp().id, { [field]: n });
  }

  protected async resetCounts(): Promise<void> {
    const c = this.camp();
    if (await this.confirm.ask('Reset counts?', `Set "${c.name}" back to 0 PH and 0 named? The kill log is kept.`, 'Reset')) {
      this.store.resetCounter(c.id);
    }
  }

  /** Shift+click skips the confirmation, except when it would throw away kill history. */
  protected async remove(e?: MouseEvent): Promise<void> {
    const c = this.camp();
    const npc = this.npc();
    const kills = this.store.historyOf(c).length;
    let extra = '';
    if (npc) extra = ` Its kill history stays saved to "${npc}".`;
    else if (kills) {
      extra = ` Its ${kills} logged kill${kills === 1 ? '' : 's'} will be deleted too. To keep them, put it away (—) instead, or first name it after the NPC.`;
    }
    const skip = e?.shiftKey && (npc || !kills);
    if (skip || (await this.confirm.ask('Delete Named / PH timer?', `Delete "${c.name}"?${extra}`))) {
      this.closeEdit();
      this.store.removeCounter(c.id);
    }
  }
}
