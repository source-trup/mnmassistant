import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { CounterItem } from '../models';
import { formatAgo, formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';
import { PanelTitle } from '../panel-title';
import { CampHistory } from './camp-history';

@Component({
  selector: 'app-counter-card',
  imports: [PanelTitle, CampHistory],
  templateUrl: './counter-card.html',
  styleUrl: './counter-card.scss',
})
export class CounterCard {
  readonly counter = input.required<CounterItem>();
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** Typed views so the template can narrow on counter type. */
  protected readonly std = computed(() => {
    const c = this.counter();
    return c.kind === 'standard' ? c : null;
  });
  protected readonly nph = computed(() => {
    const c = this.counter();
    return c.kind === 'namedPh' ? c : null;
  });

  protected readonly linkedTimer = computed(() => {
    const id = this.counter().linkedTimerId;
    return id ? (this.store.timers().find((t) => t.id === id) ?? null) : null;
  });

  protected readonly linkedTimerText = computed(() => {
    const t = this.linkedTimer();
    return t ? `${t.name} (${formatDuration(t.durationMs)})` : '';
  });

  protected readonly reachedTarget = computed(() => {
    const c = this.std();
    return c !== null && c.target !== null && c.value >= c.target;
  });

  /** Rate per hour since last reset; hidden for the first minute to avoid silly numbers. */
  protected readonly perHour = computed(() => {
    const c = this.counter();
    const total = c.kind === 'standard' ? c.value : c.ph + c.named;
    const hours = (this.store.now() - c.since) / 3_600_000;
    if (hours < 1 / 60 || total <= 0) return null;
    return (total / hours).toFixed(1);
  });

  /** "1 in N" spawns were named. */
  protected readonly namedOdds = computed(() => {
    const c = this.nph();
    if (!c || c.named === 0) return 'â€”';
    return `1 in ${((c.ph + c.named) / c.named).toFixed(1)}`;
  });

  protected readonly historyOpen = signal(false);
  private readonly hist = viewChild.required<ElementRef<HTMLDialogElement>>('hist');

  protected readonly lastNamedText = computed(() => {
    const c = this.nph();
    if (!c) return '';
    const last = [...this.store.historyOf(c)].reverse().find((e) => e.type === 'named');
    return last ? `named ${formatAgo(this.store.now() - last.t)} ago` : 'no named yet';
  });

  protected openHistory(): void {
    this.historyOpen.set(true);
    this.hist().nativeElement.showModal();
  }

  protected closeHistory(): void {
    this.hist().nativeElement.close();
  }

  protected openEdit(): void {
    this.dlg().nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.dlg().nativeElement.close();
  }

  protected rename(e: Event): void {
    const name = (e.target as HTMLInputElement).value.trim();
    if (name) this.store.updateCounter(this.counter().id, { name });
  }

  protected setNumber(field: 'step' | 'value' | 'target' | 'ph' | 'named' | 'phSinceNamed', e: Event): void {
    const raw = (e.target as HTMLInputElement).value.trim();
    if (field === 'target' && raw === '') {
      this.store.updateCounter(this.counter().id, { target: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (field === 'step' && n <= 0) return;
    if ((field === 'ph' || field === 'named' || field === 'phSinceNamed') && n < 0) return;
    this.store.updateCounter(this.counter().id, { [field]: n });
  }

  protected setLink(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    this.store.updateCounter(this.counter().id, { linkedTimerId: id || null });
  }

  protected async reset(): Promise<void> {
    const c = this.counter();
    // Named/PH data is more valuable, so confirm before wiping it.
    if (c.kind === 'namedPh' && !(await this.confirm.ask('Reset counter?', `Reset "${c.name}" to 0?`, 'Reset'))) {
      return;
    }
    this.store.resetCounter(c.id);
  }

  /** Shift+click skips the confirmation. */
  protected async remove(e?: MouseEvent): Promise<void> {
    const c = this.counter();
    const npc = this.store.npcOf(c);
    const kills = c.kind === 'namedPh' ? this.store.historyOf(c).length : 0;
    let extra = '';
    if (npc) extra = ` Its kill history stays saved to "${npc}".`;
    else if (kills) {
      extra = ` Its ${kills} logged kill${kills === 1 ? '' : 's'} will be deleted too. To keep them, first link it to a timer named after the NPC.`;
    }
    // Shift+click skips the prompt, except when it would silently throw away kill history.
    const skip = e?.shiftKey && (npc || !kills);
    if (skip || (await this.confirm.ask('Delete counter?', `Delete "${c.name}"?${extra}`))) {
      this.closeEdit();
      this.store.removeCounter(c.id);
    }
  }
}
