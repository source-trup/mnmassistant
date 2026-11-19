import { Component, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Analytics, eventSlug } from './analytics.service';
import { Backdrop } from './art/backdrop';
import { DalgrimmMark } from './art/dalgrimm-mark';
import { BuffCard } from './buff-card/buff-card';
import { ConfirmDialog } from './confirm-dialog';
import { LootPrompt } from './loot/loot-prompt';
import { ConfirmService } from './confirm.service';
import { CounterCard } from './counter-card/counter-card';
import { CampCard } from './camp-card/camp-card';
import { GRID, maxX } from './layout';
import { NamedPhCounter, NoteItem } from './models';
import { NoteCard } from './note-card/note-card';
import { LevelRangeCard } from './level-range/level-range-card';
import { PlayerListCard } from './player-list/player-list-card';
import { SpellsCard } from './spells/spells-card';
import { LevelingCard } from './leveling/leveling-card';
import { MapCard } from './map/map-card';
import { ClassesCard } from './classes/classes-card';
import { PricesCard } from './prices/prices-card';
import { WikiCard } from './community-wiki/wiki-card';
import { WishlistCard } from './wishlist/wishlist-card';
import { GearCard } from './gear/gear-card';
import { QuickGuide } from './quick-guide/quick-guide';
import { HeaderClock } from './game-clock/header-clock';
import { PopoutHost } from './popout/popout-host';
import { PopoutService } from './popout/popout.service';
import { THEMES, themeById } from './themes';
import { formatDuration, parseDuration } from './time';
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

function wishCount(n: number): string {
  return n ? `${n} on your list.` : '';
}

function playerCount(n: number): string {
  return n ? `${n} on the list.` : 'No one on it yet.';
}

@Component({
  selector: 'app-root',
  imports: [TimerCard, CounterCard, CampCard, BuffCard, NoteCard, PlayerListCard, LevelRangeCard, SpellsCard, LevelingCard, MapCard, ClassesCard, PricesCard, WikiCard, WishlistCard, GearCard, QuickGuide, HeaderClock, PopoutHost, LootPrompt, ConfirmDialog, Backdrop, DalgrimmMark],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);
  protected readonly popout = inject(PopoutService);
  protected readonly analytics = inject(Analytics);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  protected readonly GRID = GRID;
  protected readonly quickMinutes = [5, 6, 8, 10];
  /** Which custom-length box last had a bad entry ('timer' or 'camp'). */
  protected readonly customError = signal<'timer' | 'camp' | null>(null);

  /**
   * The tools, always in the toolbar: one-of-a-kind panels you show or hide with a click. Lookups first (most used),
   * then the player lists.
   */
  protected readonly tools = computed(() => {
    const s = this.store;
    const lists = s.listPanels();
    const players = s.players();
    const tool = (icon: string, label: string, hint: string, shown: boolean, toggle: () => void, group: 'ref' | 'players' = 'ref') => ({
      icon,
      label,
      hint,
      shown,
      toggle,
      group,
    });
    return [
      tool('📖', 'Wiki', 'Search the community wiki and read its pages right here.', s.wikiPanel().shown, () => s.toggleWiki()),
      tool('🧭', 'Map', 'Zone maps from MnM Atlas. Zoom in, or find an NPC on any map.', s.mapPanel().shown, () => s.toggleMap()),
      tool('💰', 'Price Checker', 'What an item sells for on Trem, what buyers offer and what a vendor pays.', s.pricePanel().shown, () => s.togglePrices()),
      tool('⭐', 'Wishlist', `Items you're after, with their stats, who drops them and wiki links. ${wishCount(s.wishlistPanel().items.filter((i) => !i.got).length)}`, s.wishlistPanel().shown, () => s.toggleWishlist()),
      tool('⚔️', 'Gear Planner', "Your gear on a paper doll for each character, every upgrade by slot, mob level and source, and the biggest upgrades around your level.", s.gearPanel().shown, () => s.toggleGear()),
      tool('🗺️', 'Leveling Spots', 'Pick your class and level to see the zones and mobs that con right for you, solo or in a group (Worth the Camp).', s.levelingPanel().shown, () => s.toggleLeveling()),
      tool('🪄', 'Spells', "Every spell by class and level, and what a level's spells cost.", s.spellPanel().shown, () => s.toggleSpells()),
      tool('🛡️', 'Class Guides', 'How to play each class: builds, key abilities, leveling and gear.', s.classPanel().shown, () => s.toggleClasses()),
      tool('📊', 'Group Range', 'Enter a level to see the lowest and highest levels it can group with.', s.levelPanel().shown, () => s.toggleLevels()),
      ...PLAYER_LISTS.map((k) =>
        k === 'naughty'
          ? tool('😈', 'Naughty', `Players you'd rather avoid: check a name before you group. ${playerCount(players.naughty.length)}`, lists.naughty.shown, () => s.toggleList('naughty'), 'players')
          : tool('😇', 'Nice', `Players you'd happily group with again. ${playerCount(players.nice.length)}`, lists.nice.shown, () => s.toggleList('nice'), 'players'),
      ),
    ];
  });

  /** The "＋ Add" menu's panels (besides the two kinds of timer): ones you can add as many of as you like. */
  protected readonly addItems = [
    { icon: '🔢', label: 'Count', hint: 'A plain counter', add: () => this.store.addCounter('standard') },
    { icon: '✨', label: 'Buff Tracker', hint: 'Buff timers with fade warnings', add: () => this.store.addBuffPanel() },
    { icon: '📝', label: 'Note', hint: 'Free text', add: () => this.store.addNote() },
    { icon: '☑️', label: 'Checklist', hint: 'Shopping list; paste a list or wiki table', add: () => this.store.addNote('checklist') },
  ].map((a) => ({
    ...a,
    add: () => {
      a.add();
      this.analytics.count(`add/${eventSlug(a.label)}`, `Added a ${a.label}`);
    },
  }));

  /** Put-away Named / PH timers and notes (badge on ＋ Add). */
  protected readonly savedCount = computed(() => this.store.closedCamps().length + this.store.closedNotes().length);

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
    this.trackUsage();
    afterNextRender(() => {
      const el = this.board().nativeElement;
      const update = () => this.store.cols.set(Math.max(15, Math.floor(el.clientWidth / GRID)));
      update();
      new ResizeObserver(update).observe(el);
    });
  }

  // ---------- toolbar ----------

  /** Adds a plain timer or a Named / PH timer of this length, and closes the ＋ Add menu. */
  protected addTimed(kind: 'timer' | 'camp', minutes: number, menu: HTMLElement): void {
    this.addLength(kind, minutes * 60_000);
    menu.hidePopover();
  }

  /** The custom-length box (7:30, 90s, 1h30m or minutes) under either kind of timer. */
  protected addCustom(kind: 'timer' | 'camp', input: HTMLInputElement, menu: HTMLElement): void {
    const ms = parseDuration(input.value);
    this.customError.set(ms === null ? kind : null);
    if (ms === null) return;
    this.addLength(kind, ms);
    input.value = '';
    menu.hidePopover();
  }

  private addLength(kind: 'timer' | 'camp', ms: number): void {
    if (kind === 'camp') this.store.addCamp(ms);
    else this.store.addTimer(ms);
    const what = kind === 'camp' ? 'Named / PH timer' : 'Timer';
    this.analytics.count(`add/${eventSlug(what)}`, `Added a ${what}`);
  }

  /**
   * Anonymous usage counts (see Analytics): the page view, a new-visitor count on a first visit, which tools are open
   * when the page loads (panels stay open between visits, so this is what people actually use), and each time a tool
   * is opened, however it was opened (the toolbar, or a 📖 / 🧭 button in another panel).
   */
  private trackUsage(): void {
    this.analytics.start();
    if (this.store.firstVisit) this.analytics.count('new-visitor', 'First visit');
    let before: Set<string> | null = null;
    effect(() => {
      const open = new Set(this.tools().filter((t) => t.shown).map((t) => t.label));
      const prev = before;
      before = open;
      untracked(() => {
        for (const label of open) {
          if (!prev) this.analytics.count(`in-use/${eventSlug(label)}`, `${label} open on load`);
          else if (!prev.has(label)) this.analytics.count(`open/${eventSlug(label)}`, `Opened ${label}`);
        }
      });
    });
  }

  /** A saved Named / PH timer's line in the ＋ Add menu. */
  protected campPreview(c: NamedPhCounter): string {
    const t = this.store.campTimer(c);
    return `👑 ${c.ph} PH · ${c.named} named${t ? ' · ' + formatDuration(t.durationMs) + ' respawn' : ''}`;
  }

  protected openCamp(id: string, menu: HTMLElement): void {
    this.store.openCamp(id);
    menu.hidePopover();
  }

  protected async deleteCamp(c: NamedPhCounter, e: MouseEvent): Promise<void> {
    const npc = this.store.npcOf(c);
    const kills = this.store.historyOf(c).length;
    const extra = npc
      ? ` Its kill history stays saved to "${npc}".`
      : kills
        ? ` Its ${kills} logged kill${kills === 1 ? '' : 's'} will be deleted too.`
        : '';
    if ((e.shiftKey && (npc || !kills)) || (await this.confirm.ask('Delete Named / PH timer?', `Permanently delete "${c.name}"?${extra}`))) {
      this.store.removeCounter(c.id);
    }
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
  /** True when the theme picker was opened for a new user, right after the quick guide (shows a welcome line). */
  protected readonly themeIntro = signal(false);

  protected openThemes(intro = false): void {
    this.themeIntro.set(intro);
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
    this.drag.set(null);
    if (d && prev?.valid) this.store.movePanel(d.id, prev.x, prev.y);
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
