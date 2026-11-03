import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Backdrop } from './art/backdrop';
import { DalgrimmMark } from './art/dalgrimm-mark';
import { BuffCard } from './buff-card/buff-card';
import { ConfirmDialog } from './confirm-dialog';
import { LootPrompt } from './loot/loot-prompt';
import { ConfirmService } from './confirm.service';
import { CounterCard } from './counter-card/counter-card';
import { GRID, maxX } from './layout';
import { NoteCard } from './note-card/note-card';
import { parseDuration } from './time';
import { TimerCard } from './timer-card/timer-card';
import { Panel, TrackerStore } from './tracker.store';

interface DragState {
  id: string;
  w: number;
  h: number;
  /** Current top-left of the panel in board pixels (follows the pointer freely). */
  px: number;
  py: number;
  /** Pointer offset inside the panel when the drag started. */
  offX: number;
  offY: number;
}

@Component({
  selector: 'app-root',
  imports: [TimerCard, CounterCard, BuffCard, NoteCard, LootPrompt, ConfirmDialog, Backdrop, DalgrimmMark],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  protected readonly GRID = GRID;
  protected readonly quickMinutes = [5, 6, 8, 10];
  protected readonly customError = signal(false);

  protected readonly drag = signal<DragState | null>(null);

  /** Where the dragged panel would land, snapped to the grid. */
  protected readonly preview = computed(() => {
    const d = this.drag();
    if (!d) return null;
    const x = Math.min(maxX(this.store.cols(), d.w), Math.max(0, Math.round(d.px / GRID)));
    const y = Math.max(0, Math.round(d.py / GRID));
    const rect = { x, y, w: d.w, h: d.h };
    return { ...rect, valid: this.store.canPlace(d.id, rect) };
  });

  protected readonly boardHeight = computed(() => {
    let rows = 0;
    for (const p of this.store.panels()) rows = Math.max(rows, p.y + p.h);
    const prev = this.preview();
    if (prev) rows = Math.max(rows, prev.y + prev.h);
    return (rows + 6) * GRID;
  });

  constructor() {
    afterNextRender(() => {
      const el = this.board().nativeElement;
      const update = () => this.store.cols.set(Math.max(13, Math.floor(el.clientWidth / GRID)));
      update();
      new ResizeObserver(update).observe(el);
    });
  }

  // ---------- toolbar ----------

  protected addQuickTimer(minutes: number): void {
    this.store.addTimer(minutes * 60_000);
  }

  protected addCustomTimer(input: HTMLInputElement): void {
    const ms = parseDuration(input.value);
    this.customError.set(ms === null);
    if (ms === null) return;
    this.store.addTimer(ms);
    input.value = '';
  }

  /** Close the ☰ menu after any of its buttons is used. */
  protected onMenuClick(e: Event, menu: HTMLElement): void {
    if ((e.target as Element).closest('button')) menu.hidePopover();
  }

  // ---------- save / load ----------

  protected async saveLayout(): Promise<void> {
    const data = JSON.stringify(this.store.exportLayout(), null, 2);
    const name = `mnm-layout-${new Date().toISOString().slice(0, 10)}.json`;
    const picker = (window as any).showSaveFilePicker;
    if (picker) {
      try {
        const handle = await picker({
          suggestedName: name,
          types: [{ description: 'MnM Assistant layout', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user cancelled
        // Otherwise fall through to a plain download.
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  protected async loadLayout(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      await this.confirm.ask('Not a layout file', `"${file.name}" couldn't be read as a layout.`, 'OK');
      return;
    }
    const ok = await this.confirm.ask(
      'Load layout?',
      `Replace everything on the board with "${file.name}"? Running timers and buffs will be stopped. Save your current layout first if you want to keep it.`,
      'Load',
    );
    if (ok && !this.store.importLayout(data)) {
      await this.confirm.ask('Could not load', `"${file.name}" isn't an MnM Assistant layout.`, 'OK');
    }
  }

  protected async resetAllTimers(): Promise<void> {
    if (await this.confirm.ask('Reset all timers?', 'Stop and reset every timer.', 'Reset')) this.store.resetAllTimers();
  }

  protected async resetAllCounters(): Promise<void> {
    if (await this.confirm.ask('Reset all counters?', 'Set every counter back to 0.', 'Reset')) {
      this.store.resetAllCounters();
    }
  }

  // ---------- dragging ----------

  protected left(p: Panel): number {
    const d = this.drag();
    return d && d.id === p.id ? d.px : p.x * GRID;
  }

  protected top(p: Panel): number {
    const d = this.drag();
    return d && d.id === p.id ? d.py : p.y * GRID;
  }

  protected onPointerDown(e: PointerEvent, p: Panel): void {
    if (e.button !== 0) return;
    const target = e.target as Element;
    // Only the panel header starts a drag, and never its buttons.
    if (!target.closest('.drag-handle') || target.closest('button, input, select, textarea')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = this.pointerInBoard(e);
    this.drag.set({
      id: p.id,
      w: p.w,
      h: p.h,
      px: p.x * GRID,
      py: p.y * GRID,
      offX: x - p.x * GRID,
      offY: y - p.y * GRID,
    });
  }

  protected onPointerMove(e: PointerEvent): void {
    const d = this.drag();
    if (!d) return;
    const { x, y } = this.pointerInBoard(e);
    this.drag.set({ ...d, px: Math.max(0, x - d.offX), py: Math.max(0, y - d.offY) });
  }

  protected onPointerUp(): void {
    const prev = this.preview();
    const d = this.drag();
    if (d && prev?.valid) this.store.movePanel(d.id, prev.x, prev.y);
    this.drag.set(null);
  }

  protected onPointerCancel(): void {
    this.drag.set(null);
  }

  private pointerInBoard(e: PointerEvent): { x: number; y: number } {
    const rect = this.board().nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
}
