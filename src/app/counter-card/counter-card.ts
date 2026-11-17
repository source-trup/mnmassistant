import { Component, ElementRef, computed, inject, input, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { StandardCounter } from '../models';
import { TrackerStore } from '../tracker.store';
import { PopoutService } from '../popout/popout.service';
import { PanelTitle } from '../panel-title';

/** A plain counter. (Named / PH kills have their own panel, the Named / PH timer.) */
@Component({
  selector: 'app-counter-card',
  imports: [PanelTitle],
  templateUrl: './counter-card.html',
  styleUrl: './counter-card.scss',
})
export class CounterCard {
  readonly counter = input.required<StandardCounter>();
  protected readonly store = inject(TrackerStore);
  protected readonly popout = inject(PopoutService);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly reachedTarget = computed(() => {
    const c = this.counter();
    return c.target !== null && c.value >= c.target;
  });

  /** Rate per hour since last reset; hidden for the first minute to avoid silly numbers. */
  protected readonly perHour = computed(() => {
    const c = this.counter();
    const hours = (this.store.now() - c.since) / 3_600_000;
    if (hours < 1 / 60 || c.value <= 0) return null;
    return (c.value / hours).toFixed(1);
  });

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

  protected setNumber(field: 'step' | 'value' | 'target', e: Event): void {
    const raw = (e.target as HTMLInputElement).value.trim();
    if (field === 'target' && raw === '') {
      this.store.updateCounter(this.counter().id, { target: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (field === 'step' && n <= 0) return;
    this.store.updateCounter(this.counter().id, { [field]: n });
  }

  protected reset(): void {
    this.store.resetCounter(this.counter().id);
  }

  /** Shift+click skips the confirmation. */
  protected async remove(e?: MouseEvent): Promise<void> {
    const c = this.counter();
    if (e?.shiftKey || (await this.confirm.ask('Delete counter?', `Delete "${c.name}"?`))) {
      this.closeEdit();
      this.store.removeCounter(c.id);
    }
  }
}
