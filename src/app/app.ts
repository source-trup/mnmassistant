import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Backdrop } from './art/backdrop';
import { DalgrimmMark } from './art/dalgrimm-mark';
import { BuffCard } from './buff-card/buff-card';
import { ConfirmDialog } from './confirm-dialog';
import { LootPrompt } from './loot/loot-prompt';
import { ConfirmService } from './confirm.service';
import { CounterCard } from './counter-card/counter-card';
import { GRID, maxX } from './layout';
import { NoteItem } from './models';
import { NoteCard } from './note-card/note-card';
import { LevelRangeCard } from './level-range/level-range-card';
import { PlayerListCard } from './player-list/player-list-card';
import { SpellsCard } from './spells/spells-card';
import { LevelingCard } from './leveling/leveling-card';
import { MapCard } from './map/map-card';
import { ClassesCard } from './classes/classes-card';
import { PricesCard } from './prices/prices-card';
import { WikiCard } from './community-wiki/wiki-card';
import { QuickGuide } from './quick-guide/quick-guide';
import { HeaderClock } from './game-clock/header-clock';
import { THEMES, themeById } from './themes';
import { parseDuration } from './time';
import { TimerCard } from './timer-card/timer-card';
import { PLAYER_LISTS, Panel, TrackerStore } from './tracker.store';

/** A panel (note or Spells) being resized by its bottom-right corner. */
interface ResizeState {
  id: string;
  /** Smallest allowed size, in grid cells. */
  minW: number;
  minH: number;
  x: number;
  y: number;
  /** Live drawn size in px (follows the pointer). */
  pw: number;
  ph: number;
  /** Pointer position when the resize started, and the drawn size then. */
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

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
  imports: [TimerCard, CounterCard, BuffCard, NoteCard, PlayerListCard, LevelRangeCard, SpellsCard, LevelingCard, MapCard, ClassesCard, PricesCard, WikiCard, QuickGuide, HeaderClock, LootPrompt, ConfirmDialog, Backdrop, DalgrimmMark],
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

  /** The "＋ Add" menu: panels you can add as many of as you like. */
  protected readonly addItems = [
    { icon: '🔢', label: 'Count', hint: 'A plain counter', add: () => this.store.addCounter('standard') },
    { icon: '👑', label: 'Named / PH', hint: 'Placeholder and named kills, with loot log', add: () => this.store.addCounter('namedPh') },
    { icon: '✨', label: 'Buff Tracker', hint: 'Buff timers with fade warnings', add: () => this.store.addBuffPanel() },
    { icon: '📝', label: 'Note', hint: 'Free text', add: () => this.store.addNote() },
    { icon: '☑️', label: 'Checklist', hint: 'Shopping list; paste a list or wiki table', add: () => this.store.addNote('checklist') },
  ];

  /** The "Tools" menu: one-of-a-kind panels, shown or hidden. */
  protected readonly toolGroups = computed(() => {
    const s = this.store;
    const lists = s.listPanels();
    const players = s.players();
    const tool = (icon: string, label: string, hint: string, shown: boolean, toggle: () => void) => ({ icon, label, hint, shown, toggle });
    return [
      {
        title: 'Players',
        tools: PLAYER_LISTS.map((k) =>
          k === 'naughty'
            ? tool('😈', 'Naughty list', `${players.naughty.length} players you'd rather avoid`, lists.naughty.shown, () => s.toggleList('naughty'))
            : tool('😇', 'Nice list', `${players.nice.length} players you'd group with again`, lists.nice.shown, () => s.toggleList('nice')),
        ),
      },
      {
        title: 'Reference',
        tools: [
          tool('🛡️', 'Classes', 'How to play each class', s.classPanel().shown, () => s.toggleClasses()),
          tool('💰', 'Prices', 'Trem market and vendor prices (MnMdb)', s.pricePanel().shown, () => s.togglePrices()),
          tool('📖', 'Wiki', 'Search the community wiki', s.wikiPanel().shown, () => s.toggleWiki()),
          tool('📊', 'Level range', 'Who a level can group with', s.levelPanel().shown, () => s.toggleLevels()),
          tool('📖', 'Spells', 'By class and level, with costs', s.spellPanel().shown, () => s.toggleSpells()),
          tool('🗺️', 'Leveling', 'Where to hunt for a level', s.levelingPanel().shown, () => s.toggleLeveling()),
          tool('🧭', 'Map', 'Zone maps from MnM Atlas', s.mapPanel().shown, () => s.toggleMap()),
        ],
      },
    ];
  });

  /** How many tool panels are showing (badge on the Tools button). */
  protected readonly openTools = computed(() =>
    this.toolGroups().reduce((n, g) => n + g.tools.filter((t) => t.shown).length, 0),
  );

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

  /**
   * While dragging a Named/PH panel over a timer (or a timer over a Named/PH panel): the pair that dropping would
   * link. The panel under the pointer is the target.
   */
  protected readonly linkDrop = computed(() => {
    const d = this.drag();
    if (!d) return null;
    const panels = this.store.panels();
    const dragged = panels.find((p) => p.id === d.id);
    if (!dragged) return null;
    const pointerX = d.px + d.offX;
    const pointerY = d.py + d.offY;
    const target = panels.find(
      (p) =>
        p.id !== d.id &&
        pointerX >= p.x * GRID &&
        pointerX < (p.x + p.w - 1) * GRID &&
        pointerY >= p.y * GRID &&
        pointerY < (p.y + p.h - 1) * GRID,
    );
    if (!target) return null;
    const isNph = (p: Panel) => p.kind === 'counter' && p.item.kind === 'namedPh';
    let counter: Panel | undefined;
    let timer: Panel | undefined;
    if (isNph(dragged) && target.kind === 'timer') [counter, timer] = [dragged, target];
    else if (dragged.kind === 'timer' && isNph(target)) [counter, timer] = [target, dragged];
    if (!counter || !timer || counter.kind !== 'counter' || timer.kind !== 'timer') return null;
    return { targetId: target.id, counter: counter.item, timer: timer.item };
  });

  protected readonly resize = signal<ResizeState | null>(null);

  /** The snapped size a note being resized would get. */
  protected readonly resizePreview = computed(() => {
    const r = this.resize();
    if (!r) return null;
    const maxW = this.store.cols() - r.x + 1;
    const w = Math.min(maxW, Math.max(r.minW, Math.round(r.pw / GRID) + 1));
    const h = Math.max(r.minH, Math.round(r.ph / GRID) + 1);
    const rect = { x: r.x, y: r.y, w, h };
    return { ...rect, valid: this.store.canPlace(r.id, rect) };
  });

  /** Ghost outline: where a dragged panel would land, or the size a resized note would get. */
  protected readonly ghost = computed(() => this.preview() ?? this.resizePreview());

  protected readonly boardHeight = computed(() => {
    let rows = 0;
    for (const p of this.store.panels()) rows = Math.max(rows, p.y + p.h);
    const prev = this.ghost();
    if (prev) rows = Math.max(rows, prev.y + prev.h);
    return (rows + 6) * GRID;
  });

  constructor() {
    afterNextRender(() => {
      const el = this.board().nativeElement;
      const update = () => this.store.cols.set(Math.max(15, Math.floor(el.clientWidth / GRID)));
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

  // ---------- themes ----------

  protected readonly themes = THEMES;
  protected readonly currentTheme = computed(() => themeById(this.store.theme()));
  private readonly themeDlg = viewChild.required<ElementRef<HTMLDialogElement>>('themeDlg');

  /** Picking a tile applies the theme right away (so you can preview); Done closes. */
  protected openThemes(): void {
    this.themeDlg().nativeElement.showModal();
  }

  // ---------- saved notes ----------

  protected openNote(id: string, menu: HTMLElement): void {
    this.store.openNote(id);
    menu.hidePopover();
  }

  /** First line of a note (or a checklist's progress), for the saved-notes list. */
  protected notePreview(n: NoteItem): string {
    if (n.type === 'checklist') {
      if (!n.items.length) return '☑ (empty)';
      const done = n.items.filter((i) => i.done).length;
      const next = n.items.find((i) => !i.done);
      return `☑ ${done}/${n.items.length}${next ? ' · next: ' + next.text : ' · all done'}`;
    }
    const line = n.text.split('\n').find((l) => l.trim()) ?? '';
    return line.trim() || '(empty)';
  }

  protected async deleteNote(n: NoteItem, e: MouseEvent): Promise<void> {
    if (e.shiftKey || (await this.confirm.ask('Delete note?', `Permanently delete "${n.name}"?`))) {
      this.store.removeNote(n.id);
    }
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
    // Only the panel header starts a drag, and never its buttons or links (capturing the pointer would swallow the click).
    if (!target.closest('.drag-handle') || target.closest('button, a, input, select, textarea')) return;
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
    const link = this.linkDrop();
    this.drag.set(null);
    if (link) {
      // Dropped onto a partner panel: the dragged panel goes back to its spot, and we offer to link the pair.
      void this.confirmLink(link.counter.id, link.timer.id);
      return;
    }
    if (d && prev?.valid) this.store.movePanel(d.id, prev.x, prev.y);
  }

  /** Links a Named/PH counter to a timer after asking (always). */
  private async confirmLink(counterId: string, timerId: string): Promise<void> {
    const c = this.store.counters().find((x) => x.id === counterId);
    const t = this.store.timers().find((x) => x.id === timerId);
    if (!c || !t) return;
    if (c.linkedTimerId === t.id) {
      await this.confirm.ask('Already linked', `"${c.name}" already restarts "${t.name}".`, 'OK', 'primary');
      return;
    }
    const current = c.linkedTimerId ? this.store.timers().find((x) => x.id === c.linkedTimerId) : undefined;
    const replace = current ? ` It is currently linked to "${current.name}"; that link will be replaced.` : '';
    const ok = await this.confirm.ask(
      'Link to timer?',
      `Link "${c.name}" to "${t.name}"? + PH and + Named will restart "${t.name}".${replace}`,
      'Link',
      'primary',
    );
    if (ok) this.store.updateCounter(c.id, { linkedTimerId: t.id });
  }

  protected onPointerCancel(): void {
    this.drag.set(null);
  }

  // ---------- resizing notes ----------

  protected width(p: Panel): number {
    const r = this.resize();
    return r && r.id === p.id ? r.pw : (p.w - 1) * GRID;
  }

  protected height(p: Panel): number {
    const r = this.resize();
    return r && r.id === p.id ? r.ph : (p.h - 1) * GRID;
  }

  protected startResize(e: PointerEvent, p: Panel): void {
    const min = this.store.minSize(p);
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const w = (p.w - 1) * GRID;
    const h = (p.h - 1) * GRID;
    this.resize.set({ id: p.id, minW: min.w, minH: min.h, x: p.x, y: p.y, pw: w, ph: h, startX: e.clientX, startY: e.clientY, startW: w, startH: h });
  }

  protected moveResize(e: PointerEvent): void {
    const r = this.resize();
    if (!r) return;
    e.stopPropagation();
    const minW = (r.minW - 1) * GRID;
    const minH = (r.minH - 1) * GRID;
    this.resize.set({
      ...r,
      pw: Math.max(minW, r.startW + e.clientX - r.startX),
      ph: Math.max(minH, r.startH + e.clientY - r.startY),
    });
  }

  protected endResize(e: PointerEvent): void {
    e.stopPropagation();
    const r = this.resize();
    const prev = this.resizePreview();
    this.resize.set(null);
    if (r && prev?.valid) this.store.resizePanel(r.id, prev.w, prev.h);
  }

  private pointerInBoard(e: PointerEvent): { x: number; y: number } {
    const rect = this.board().nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
}
