import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AlertsService } from './alerts.service';
import { PANEL_SIZE, Rect, findFreeSpot, overlaps } from './layout';
import { GRID } from './layout';
import {
  AppState,
  BuffEntry,
  BuffPanel,
  CampEvent,
  CounterItem,
  CounterKind,
  LootItem,
  NamedPhCounter,
  NoteItem,
  StandardCounter,
  Theme,
  TimerItem,
} from './models';
import { formatDuration } from './time';

const STORAGE_KEY = 'mnm-assistant.state.v1';
const TICK_MS = 250;
/** Per-camp cap so localStorage can't grow without bound. */
const MAX_HISTORY = 5000;

/** Names the app generates; timers/buffs still using one of these chime instead of speaking. */
const AUTO_TIMER_NAME = /^(\d+:)?\d+:\d{2} spawn$|^New timer$/;
const AUTO_BUFF_NAME = /^New buff$|^(\d+:)?\d+:\d{2} buff$/;

export type Panel =
  | ({ id: string; kind: 'timer'; item: TimerItem } & Rect)
  | ({ id: string; kind: 'counter'; item: CounterItem } & Rect)
  | ({ id: string; kind: 'buffs'; item: BuffPanel } & Rect)
  | ({ id: string; kind: 'note'; item: NoteItem } & Rect);

/** Note text size limits and step, in px. */
export const NOTE_FONT = { min: 10, max: 32, step: 2, default: 14 };

/** A named kill waiting for (optional) loot entry. */
export interface LootRequest {
  counterId: string;
  eventId: string;
}

/** Shape of a saved layout file. */
export interface LayoutFile {
  app: 'mnm-assistant';
  savedAt: string;
  state: AppState;
}

function newId(): string {
  return crypto.randomUUID();
}

/** Position used for items that haven't been placed on the grid yet. */
const UNPLACED = { x: -1, y: -1 };

function autoTimerName(durationMs: number): string {
  return `${formatDuration(durationMs)} spawn`;
}

function makeTimer(durationMs: number, name?: string): TimerItem {
  return {
    id: newId(),
    name: name ?? autoTimerName(durationMs),
    autoNamed: !name,
    durationMs,
    endsAt: null,
    pausedRemainingMs: null,
    repeat: false,
    ...UNPLACED,
  };
}

function makeCounter(kind: CounterKind, name?: string): CounterItem {
  const base = { id: newId(), since: Date.now(), linkedTimerId: null, ...UNPLACED };
  return kind === 'standard'
    ? { ...base, kind, name: name ?? 'Counter', value: 0, step: 1, target: null }
    : { ...base, kind, name: name ?? 'Named / PH', ph: 0, named: 0, phSinceNamed: 0, history: [] };
}

function autoBuffName(durationMs: number): string {
  return `${formatDuration(durationMs)} buff`;
}

function makeBuff(durationMs = 30 * 60_000, name?: string): BuffEntry {
  return { id: newId(), name: name ?? autoBuffName(durationMs), autoNamed: !name, durationMs, warnMs: 60_000, endsAt: null };
}

function makeBuffPanel(): BuffPanel {
  return { id: newId(), name: 'Buff Tracker', buffs: [], ...UNPLACED };
}

function makeNote(): NoteItem {
  return { id: newId(), name: 'Note', text: '', fontSize: NOTE_FONT.default, ...UNPLACED };
}

function clampFont(px: number): number {
  return Math.min(NOTE_FONT.max, Math.max(NOTE_FONT.min, px));
}

function defaultState(): AppState {
  const camp = makeTimer(6 * 60_000, 'Camp spawn');
  const nph = makeCounter('namedPh', 'Camp named / PH') as NamedPhCounter;
  nph.linkedTimerId = camp.id;
  return {
    version: 4,
    soundOn: true,
    theme: 'spirit',
    timers: [camp],
    counters: [nph, makeCounter('standard', 'Kills')],
    buffPanels: [],
    notes: [],
  };
}

function normalizeCounter(raw: any): CounterItem {
  const pos = { x: raw.x ?? -1, y: raw.y ?? -1 };
  if (raw.kind === 'namedPh') {
    return {
      ...makeCounter('namedPh'),
      ...raw,
      history: Array.isArray(raw.history) ? raw.history : [],
      ...pos,
    };
  }
  return { ...makeCounter('standard'), ...raw, kind: 'standard', ...pos };
}

/** Accepts state saved by any version of the app (or a layout file) and upgrades it. */
function normalizeState(parsed: any): AppState | null {
  if (!parsed || ![1, 2, 3, 4].includes(parsed.version)) return null;
  if (!Array.isArray(parsed.timers) || !Array.isArray(parsed.counters)) return null;
  return {
    version: 4,
    soundOn: parsed.soundOn ?? true,
    theme: parsed.theme === 'classic' ? 'classic' : 'spirit',
    notes: (Array.isArray(parsed.notes) ? parsed.notes : []).map((n: any) => ({
      ...makeNote(),
      ...n,
      text: typeof n.text === 'string' ? n.text : '',
      fontSize: clampFont(Number(n.fontSize) || NOTE_FONT.default),
      x: n.x ?? -1,
      y: n.y ?? -1,
    })),
    timers: parsed.timers.map((t: any) => ({
      repeat: false,
      endsAt: null,
      pausedRemainingMs: null,
      ...t,
      autoNamed: t.autoNamed ?? AUTO_TIMER_NAME.test(t.name ?? ''),
      x: t.x ?? -1,
      y: t.y ?? -1,
    })),
    counters: parsed.counters.map(normalizeCounter),
    buffPanels: (parsed.buffPanels ?? []).map((p: any) => ({
      ...p,
      x: p.x ?? -1,
      y: p.y ?? -1,
      buffs: (p.buffs ?? []).map((b: any) => ({
        warnMs: 60_000,
        endsAt: null,
        autoNamed: AUTO_BUFF_NAME.test(b.name ?? ''),
        ...b,
      })),
    })),
  };
}

/** Single source of truth for timers, counters, buffs and layout. Persists to localStorage automatically. */
@Injectable({ providedIn: 'root' })
export class TrackerStore {
  private readonly alerts = inject(AlertsService);

  /** Ticks every 250 ms; everything time-based derives from this. */
  readonly now = signal(Date.now());
  readonly timers = signal<TimerItem[]>([]);
  readonly counters = signal<CounterItem[]>([]);
  readonly buffPanels = signal<BuffPanel[]>([]);
  readonly notes = signal<NoteItem[]>([]);
  readonly soundOn = signal(true);
  readonly theme = signal<Theme>('spirit');
  /** Named kills waiting for loot entry; the first one is shown in the loot drawer. */
  readonly lootQueue = signal<LootRequest[]>([]);
  /** Board width in grid cells; kept up to date by the app shell. */
  readonly cols = signal(Math.max(13, Math.floor((window.innerWidth - 32) / GRID)));

  /** Every panel on the board with its grid footprint. */
  readonly panels = computed<Panel[]>(() => [
    ...this.timers().map((t) => ({ id: t.id, kind: 'timer' as const, item: t, x: t.x, y: t.y, ...PANEL_SIZE.timer })),
    ...this.counters().map((c) => ({ id: c.id, kind: 'counter' as const, item: c, x: c.x, y: c.y, ...PANEL_SIZE[c.kind] })),
    ...this.buffPanels().map((b) => ({ id: b.id, kind: 'buffs' as const, item: b, x: b.x, y: b.y, ...PANEL_SIZE.buffs })),
    ...this.notes().map((n) => ({ id: n.id, kind: 'note' as const, item: n, x: n.x, y: n.y, ...PANEL_SIZE.note })),
  ]);

  /** Every distinct item ever entered, most recent first (for autocomplete). */
  readonly knownItems = computed<LootItem[]>(() => {
    const seen = new Map<string, LootItem>();
    const events = this.counters()
      .flatMap((c) => (c.kind === 'namedPh' ? c.history : []))
      .sort((a, b) => b.t - a.t);
    for (const e of events) {
      for (const item of e.loot) {
        const key = item.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, item);
      }
    }
    return [...seen.values()];
  });

  /** Alert bookkeeping (not persisted). */
  private readonly timerAlerted = new Set<string>();
  private readonly buffWarned = new Set<string>();
  private readonly buffFaded = new Set<string>();

  constructor() {
    this.load();
    this.placeUnplaced();
    this.primeAlerts();
    effect(() => this.save());
    effect(() => document.documentElement.setAttribute('data-theme', this.theme()));
    setInterval(() => this.tick(), TICK_MS);
  }

  // ---------- layout ----------

  canPlace(id: string, rect: Rect): boolean {
    if (rect.x < 0 || rect.y < 0) return false;
    return !this.panels().some((p) => p.id !== id && overlaps(p, rect));
  }

  movePanel(id: string, x: number, y: number): void {
    if (this.timers().some((t) => t.id === id)) this.updateTimer(id, { x, y });
    else if (this.counters().some((c) => c.id === id)) this.updateCounter(id, { x, y });
    else if (this.buffPanels().some((b) => b.id === id)) this.updateBuffPanel(id, { x, y });
    else this.updateNote(id, { x, y });
  }

  /** Packs every panel into the grid, keeping their current reading order. */
  autoArrange(): void {
    const ordered = [...this.panels()].sort((a, b) => a.y - b.y || a.x - b.x);
    const placed: Rect[] = [];
    const pos = new Map<string, { x: number; y: number }>();
    for (const p of ordered) {
      const spot = findFreeSpot(placed, p.w, p.h, this.cols());
      placed.push({ ...spot, w: p.w, h: p.h });
      pos.set(p.id, spot);
    }
    this.timers.update((list) => list.map((t) => ({ ...t, ...pos.get(t.id)! })));
    this.counters.update((list) => list.map((c) => ({ ...c, ...pos.get(c.id)! })) as CounterItem[]);
    this.buffPanels.update((list) => list.map((b) => ({ ...b, ...pos.get(b.id)! })));
    this.notes.update((list) => list.map((n) => ({ ...n, ...pos.get(n.id)! })));
  }

  /** Gives a grid position to any item that doesn't have one yet (new, migrated or loaded). */
  private placeUnplaced(): void {
    const placed: Rect[] = this.panels().filter((p) => p.x >= 0 && p.y >= 0);
    const place = <T extends { x: number; y: number }>(item: T, size: { w: number; h: number }): T => {
      if (item.x >= 0 && item.y >= 0) return item;
      const spot = findFreeSpot(placed, size.w, size.h, this.cols());
      placed.push({ ...spot, ...size });
      return { ...item, ...spot };
    };
    this.timers.update((list) => list.map((t) => place(t, PANEL_SIZE.timer)));
    this.counters.update((list) => list.map((c) => place(c, PANEL_SIZE[c.kind])));
    this.buffPanels.update((list) => list.map((b) => place(b, PANEL_SIZE.buffs)));
    this.notes.update((list) => list.map((n) => place(n, PANEL_SIZE.note)));
  }

  // ---------- timers ----------

  addTimer(durationMs: number, name?: string): void {
    this.timers.update((list) => [...list, makeTimer(durationMs, name)]);
    this.placeUnplaced();
  }

  removeTimer(id: string): void {
    this.timers.update((list) => list.filter((t) => t.id !== id));
    this.counters.update(
      (list) => list.map((c) => (c.linkedTimerId === id ? { ...c, linkedTimerId: null } : c)) as CounterItem[],
    );
    this.timerAlerted.delete(id);
  }

  updateTimer(id: string, patch: Partial<TimerItem>): void {
    this.timers.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  renameTimer(id: string, name: string): void {
    this.updateTimer(id, { name, autoNamed: AUTO_TIMER_NAME.test(name) });
  }

  /** Changes the timer's length; a generated name follows the new length. */
  setTimerDuration(id: string, durationMs: number): void {
    const t = this.timers().find((x) => x.id === id);
    if (!t) return;
    this.updateTimer(id, { durationMs, ...(t.autoNamed ? { name: autoTimerName(durationMs) } : {}) });
  }

  /** Start from the full duration (also used as "restart"). */
  startTimer(id: string): void {
    this.alerts.unlock();
    const t = this.timers().find((x) => x.id === id);
    if (!t) return;
    this.timerAlerted.delete(id);
    this.updateTimer(id, { endsAt: Date.now() + t.durationMs, pausedRemainingMs: null });
  }

  pauseTimer(id: string): void {
    const t = this.timers().find((x) => x.id === id);
    if (!t || t.endsAt === null) return;
    this.updateTimer(id, { endsAt: null, pausedRemainingMs: Math.max(0, t.endsAt - Date.now()) });
  }

  resumeTimer(id: string): void {
    this.alerts.unlock();
    const t = this.timers().find((x) => x.id === id);
    if (!t || t.pausedRemainingMs === null) return;
    this.updateTimer(id, { endsAt: Date.now() + t.pausedRemainingMs, pausedRemainingMs: null });
  }

  /**
   * Sets how long is left without changing the timer's duration, so the next restart still uses the full
   * length. A paused timer stays paused; otherwise it runs from the new time.
   */
  setTimerRemaining(id: string, remainingMs: number): void {
    if (remainingMs <= 0) return;
    this.alerts.unlock();
    const t = this.timers().find((x) => x.id === id);
    if (!t) return;
    this.timerAlerted.delete(id);
    if (t.pausedRemainingMs !== null) this.updateTimer(id, { pausedRemainingMs: remainingMs });
    else this.updateTimer(id, { endsAt: Date.now() + remainingMs, pausedRemainingMs: null });
  }

  resetTimer(id: string): void {
    this.timerAlerted.delete(id);
    this.updateTimer(id, { endsAt: null, pausedRemainingMs: null });
  }

  /**
   * +/- time on a timer. Running/paused: nudges the remaining time (to sync with the game).
   * Stopped/finished: changes the timer's duration itself (never below 1 minute).
   */
  adjustTimer(id: string, deltaMs: number): void {
    const t = this.timers().find((x) => x.id === id);
    if (!t) return;
    const stopped = t.pausedRemainingMs === null && (t.endsAt === null || t.endsAt <= Date.now());
    if (stopped) {
      const durationMs = t.durationMs + deltaMs;
      if (durationMs >= 60_000) this.setTimerDuration(id, durationMs);
    } else if (t.endsAt !== null) {
      const endsAt = Math.max(Date.now(), t.endsAt + deltaMs);
      if (endsAt > Date.now()) this.timerAlerted.delete(id);
      this.updateTimer(id, { endsAt });
    } else if (t.pausedRemainingMs !== null) {
      this.updateTimer(id, { pausedRemainingMs: Math.max(0, t.pausedRemainingMs + deltaMs) });
    }
  }

  resetAllTimers(): void {
    this.timerAlerted.clear();
    this.timers.update((list) => list.map((t) => ({ ...t, endsAt: null, pausedRemainingMs: null })));
  }

  // ---------- counters ----------

  addCounter(kind: CounterKind): void {
    this.counters.update((list) => [...list, makeCounter(kind)]);
    this.placeUnplaced();
  }

  removeCounter(id: string): void {
    this.counters.update((list) => list.filter((c) => c.id !== id));
    this.lootQueue.update((q) => q.filter((r) => r.counterId !== id));
  }

  updateCounter(id: string, patch: Partial<StandardCounter> | Partial<NamedPhCounter>): void {
    this.counters.update((list) => list.map((c) => (c.id === id ? ({ ...c, ...patch } as CounterItem) : c)));
  }

  private updateNph(id: string, fn: (c: NamedPhCounter) => NamedPhCounter): void {
    this.counters.update((list) => list.map((c) => (c.id === id && c.kind === 'namedPh' ? fn(c) : c)));
  }

  /** Standard counter +/-. Incrementing also restarts the linked timer, if any. */
  bump(id: string, direction: 1 | -1): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'standard') return;
    this.updateCounter(id, { value: c.value + direction * c.step });
    if (direction > 0) this.restartLinked(c);
  }

  /** Placeholder killed: +1 PH, log it, and restart the linked timer. */
  phKill(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    this.restartLinked(c);
    const event: CampEvent = { id: newId(), t: Date.now(), type: 'ph', loot: [] };
    this.updateNph(id, (n) => ({
      ...n,
      ph: n.ph + 1,
      phSinceNamed: n.phSinceNamed + 1,
      history: [...n.history, event].slice(-MAX_HISTORY),
    }));
  }

  /** Named killed: +1 named, log it, restart the linked timer, then offer loot entry. */
  namedKill(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    this.restartLinked(c);
    const event: CampEvent = { id: newId(), t: Date.now(), type: 'named', loot: [] };
    this.updateNph(id, (n) => ({
      ...n,
      named: n.named + 1,
      phSinceNamed: 0,
      history: [...n.history, event].slice(-MAX_HISTORY),
    }));
    this.lootQueue.update((q) => [...q, { counterId: id, eventId: event.id }]);
  }

  /** Undo a mis-click on a Named/PH counter: removes the latest kill of that type (does not touch the timer). */
  undo(id: string, type: 'ph' | 'named'): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    const last = [...c.history].reverse().find((e) => e.type === type && e.t >= c.since);
    if (last) this.deleteEvent(id, last.id);
    else if (c[type] > 0) {
      // Count was set by hand with no matching log entry.
      this.updateNph(id, (n) =>
        type === 'ph' ? { ...n, ph: n.ph - 1, phSinceNamed: Math.max(0, n.phSinceNamed - 1) } : { ...n, named: n.named - 1 },
      );
    }
  }

  /** Removes a kill from the log; if it belongs to the current session the counts are corrected too. */
  deleteEvent(counterId: string, eventId: string): void {
    this.updateNph(counterId, (n) => {
      const e = n.history.find((x) => x.id === eventId);
      if (!e) return n;
      const history = n.history.filter((x) => x.id !== eventId);
      if (e.t < n.since) return { ...n, history };
      if (e.type === 'named') return { ...n, history, named: Math.max(0, n.named - 1) };
      const lastNamed = [...n.history].reverse().find((x) => x.type === 'named');
      const inStreak = !lastNamed || e.t > lastNamed.t;
      return {
        ...n,
        history,
        ph: Math.max(0, n.ph - 1),
        phSinceNamed: inStreak ? Math.max(0, n.phSinceNamed - 1) : n.phSinceNamed,
      };
    });
    this.lootQueue.update((q) => q.filter((r) => r.eventId !== eventId));
  }

  clearHistory(counterId: string): void {
    this.updateNph(counterId, (n) => ({ ...n, history: [] }));
    this.lootQueue.update((q) => q.filter((r) => r.counterId !== counterId));
  }

  addLoot(counterId: string, eventId: string, item: LootItem): void {
    this.updateNph(counterId, (n) => ({
      ...n,
      history: n.history.map((e) => (e.id === eventId ? { ...e, loot: [...e.loot, item] } : e)),
    }));
  }

  removeLoot(counterId: string, eventId: string, index: number): void {
    this.updateNph(counterId, (n) => ({
      ...n,
      history: n.history.map((e) => (e.id === eventId ? { ...e, loot: e.loot.filter((_, i) => i !== index) } : e)),
    }));
  }

  /** Open the loot drawer for an existing named kill (e.g. from the history dialog). */
  openLoot(counterId: string, eventId: string): void {
    this.lootQueue.update((q) => [{ counterId, eventId }, ...q.filter((r) => r.eventId !== eventId)]);
  }

  dismissLoot(): void {
    this.lootQueue.update((q) => q.slice(1));
  }

  resetCounter(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c) return;
    const since = Date.now();
    if (c.kind === 'standard') this.updateCounter(id, { value: 0, since });
    else this.updateCounter(id, { ph: 0, named: 0, phSinceNamed: 0, since });
  }

  resetAllCounters(): void {
    for (const c of this.counters()) this.resetCounter(c.id);
  }

  private restartLinked(c: CounterItem): void {
    if (c.linkedTimerId) this.startTimer(c.linkedTimerId);
  }

  // ---------- buffs ----------

  addBuffPanel(): void {
    this.buffPanels.update((list) => [...list, makeBuffPanel()]);
    this.placeUnplaced();
  }

  removeBuffPanel(id: string): void {
    const p = this.buffPanels().find((x) => x.id === id);
    p?.buffs.forEach((b) => this.clearBuffAlerts(b.id));
    this.buffPanels.update((list) => list.filter((x) => x.id !== id));
  }

  updateBuffPanel(id: string, patch: Partial<BuffPanel>): void {
    this.buffPanels.update((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  private updateBuffs(panelId: string, fn: (buffs: BuffEntry[]) => BuffEntry[]): void {
    this.buffPanels.update((list) => list.map((p) => (p.id === panelId ? { ...p, buffs: fn(p.buffs) } : p)));
  }

  addBuff(panelId: string, durationMs?: number): void {
    this.updateBuffs(panelId, (buffs) => [...buffs, makeBuff(durationMs)]);
  }

  removeBuff(panelId: string, buffId: string): void {
    this.clearBuffAlerts(buffId);
    this.updateBuffs(panelId, (buffs) => buffs.filter((b) => b.id !== buffId));
  }

  updateBuff(panelId: string, buffId: string, patch: Partial<BuffEntry>): void {
    if (patch.name !== undefined) patch = { ...patch, autoNamed: AUTO_BUFF_NAME.test(patch.name) };
    this.updateBuffs(panelId, (buffs) =>
      buffs.map((b) => {
        if (b.id !== buffId) return b;
        const next = { ...b, ...patch };
        // A generated name follows the buff's length.
        if (patch.durationMs !== undefined && patch.name === undefined && b.autoNamed) {
          next.name = autoBuffName(next.durationMs);
        }
        return next;
      }),
    );
  }

  moveBuff(panelId: string, buffId: string, dir: -1 | 1): void {
    this.updateBuffs(panelId, (buffs) => move(buffs, buffId, dir));
  }

  /** (Re)cast: starts the buff's full duration. */
  castBuff(panelId: string, buffId: string): void {
    this.alerts.unlock();
    const b = this.buffPanels().find((p) => p.id === panelId)?.buffs.find((x) => x.id === buffId);
    if (!b) return;
    this.clearBuffAlerts(buffId);
    this.updateBuff(panelId, buffId, { endsAt: Date.now() + b.durationMs });
  }

  /**
   * Sets how long is left on a buff (starting it if needed) without changing its duration, so the next
   * recast still uses the full length. For syncing with the game when a recast click was missed.
   */
  setBuffRemaining(panelId: string, buffId: string, remainingMs: number): void {
    if (remainingMs <= 0) return;
    this.alerts.unlock();
    const b = this.buffPanels().find((p) => p.id === panelId)?.buffs.find((x) => x.id === buffId);
    if (!b) return;
    this.clearBuffAlerts(buffId);
    // You just set it, so don't immediately announce "fading" if it's already inside the warn window.
    if (remainingMs <= b.warnMs) this.buffWarned.add(buffId);
    this.updateBuff(panelId, buffId, { endsAt: Date.now() + remainingMs });
  }

  stopBuff(panelId: string, buffId: string): void {
    this.clearBuffAlerts(buffId);
    this.updateBuff(panelId, buffId, { endsAt: null });
  }

  private clearBuffAlerts(buffId: string): void {
    this.buffWarned.delete(buffId);
    this.buffFaded.delete(buffId);
  }

  // ---------- notes ----------

  addNote(): void {
    this.notes.update((list) => [...list, makeNote()]);
    this.placeUnplaced();
  }

  removeNote(id: string): void {
    this.notes.update((list) => list.filter((n) => n.id !== id));
  }

  updateNote(id: string, patch: Partial<NoteItem>): void {
    this.notes.update((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  /** Bigger (+1) or smaller (-1) note text, within NOTE_FONT limits. */
  stepNoteFont(id: string, dir: -1 | 1): void {
    const n = this.notes().find((x) => x.id === id);
    if (n) this.updateNote(id, { fontSize: clampFont(n.fontSize + dir * NOTE_FONT.step) });
  }

  // ---------- ordering ----------

  moveTimer(id: string, dir: -1 | 1): void {
    this.timers.update((list) => move(list, id, dir));
  }

  moveCounter(id: string, dir: -1 | 1): void {
    this.counters.update((list) => move(list, id, dir));
  }

  // ---------- sound & theme ----------

  toggleSound(): void {
    this.alerts.unlock();
    this.soundOn.update((v) => !v);
  }

  toggleTheme(): void {
    this.theme.update((t) => (t === 'spirit' ? 'classic' : 'spirit'));
  }

  testSound(): void {
    this.alerts.unlock();
    this.alerts.speak('The spirits are listening');
  }

  // ---------- save / load ----------

  exportLayout(): LayoutFile {
    return { app: 'mnm-assistant', savedAt: new Date().toISOString(), state: this.snapshot() };
  }

  /** Replaces everything with a saved layout. Timers and buffs come back stopped. Returns false if the file isn't valid. */
  importLayout(data: unknown): boolean {
    const raw = (data as any)?.state ?? data;
    const state = normalizeState(raw);
    if (!state) return false;
    this.timerAlerted.clear();
    this.buffWarned.clear();
    this.buffFaded.clear();
    this.lootQueue.set([]);
    this.timers.set(state.timers.map((t) => ({ ...t, endsAt: null, pausedRemainingMs: null })));
    this.counters.set(state.counters);
    this.buffPanels.set(
      state.buffPanels.map((p) => ({ ...p, buffs: p.buffs.map((b) => ({ ...b, endsAt: null })) })),
    );
    this.notes.set(state.notes);
    this.soundOn.set(state.soundOn);
    this.theme.set(state.theme);
    this.placeUnplaced();
    return true;
  }

  // ---------- internals ----------

  private tick(): void {
    const now = Date.now();
    this.now.set(now);
    this.tickTimers(now);
    this.tickBuffs(now);
  }

  private tickTimers(now: number): void {
    let changed = false;
    const next = this.timers().map((t) => {
      if (t.endsAt === null || t.endsAt > now || this.timerAlerted.has(t.id)) return t;
      this.timerAlerted.add(t.id);
      this.alert(t.autoNamed, `${t.name} is up`);
      if (!t.repeat) return t;
      // Repeat: schedule next cycle, skipping any cycles missed while asleep.
      let endsAt = t.endsAt;
      while (endsAt <= now) endsAt += t.durationMs;
      this.timerAlerted.delete(t.id);
      changed = true;
      return { ...t, endsAt };
    });
    if (changed) this.timers.set(next);
  }

  private tickBuffs(now: number): void {
    for (const p of this.buffPanels()) {
      for (const b of p.buffs) {
        if (b.endsAt === null) continue;
        const left = b.endsAt - now;
        if (left <= 0) {
          if (!this.buffFaded.has(b.id)) {
            this.buffFaded.add(b.id);
            this.buffWarned.add(b.id);
            this.alert(b.autoNamed, `${b.name} has faded`);
          }
        } else if (left <= b.warnMs && !this.buffWarned.has(b.id)) {
          this.buffWarned.add(b.id);
          this.alert(b.autoNamed, `${b.name} is fading`);
        }
      }
    }
  }

  /** Generic names chime; names you chose are spoken. */
  private alert(generic: boolean, phrase: string): void {
    if (!this.soundOn()) return;
    if (generic) this.alerts.chime();
    else this.alerts.speak(phrase);
  }

  /** Don't replay alerts for things that already expired/warned while the app was closed. */
  private primeAlerts(): void {
    const now = Date.now();
    for (const t of this.timers()) {
      if (t.endsAt !== null && t.endsAt <= now && !t.repeat) this.timerAlerted.add(t.id);
    }
    for (const p of this.buffPanels()) {
      for (const b of p.buffs) {
        if (b.endsAt === null) continue;
        if (b.endsAt <= now) this.buffFaded.add(b.id);
        if (b.endsAt - now <= b.warnMs) this.buffWarned.add(b.id);
      }
    }
  }

  private snapshot(): AppState {
    return {
      version: 4,
      timers: this.timers(),
      counters: this.counters(),
      buffPanels: this.buffPanels(),
      notes: this.notes(),
      soundOn: this.soundOn(),
      theme: this.theme(),
    };
  }

  private load(): void {
    let state: AppState = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = normalizeState(JSON.parse(raw)) ?? state;
    } catch {
      // Corrupt or unavailable storage: fall back to defaults.
    }
    this.timers.set(state.timers);
    this.counters.set(state.counters);
    this.buffPanels.set(state.buffPanels);
    this.notes.set(state.notes);
    this.soundOn.set(state.soundOn);
    this.theme.set(state.theme);
  }

  private save(): void {
    const state = this.snapshot();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }
}

function move<T extends { id: string }>(list: T[], id: string, dir: -1 | 1): T[] {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}
