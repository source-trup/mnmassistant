import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { SessionStatus, StandardCounter, TimerItem } from '../models';
import { PanelTitle } from '../panel-title';
import { PopoutService } from '../popout/popout.service';
import { formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';
import { openSession, sessionElapsed, sessionStatus } from './session';
import { SessionStats } from './session-stats';

/** Which bit of a counter row is being typed into (right-click on the name or the count). */
interface RowEdit {
  id: string;
  field: 'name' | 'value';
}

/**
 * A Session timer: counts up from 0 while a session is going (click the clock to pause), and holds counters whose
 * counts are kept per session. Counters are added here, or by dragging a counter panel onto it. 📊 shows the stats.
 */
@Component({
  selector: 'app-session-card',
  imports: [PanelTitle, SessionStats],
  templateUrl: './session-card.html',
  styleUrl: './session-card.scss',
})
export class SessionCard {
  readonly timer = input.required<TimerItem>();
  protected readonly store = inject(TrackerStore);
  protected readonly popout = inject(PopoutService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly statsDlg = viewChild.required<ElementRef<HTMLDialogElement>>('stats');

  protected readonly status = computed<SessionStatus>(() => sessionStatus(this.timer()));
  protected readonly session = computed(() => openSession(this.timer()));

  protected readonly elapsed = computed(() => {
    const s = this.session();
    return s ? formatDuration(sessionElapsed(s, this.store.now()), false) : '0:00';
  });

  protected readonly counters = computed(() => this.store.countersIn(this.timer().id));

  /** Counters on the board that could be moved in. */
  protected readonly boardCounters = computed(() =>
    this.store.counters().filter((c): c is StandardCounter => c.kind === 'standard' && !this.store.timerCounterIds().has(c.id)),
  );

  /** Finished sessions, for the hint under the clock. */
  protected readonly pastCount = computed(() => (this.timer().sessions ?? []).filter((s) => s.end !== null).length);

  // ---------- the clock ----------

  /** Clicking the clock: start (or resume), or pause. */
  protected primary(): void {
    if (this.status() === 'running') this.store.pauseSession(this.timer().id);
    else this.store.startSession(this.timer().id);
  }

  protected endSession(): void {
    this.store.endSession(this.timer().id);
  }

  // ---------- counters ----------

  /** The "add a counter" row is open. */
  protected readonly adding = signal(false);

  protected openAdder(): void {
    this.adding.set(true);
    this.focusLater('.adder input');
  }

  protected addCounter(box: HTMLInputElement): void {
    const name = box.value.trim();
    if (!name) {
      this.adding.set(false);
      return;
    }
    this.store.addTimerCounter(this.timer().id, name);
    box.value = '';
    this.adding.set(false);
  }

  /** Picking a board counter in the adder moves it in. */
  protected moveIn(sel: HTMLSelectElement): void {
    const id = sel.value;
    sel.value = '';
    if (!id) return;
    if (this.popout.isPopped(id)) this.popout.dock(id);
    this.store.moveCounterToTimer(id, this.timer().id);
    this.adding.set(false);
  }

  protected readonly editing = signal<RowEdit | null>(null);
  /** What the box starts with (a snapshot, so a change elsewhere doesn't overwrite what you type). */
  protected editStart = '';

  /** Right-click on a counter's name (rename it) or its count (type the count). */
  protected edit(e: MouseEvent, c: StandardCounter, field: RowEdit['field']): void {
    e.preventDefault();
    this.editStart = field === 'name' ? c.name : String(c.value);
    this.editing.set({ id: c.id, field });
    this.focusLater('.row-edit');
  }

  protected applyEdit(c: StandardCounter, box: HTMLInputElement): void {
    const ed = this.editing();
    if (!ed || ed.id !== c.id) return; // already applied (Enter, then blur)
    const text = box.value.trim();
    if (ed.field === 'name') {
      if (text && text !== c.name) this.store.updateCounter(c.id, { name: text });
    } else if (text) {
      const n = Number(text);
      if (!Number.isFinite(n)) {
        box.classList.add('invalid');
        box.select();
        return;
      }
      if (n !== c.value) this.store.setCounterValue(c.id, n);
    }
    this.editing.set(null);
  }

  protected isEditing(c: StandardCounter, field: RowEdit['field']): boolean {
    const ed = this.editing();
    return ed?.id === c.id && ed.field === field;
  }

  protected moveOut(c: StandardCounter): void {
    this.store.moveCounterToBoard(c.id);
  }

  /** Shift+click skips the confirmation. */
  protected async deleteCounter(c: StandardCounter, e: MouseEvent): Promise<void> {
    if (e.shiftKey || (await this.confirm.ask('Delete counter?', `Delete "${c.name}"? Its counts stay in the session stats.`))) {
      this.store.removeCounter(c.id);
    }
  }

  // ---------- dialogs ----------

  protected readonly statsOpen = signal(false);

  protected openStats(): void {
    this.statsOpen.set(true);
    this.statsDlg().nativeElement.showModal();
  }

  protected closeStats(): void {
    this.statsDlg().nativeElement.close();
  }

  protected openEdit(): void {
    this.dlg().nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.dlg().nativeElement.close();
  }

  protected rename(e: Event): void {
    const name = (e.target as HTMLInputElement).value.trim();
    if (name && name !== this.timer().name) this.store.renameTimer(this.timer().id, name);
  }

  /** Shift+click skips the confirmation. */
  protected async remove(e?: MouseEvent): Promise<void> {
    const t = this.timer();
    const n = this.counters().length;
    const sessions = this.pastCount();
    const parts = [
      n ? `its ${n} counter${n === 1 ? '' : 's'}` : '',
      sessions ? `${sessions} saved session${sessions === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    const extra = parts.length ? ` ${capitalize(parts.join(' and '))} will be deleted too.` : '';
    if (e?.shiftKey || (await this.confirm.ask('Delete Session timer?', `Delete "${t.name}"?${extra}`))) {
      this.closeEdit();
      this.store.removeTimer(t.id);
    }
  }

  private focusLater(selector: string): void {
    afterNextRender(
      () => {
        const box = this.host.nativeElement.querySelector<HTMLInputElement>(selector);
        box?.focus();
        box?.select();
      },
      { injector: this.injector },
    );
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
