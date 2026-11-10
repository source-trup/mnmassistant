import { LEVEL_CAP } from './level-range/level-range';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AlertsService } from './alerts.service';
import { PANEL_SIZE, Rect, findFreeSpot, overlaps } from './layout';
import { GRID } from './layout';
import {
  AppState,
  BuffEntry,
  BuffPanel,
  BuffSet,
  CampEvent,
  CampLog,
  CounterItem,
  CounterKind,
  LootItem,
  NamedPhCounter,
  NoteItem,
  CheckItem,
  PlayerEntry,
  PlayerListKind,
  PlayerListPanel,
  LevelPanel,
  SpellPanel,
  StandardCounter,
  Theme,
  TimerItem,
} from './models';
import { DEFAULT_THEME, applyTheme, normalizeThemeId, themeById } from './themes';
import { formatDuration } from './time';

const STORAGE_KEY = 'mnm-assistant.state.v1';
const TICK_MS = 250;
/** Per-camp cap so localStorage can't grow without bound. */
const MAX_HISTORY = 5000;
/** A Named/PH kill logged this long after the previous one starts a new session. */
export const SESSION_GAP_MS = 3_600_000;

/** Names the app generates; timers/buffs still using one of these chime instead of speaking. */
const AUTO_TIMER_NAME = /^(\d+:)?\d+:\d{2} spawn$|^New timer$/;
const AUTO_BUFF_NAME = /^New buff$|^(\d+:)?\d+:\d{2} buff$/;

export type Panel =
  | ({ id: string; kind: 'timer'; item: TimerItem } & Rect)
  | ({ id: string; kind: 'counter'; item: CounterItem } & Rect)
  | ({ id: string; kind: 'buffs'; item: BuffPanel } & Rect)
  | ({ id: string; kind: 'note'; item: NoteItem } & Rect)
  | ({ id: string; kind: 'players'; item: PlayerListPanel } & Rect)
  | ({ id: string; kind: 'levels'; item: LevelPanel } & Rect)
  | ({ id: string; kind: 'spells'; item: SpellPanel } & Rect);

/** Panel id of the single Spells panel, and the smallest it can be resized to (grid cells). */
export const SPELL_PANEL_ID = 'spells';
export const SPELLS_MIN = { w: 15, h: 12 };

/** Panel id of the single Level range panel. */
export const LEVEL_PANEL_ID = 'levels';

export const PLAYER_LISTS: PlayerListKind[] = ['naughty', 'nice'];

/** Board id of a list panel. */
export function listPanelId(kind: PlayerListKind): string {
  return 'list:' + kind;
}

/** Player names compare case-insensitively, ignoring extra spaces. */
export function playerKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function defaultListPanels(): Record<PlayerListKind, PlayerListPanel> {
  return {
    naughty: { kind: 'naughty', shown: false, ...UNPLACED },
    nice: { kind: 'nice', shown: false, ...UNPLACED },
  };
}

function normalizePlayers(raw: any): Record<PlayerListKind, PlayerEntry[]> {
  const out = { naughty: [] as PlayerEntry[], nice: [] as PlayerEntry[] };
  for (const kind of PLAYER_LISTS) {
    const seen = new Set<string>();
    for (const p of Array.isArray(raw?.[kind]) ? raw[kind] : []) {
      const name = typeof p?.name === 'string' ? p.name.trim().replace(/\s+/g, ' ') : '';
      if (!name || seen.has(playerKey(name))) continue;
      seen.add(playerKey(name));
      out[kind].push({ name, note: typeof p.note === 'string' ? p.note : '', added: Number(p.added) || Date.now() });
    }
  }
  return out;
}

function defaultLevelPanel(): LevelPanel {
  return { shown: false, level: null, ...UNPLACED };
}

function defaultSpellPanel(): SpellPanel {
  return { shown: false, ...PANEL_SIZE.spells, cls: 'Shaman', level: null, ...UNPLACED };
}

function normalizeSpellPanel(raw: any): SpellPanel {
  const base = defaultSpellPanel();
  if (!raw || typeof raw !== 'object') return base;
  const level = Math.floor(Number(raw.level));
  return {
    shown: raw.shown === true,
    w: Math.max(SPELLS_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(SPELLS_MIN.h, Math.floor(Number(raw.h)) || base.h),
    cls: typeof raw.cls === 'string' && raw.cls ? raw.cls : raw.cls === null ? null : base.cls,
    level: level >= 1 && level <= LEVEL_CAP ? level : null,
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function normalizeLevelPanel(raw: any): LevelPanel {
  if (!raw || typeof raw !== 'object') return defaultLevelPanel();
  const level = Math.floor(Number(raw.level));
  return {
    shown: raw.shown === true,
    level: level >= 1 && level <= LEVEL_CAP ? level : null,
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function normalizeListPanels(raw: any): Record<PlayerListKind, PlayerListPanel> {
  const out = defaultListPanels();
  for (const kind of PLAYER_LISTS) {
    const p = raw?.[kind];
    if (p) out[kind] = { kind, shown: p.shown === true, x: p.x ?? -1, y: p.y ?? -1 };
  }
  return out;
}

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
    : { ...base, kind, name: name ?? DEFAULT_NPH_NAME, ph: 0, named: 0, phSinceNamed: 0 };
}

const DEFAULT_NPH_NAME = 'Named / PH';

/** Name a Named/PH counter gets when linked to a timer you've named. */
function campLogName(timerName: string): string {
  return `${timerName}'s log`;
}

function npcKey(npc: string): string {
  return 'npc:' + npc.trim().toLowerCase();
}

/** Which log a Named/PH counter writes to: its named timer's NPC, or its own private log. */
function logKeyFor(c: { id: string; linkedTimerId: string | null }, timers: TimerItem[]): string {
  const t = c.linkedTimerId ? timers.find((x) => x.id === c.linkedTimerId) : undefined;
  return t && !t.autoNamed && t.name.trim() ? npcKey(t.name) : 'counter:' + c.id;
}

/** Merges two kill lists (no duplicates), oldest first. */
function mergeHistory(a: CampEvent[], b: CampEvent[]): CampEvent[] {
  const ids = new Set(a.map((e) => e.id));
  return [...a, ...b.filter((e) => !ids.has(e.id))].sort((x, y) => x.t - y.t).slice(-MAX_HISTORY);
}

/** Adds items to a library, one entry per name (case-insensitive); a wiki link is kept once known. */
function addToLibrary(library: LootItem[], items: LootItem[]): LootItem[] {
  const byName = new Map(library.map((i) => [i.name.toLowerCase(), i]));
  let changed = false;
  for (const item of items) {
    const name = item?.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { ...item, name });
      changed = true;
    } else if (!prev.url && item.url) {
      byName.set(key, { ...prev, url: item.url, wikiId: item.wikiId });
      changed = true;
    }
  }
  return changed ? [...byName.values()] : library;
}

function normalizeLootLibrary(raw: unknown, logs: CampLog[]): LootItem[] {
  const saved = Array.isArray(raw) ? raw.filter((i: any) => i && typeof i.name === 'string') : [];
  // Older saves had no library: seed it from every logged drop.
  return addToLibrary(saved, logs.flatMap((l) => l.history.flatMap((e) => e.loot ?? [])));
}

function normalizeLogs(parsed: any, timers: TimerItem[]): CampLog[] {
  const logs = new Map<string, CampLog>();
  const add = (key: string, name: string, history: CampEvent[]) => {
    const prev = logs.get(key);
    logs.set(key, { key, name: prev?.name ?? name, history: mergeHistory(prev?.history ?? [], history) });
  };
  for (const l of Array.isArray(parsed.campLogs) ? parsed.campLogs : []) {
    if (l && typeof l.key === 'string' && Array.isArray(l.history)) add(l.key, String(l.name ?? ''), l.history);
  }
  // Before v5 each counter kept its own history: move it to the NPC's log (or the counter's private log).
  for (const c of parsed.counters) {
    if (c?.kind !== 'namedPh' || !Array.isArray(c.history) || !c.history.length) continue;
    const key = logKeyFor(c, timers);
    const t = timers.find((x) => x.id === c.linkedTimerId);
    add(key, key.startsWith('npc:') && t ? t.name : String(c.name ?? ''), c.history);
  }
  return [...logs.values()];
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

function makeNote(type: NoteItem['type'] = 'text'): NoteItem {
  const size = type === 'checklist' ? PANEL_SIZE.checklist : PANEL_SIZE.note;
  return {
    id: newId(),
    name: type === 'checklist' ? 'Checklist' : 'Note',
    type,
    text: '',
    items: [],
    fontSize: NOTE_FONT.default,
    ...size,
    closed: false,
    ...UNPLACED,
  };
}

/** Smallest a note can be resized to, in grid cells. */
export const NOTE_MIN = { w: 12, h: 6 };

function normalizeCheckItems(raw: unknown): CheckItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => i && typeof i.text === 'string' && i.text.trim())
    .map((i) => ({
      id: typeof i.id === 'string' ? i.id : newId(),
      text: i.text.trim(),
      qty: Number(i.qty) > 0 ? Math.floor(Number(i.qty)) : null,
      done: i.done === true,
      ...(typeof i.from === 'string' && i.from ? { from: i.from } : {}),
    }));
}

function normalizeNote(n: any): NoteItem {
  const base = makeNote(n.type === 'checklist' ? 'checklist' : 'text');
  return {
    ...base,
    ...n,
    type: base.type,
    text: typeof n.text === 'string' ? n.text : '',
    items: normalizeCheckItems(n.items),
    fontSize: clampFont(Number(n.fontSize) || NOTE_FONT.default),
    w: Math.max(NOTE_MIN.w, Math.floor(Number(n.w)) || base.w),
    h: Math.max(NOTE_MIN.h, Math.floor(Number(n.h)) || base.h),
    closed: n.closed === true,
    x: n.x ?? -1,
    y: n.y ?? -1,
  };
}

function clampFont(px: number): number {
  return Math.min(NOTE_FONT.max, Math.max(NOTE_FONT.min, px));
}

function defaultState(): AppState {
  const camp = makeTimer(6 * 60_000, 'Camp spawn');
  const nph = makeCounter('namedPh', campLogName(camp.name)) as NamedPhCounter;
  nph.linkedTimerId = camp.id;
  return {
    version: 5,
    soundOn: true,
    theme: DEFAULT_THEME,
    timers: [camp],
    counters: [nph, makeCounter('standard', 'Kills')],
    campLogs: [],
    lootLibrary: [],
    buffPanels: [],
    buffSets: [],
    notes: [],
    players: { naughty: [], nice: [] },
    listPanels: defaultListPanels(),
    levelPanel: defaultLevelPanel(),
    spellPanel: defaultSpellPanel(),
  };
}

function normalizeBuffSets(raw: unknown): BuffSet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s: any) => s && typeof s.name === 'string' && Array.isArray(s.buffs))
    .map((s: any) => ({
      id: typeof s.id === 'string' ? s.id : newId(),
      name: s.name,
      buffs: s.buffs
        .filter((b: any) => b && typeof b.name === 'string' && Number(b.durationMs) > 0)
        .map((b: any) => ({ name: b.name, durationMs: Number(b.durationMs), warnMs: Number(b.warnMs) || 60_000 })),
    }));
}

function normalizeCounter(raw: any): CounterItem {
  const pos = { x: raw.x ?? -1, y: raw.y ?? -1 };
  if (raw.kind === 'namedPh') {
    const { history: _moved, ...rest } = raw; // history now lives in campLogs
    return { ...makeCounter('namedPh'), ...rest, ...pos };
  }
  return { ...makeCounter('standard'), ...raw, kind: 'standard', ...pos };
}

/** Accepts state saved by any version of the app (or a layout file) and upgrades it. */
function normalizeState(parsed: any): AppState | null {
  if (!parsed || ![1, 2, 3, 4, 5].includes(parsed.version)) return null;
  if (!Array.isArray(parsed.timers) || !Array.isArray(parsed.counters)) return null;
  const timers: TimerItem[] = parsed.timers.map((t: any) => ({
    repeat: false,
    endsAt: null,
    pausedRemainingMs: null,
    ...t,
    autoNamed: t.autoNamed ?? AUTO_TIMER_NAME.test(t.name ?? ''),
    x: t.x ?? -1,
    y: t.y ?? -1,
  }));
  const campLogs = normalizeLogs(parsed, timers);
  return {
    version: 5,
    campLogs,
    lootLibrary: normalizeLootLibrary(parsed.lootLibrary, campLogs),
    soundOn: parsed.soundOn ?? true,
    theme: normalizeThemeId(parsed.theme),
    buffSets: normalizeBuffSets(parsed.buffSets),
    players: normalizePlayers(parsed.players),
    listPanels: normalizeListPanels(parsed.listPanels),
    levelPanel: normalizeLevelPanel(parsed.levelPanel),
    spellPanel: normalizeSpellPanel(parsed.spellPanel),
    notes: (Array.isArray(parsed.notes) ? parsed.notes : []).filter((n: any) => n && typeof n === 'object').map(normalizeNote),
    timers,
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
  /** Kill history per named NPC (and per un-named camp). */
  readonly campLogs = signal<CampLog[]>([]);
  /** Every loot name ever entered, for autocomplete everywhere. */
  readonly lootLibrary = signal<LootItem[]>([]);
  readonly buffPanels = signal<BuffPanel[]>([]);
  readonly notes = signal<NoteItem[]>([]);
  /** Naughty / Nice player lists, and their single panels. */
  readonly players = signal<Record<PlayerListKind, PlayerEntry[]>>({ naughty: [], nice: [] });
  readonly listPanels = signal<Record<PlayerListKind, PlayerListPanel>>(defaultListPanels());
  readonly levelPanel = signal<LevelPanel>(defaultLevelPanel());
  readonly spellPanel = signal<SpellPanel>(defaultSpellPanel());
  /** Saved buff lists, sorted by name when shown. */
  readonly buffSets = signal<BuffSet[]>([]);
  readonly soundOn = signal(true);
  readonly theme = signal<Theme>(DEFAULT_THEME);
  /** Named kills waiting for loot entry; the first one is shown in the loot drawer. */
  readonly lootQueue = signal<LootRequest[]>([]);
  /** Board width in grid cells; kept up to date by the app shell. */
  readonly cols = signal(Math.max(15, Math.floor((window.innerWidth - 32) / GRID)));

  /** Every panel on the board with its grid footprint. */
  readonly panels = computed<Panel[]>(() => [
    ...this.timers().map((t) => ({ id: t.id, kind: 'timer' as const, item: t, x: t.x, y: t.y, ...PANEL_SIZE.timer })),
    ...this.counters().map((c) => ({ id: c.id, kind: 'counter' as const, item: c, x: c.x, y: c.y, ...PANEL_SIZE[c.kind] })),
    ...this.buffPanels().map((b) => ({ id: b.id, kind: 'buffs' as const, item: b, x: b.x, y: b.y, ...PANEL_SIZE.buffs })),
    ...this.notes()
      .filter((n) => !n.closed)
      .map((n) => ({ id: n.id, kind: 'note' as const, item: n, x: n.x, y: n.y, w: n.w, h: n.h })),
    ...PLAYER_LISTS.map((k) => this.listPanels()[k])
      .filter((p) => p.shown)
      .map((p) => ({ id: listPanelId(p.kind), kind: 'players' as const, item: p, x: p.x, y: p.y, ...PANEL_SIZE.players })),
    ...[this.levelPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: LEVEL_PANEL_ID, kind: 'levels' as const, item: p, x: p.x, y: p.y, ...PANEL_SIZE.levels })),
    ...[this.spellPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: SPELL_PANEL_ID, kind: 'spells' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
  ]);

  /** Notes that have been put away, in the order they were created. */
  readonly closedNotes = computed(() => this.notes().filter((n) => n.closed));

  /** Every distinct item ever entered, most recent first (for autocomplete). */
  readonly knownItems = computed<LootItem[]>(() => {
    const seen = new Map<string, LootItem>();
    const events = this.campLogs()
      .flatMap((l) => l.history)
      .sort((a, b) => b.t - a.t);
    for (const e of events) {
      for (const item of e.loot) {
        const key = item.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, item);
      }
    }
    // Then everything else you've ever entered, even if its kill log is gone.
    for (const item of this.lootLibrary()) {
      const key = item.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, item);
    }
    return [...seen.values()];
  });

  /** Named NPCs you've tracked, A–Z, with a short summary (for the timer-name suggestions). */
  readonly npcs = computed<{ name: string; detail: string; kills: number }[]>(() => {
    const out = new Map<string, { name: string; detail: string; kills: number }>();
    for (const l of this.campLogs()) {
      if (!l.key.startsWith('npc:') || !l.name.trim()) continue;
      const named = l.history.filter((e) => e.type === 'named').length;
      const kills = l.history.length;
      const detail = kills ? `${kills} kill${kills === 1 ? '' : 's'} · ${named} named` : 'no kills yet';
      out.set(l.key, { name: l.name.trim(), detail, kills });
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  });

  /** Alert bookkeeping (not persisted). */
  private readonly timerAlerted = new Set<string>();
  private readonly buffWarned = new Set<string>();
  private readonly buffFaded = new Set<string>();

  constructor() {
    this.load();
    this.placeUnplaced();
    this.repairOverlaps();
    this.primeAlerts();
    effect(() => this.save());
    effect(() => applyTheme(themeById(this.theme())));
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
    else if (id.startsWith('list:')) this.updateListPanel(id.slice(5) as PlayerListKind, { x, y });
    else if (id === LEVEL_PANEL_ID) this.updateLevelPanel({ x, y });
    else if (id === SPELL_PANEL_ID) this.updateSpellPanel({ x, y });
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
    this.notes.update((list) => list.map((n) => ({ ...n, ...pos.get(n.id) }))); // closed notes aren't in `pos`
    for (const k of PLAYER_LISTS) {
      const spot = pos.get(listPanelId(k)); // hidden lists aren't in `pos`
      if (spot) this.updateListPanel(k, spot);
    }
    const levelSpot = pos.get(LEVEL_PANEL_ID);
    if (levelSpot) this.updateLevelPanel(levelSpot);
    const spellSpot = pos.get(SPELL_PANEL_ID);
    if (spellSpot) this.updateSpellPanel(spellSpot);
  }

  /** Panels saved with older (narrower) sizes may now overlap; if any do, tidy the board once. */
  private repairOverlaps(): void {
    const ps = this.panels();
    const clash = ps.some((a, i) => ps.slice(i + 1).some((b) => overlaps(a, b)));
    if (clash) this.autoArrange();
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
    this.notes.update((list) => list.map((n) => (n.closed ? n : place(n, n))));
    this.listPanels.update((lp) => {
      const next = { ...lp };
      for (const k of PLAYER_LISTS) if (lp[k].shown) next[k] = place(lp[k], PANEL_SIZE.players);
      return next;
    });
    this.levelPanel.update((p) => (p.shown ? place(p, PANEL_SIZE.levels) : p));
    this.spellPanel.update((p) => (p.shown ? place(p, p) : p));
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
    const old = this.timers().find((t) => t.id === id);
    if (!old) return;
    const autoNamed = AUTO_TIMER_NAME.test(name);
    this.updateTimer(id, { name, autoNamed });
    // Linked Named/PH counters still using a generated name follow the timer ("Grimfang's log").
    this.counters.update(
      (list) =>
        list.map((c) => {
          if (c.kind !== 'namedPh' || c.linkedTimerId !== id || !this.isAutoCampName(c.name, old.name)) return c;
          return { ...c, name: autoNamed ? DEFAULT_NPH_NAME : campLogName(name) };
        }) as CounterItem[],
    );
    this.adoptPrivateLogs();
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

  /** Deletes the counter. A named NPC's history is kept; a camp's private (un-named) log goes with it. */
  removeCounter(id: string): void {
    this.counters.update((list) => list.filter((c) => c.id !== id));
    this.campLogs.update((logs) => logs.filter((l) => l.key !== 'counter:' + id));
    this.lootQueue.update((q) => q.filter((r) => r.counterId !== id));
  }

  updateCounter(id: string, patch: Partial<StandardCounter> | Partial<NamedPhCounter>): void {
    const before = this.counters().find((c) => c.id === id);
    if (before?.kind === 'namedPh' && patch.linkedTimerId !== undefined && patch.name === undefined) {
      // Linking a Named/PH counter names it after the timer ("Grimfang's log") unless you've named it yourself.
      const prev = this.timers().find((t) => t.id === before.linkedTimerId);
      const next = this.timers().find((t) => t.id === patch.linkedTimerId);
      if (this.isAutoCampName(before.name, prev?.name)) {
        patch = { ...patch, name: next && !next.autoNamed ? campLogName(next.name) : DEFAULT_NPH_NAME };
      }
    }
    this.counters.update((list) => list.map((c) => (c.id === id ? ({ ...c, ...patch } as CounterItem) : c)));
    if (patch.linkedTimerId !== undefined) this.adoptPrivateLogs();
  }

  /** True for names the app gave a Named/PH counter (so it may rename it). */
  private isAutoCampName(name: string, linkedTimerName?: string): boolean {
    return (
      name === DEFAULT_NPH_NAME ||
      name === 'Camp named / PH' ||
      (linkedTimerName !== undefined && name === campLogName(linkedTimerName))
    );
  }

  private updateNph(id: string, fn: (c: NamedPhCounter) => NamedPhCounter): void {
    this.counters.update((list) => list.map((c) => (c.id === id && c.kind === 'namedPh' ? fn(c) : c)));
  }

  // ---------- camp logs (kill history per named NPC) ----------

  /** Key of the log a counter reads and writes. */
  logKeyOf(c: CounterItem): string {
    return logKeyFor(c, this.timers());
  }

  /** Kill history for a Named/PH counter: its named NPC's log, or its own. */
  historyOf(c: CounterItem): CampEvent[] {
    const key = this.logKeyOf(c);
    return this.campLogs().find((l) => l.key === key)?.history ?? [];
  }

  /** The NPC whose history a counter shows, or null when it isn't linked to a timer you've named. */
  npcOf(c: CounterItem): string | null {
    const key = this.logKeyOf(c);
    if (!key.startsWith('npc:')) return null;
    return this.timers().find((t) => t.id === c.linkedTimerId)?.name ?? null;
  }

  /** Finds a logged kill anywhere. */
  findEvent(eventId: string): CampEvent | undefined {
    for (const l of this.campLogs()) {
      const e = l.history.find((x) => x.id === eventId);
      if (e) return e;
    }
    return undefined;
  }

  private updateLog(key: string, name: string, fn: (history: CampEvent[]) => CampEvent[]): void {
    this.campLogs.update((logs) => {
      const i = logs.findIndex((l) => l.key === key);
      if (i < 0) return [...logs, { key, name, history: fn([]) }];
      const copy = [...logs];
      copy[i] = { ...copy[i], history: fn(copy[i].history) };
      return copy;
    });
  }

  private logNameFor(c: CounterItem): string {
    return this.npcOf(c) ?? c.name;
  }

  private updateEvent(eventId: string, fn: (e: CampEvent) => CampEvent): void {
    this.campLogs.update((logs) =>
      logs.map((l) =>
        l.history.some((e) => e.id === eventId)
          ? { ...l, history: l.history.map((e) => (e.id === eventId ? fn(e) : e)) }
          : l,
      ),
    );
  }

  /**
   * When a camp gets tied to a named NPC (linked to, or renaming, a timer), kills it logged before that move into
   * the NPC's history so nothing is left behind.
   */
  private adoptPrivateLogs(): void {
    for (const c of this.counters()) {
      if (c.kind !== 'namedPh') continue;
      const key = this.logKeyOf(c);
      if (!key.startsWith('npc:')) continue;
      // Remember the NPC right away (even before any kills), so its name is offered again later.
      this.updateLog(key, this.logNameFor(c), (h) => h);
      const own = this.campLogs().find((l) => l.key === 'counter:' + c.id);
      if (!own) continue;
      this.updateLog(key, this.logNameFor(c), (h) => mergeHistory(h, own.history));
      this.campLogs.update((logs) => logs.filter((l) => l !== own));
    }
  }

  /** Items this counter's NPC (or camp) has dropped, most often first. */
  dropsOf(c: CounterItem): { item: LootItem; count: number }[] {
    const counts = new Map<string, { item: LootItem; count: number }>();
    for (const e of this.historyOf(c)) {
      for (const item of e.loot) {
        const key = item.name.toLowerCase();
        const row = counts.get(key) ?? { item, count: 0 };
        row.count++;
        counts.set(key, row);
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name));
  }

  /** Forgets a named NPC and its whole kill history (counters linked to it start a fresh log). */
  forgetNpc(name: string): void {
    const key = npcKey(name);
    this.campLogs.update((logs) => logs.filter((l) => l.key !== key));
  }

  npcLog(name: string): CampLog | undefined {
    const key = npcKey(name);
    return this.campLogs().find((l) => l.key === key);
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
    this.autoSession(c);
    const event: CampEvent = { id: newId(), t: Date.now(), type: 'ph', loot: [] };
    this.updateNph(id, (n) => ({ ...n, ph: n.ph + 1, phSinceNamed: n.phSinceNamed + 1 }));
    this.updateLog(this.logKeyOf(c), this.logNameFor(c), (h) => [...h, event].slice(-MAX_HISTORY));
  }

  /** Named killed: +1 named, log it, restart the linked timer, then offer loot entry. */
  namedKill(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    this.restartLinked(c);
    this.autoSession(c);
    const event: CampEvent = { id: newId(), t: Date.now(), type: 'named', loot: [] };
    this.updateNph(id, (n) => ({ ...n, named: n.named + 1, phSinceNamed: 0 }));
    this.updateLog(this.logKeyOf(c), this.logNameFor(c), (h) => [...h, event].slice(-MAX_HISTORY));
    this.lootQueue.update((q) => [...q, { counterId: id, eventId: event.id }]);
  }

  /** Undo a mis-click on a Named/PH counter: removes the latest kill of that type (does not touch the timer). */
  undo(id: string, type: 'ph' | 'named'): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    const last = [...this.historyOf(c)].reverse().find((e) => e.type === type && e.t >= c.since);
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
    const c = this.counters().find((x) => x.id === counterId);
    if (!c || c.kind !== 'namedPh') return;
    const history = this.historyOf(c);
    const e = history.find((x) => x.id === eventId);
    if (!e) return;
    if (e.t >= c.since) {
      // Part of this counter's current session: correct the counts too.
      if (e.type === 'named') {
        this.updateNph(counterId, (n) => ({ ...n, named: Math.max(0, n.named - 1) }));
      } else {
        const lastNamed = [...history].reverse().find((x) => x.type === 'named');
        const inStreak = !lastNamed || e.t > lastNamed.t;
        this.updateNph(counterId, (n) => ({
          ...n,
          ph: Math.max(0, n.ph - 1),
          phSinceNamed: inStreak ? Math.max(0, n.phSinceNamed - 1) : n.phSinceNamed,
        }));
      }
    }
    this.updateLog(this.logKeyOf(c), this.logNameFor(c), (h) => h.filter((x) => x.id !== eventId));
    this.lootQueue.update((q) => q.filter((r) => r.eventId !== eventId));
  }

  /** Erases the kill log this counter shows (the named NPC's whole history, if it's tied to one). */
  clearHistory(counterId: string): void {
    const c = this.counters().find((x) => x.id === counterId);
    if (!c) return;
    const ids = new Set(this.historyOf(c).map((e) => e.id));
    this.updateLog(this.logKeyOf(c), this.logNameFor(c), () => []);
    this.lootQueue.update((q) => q.filter((r) => !ids.has(r.eventId)));
  }

  addLoot(_counterId: string, eventId: string, item: LootItem): void {
    this.updateEvent(eventId, (e) => ({ ...e, loot: [...e.loot, item] }));
    this.lootLibrary.update((lib) => addToLibrary(lib, [item]));
  }

  removeLoot(_counterId: string, eventId: string, index: number): void {
    this.updateEvent(eventId, (e) => ({ ...e, loot: e.loot.filter((_, i) => i !== index) }));
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

  /** Starts a new Named/PH session: the counts go back to 0 and "Session" stats start from now. The log is kept. */
  newSession(id: string): void {
    this.resetCounter(id);
  }

  /**
   * Called just before a kill is logged: if the camp's last logged kill is over an hour old
   * (and no session was started since), this kill opens a new session.
   */
  private autoSession(c: NamedPhCounter): void {
    const last = this.historyOf(c).at(-1);
    if (last && Date.now() - last.t >= SESSION_GAP_MS && c.since <= last.t) this.newSession(c.id);
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

  // ---------- buff sets ----------

  findBuffSet(name: string): BuffSet | undefined {
    const key = name.trim().toLowerCase();
    return this.buffSets().find((s) => s.name.toLowerCase() === key);
  }

  /** Saves a panel's buffs (names and timings) as a set; a set with the same name is replaced. */
  saveBuffSet(panelId: string, name: string): void {
    const panel = this.buffPanels().find((p) => p.id === panelId);
    name = name.trim();
    if (!panel || !name) return;
    const buffs = panel.buffs.map((b) => ({ name: b.name, durationMs: b.durationMs, warnMs: b.warnMs }));
    const existing = this.findBuffSet(name);
    this.buffSets.update((sets) =>
      existing
        ? sets.map((s) => (s.id === existing.id ? { ...s, name, buffs } : s))
        : [...sets, { id: newId(), name, buffs }],
    );
  }

  /** Replaces a panel's buffs with a saved set. The loaded buffs start idle. */
  loadBuffSet(panelId: string, setId: string): void {
    const set = this.buffSets().find((s) => s.id === setId);
    const panel = this.buffPanels().find((p) => p.id === panelId);
    if (!set || !panel) return;
    panel.buffs.forEach((b) => this.clearBuffAlerts(b.id));
    const buffs: BuffEntry[] = set.buffs.map((b) => ({ ...makeBuff(b.durationMs, b.name), warnMs: b.warnMs }));
    for (const b of buffs) b.autoNamed = AUTO_BUFF_NAME.test(b.name);
    this.updateBuffs(panelId, () => buffs);
  }

  deleteBuffSet(id: string): void {
    this.buffSets.update((sets) => sets.filter((s) => s.id !== id));
  }

  private clearBuffAlerts(buffId: string): void {
    this.buffWarned.delete(buffId);
    this.buffFaded.delete(buffId);
  }

  // ---------- notes ----------

  addNote(type: NoteItem['type'] = 'text'): void {
    this.notes.update((list) => [...list, makeNote(type)]);
    this.placeUnplaced();
  }

  // ---------- checklists ----------

  private updateItems(id: string, fn: (items: CheckItem[]) => CheckItem[]): void {
    this.notes.update((list) => list.map((n) => (n.id === id ? { ...n, items: fn(n.items) } : n)));
  }

  /**
   * Adds lines to a checklist. A line whose name is already on the list adds to that line's count
   * (and unchecks it) instead of making a duplicate. Returns how many lines were added or updated.
   */
  addCheckItems(id: string, parsed: { text: string; qty: number | null; from?: string }[]): number {
    if (!parsed.length) return 0;
    this.updateItems(id, (items) => {
      const next = [...items];
      for (const p of parsed) {
        const i = next.findIndex((x) => x.text.toLowerCase() === p.text.toLowerCase());
        if (i >= 0) {
          const cur = next[i];
          const qty = cur.qty || p.qty ? (cur.qty ?? 1) + (p.qty ?? 1) : null;
          next[i] = { ...cur, qty, done: false, ...(p.from && !cur.from ? { from: p.from } : {}) };
        } else {
          next.push({ id: newId(), text: p.text, qty: p.qty, done: false, ...(p.from ? { from: p.from } : {}) });
        }
      }
      return next;
    });
    return parsed.length;
  }

  toggleCheckItem(id: string, itemId: string): void {
    this.updateItems(id, (items) => items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)));
  }

  updateCheckItem(id: string, itemId: string, patch: Partial<CheckItem>): void {
    this.updateItems(id, (items) => items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  }

  /** Removes a line; returns it (and its position) so it can be put back. */
  removeCheckItem(id: string, itemId: string): { item: CheckItem; index: number } | null {
    const n = this.notes().find((x) => x.id === id);
    const index = n?.items.findIndex((i) => i.id === itemId) ?? -1;
    if (!n || index < 0) return null;
    const item = n.items[index];
    this.updateItems(id, (items) => items.filter((i) => i.id !== itemId));
    return { item, index };
  }

  restoreCheckItems(id: string, items: CheckItem[]): void {
    this.updateItems(id, () => items);
  }

  /** Removes every checked line. */
  clearCheckedItems(id: string): void {
    this.updateItems(id, (items) => items.filter((i) => !i.done));
  }

  /** Unchecks every line (start the list over). */
  uncheckAllItems(id: string): void {
    this.updateItems(id, (items) => items.map((i) => (i.done ? { ...i, done: false } : i)));
  }

  /** Takes a note off the board, keeping its text. */
  closeNote(id: string): void {
    this.updateNote(id, { closed: true });
  }

  /** Puts a saved note back on the board: in its old spot if that's still free, otherwise the first free spot. */
  openNote(id: string): void {
    const n = this.notes().find((x) => x.id === id);
    if (!n || !n.closed) return;
    const fits = n.x >= 0 && n.y >= 0 && this.canPlace(id, { x: n.x, y: n.y, w: n.w, h: n.h });
    this.updateNote(id, { closed: false, ...(fits ? {} : UNPLACED) });
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

  // ---------- spells ----------

  updateSpellPanel(patch: Partial<SpellPanel>): void {
    this.spellPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Spells panel (it comes back in its old spot if that's still free). */
  toggleSpells(): void {
    const p = this.spellPanel();
    if (p.shown) {
      this.updateSpellPanel({ shown: false });
      return;
    }
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(SPELL_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h });
    this.updateSpellPanel({ shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** Smallest size a panel can be resized to, or null if it can't be resized. */
  minSize(p: Panel): { w: number; h: number } | null {
    return p.kind === 'note' ? NOTE_MIN : p.kind === 'spells' ? SPELLS_MIN : null;
  }

  /** Resizes a note or the Spells panel (grid cells) if the new footprint is free. */
  resizePanel(id: string, w: number, h: number): boolean {
    const p = this.panels().find((x) => x.id === id);
    const min = p && this.minSize(p);
    if (!p || !min || w < min.w || h < min.h || p.x + w - 1 > this.cols()) return false;
    if (!this.canPlace(id, { x: p.x, y: p.y, w, h })) return false;
    if (p.kind === 'spells') this.updateSpellPanel({ w, h });
    else this.updateNote(id, { w, h });
    return true;
  }

  // ---------- level range ----------

  private updateLevelPanel(patch: Partial<LevelPanel>): void {
    this.levelPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Level range panel (it comes back in its old spot if that's still free). */
  toggleLevels(): void {
    const p = this.levelPanel();
    if (p.shown) {
      this.updateLevelPanel({ shown: false });
      return;
    }
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(LEVEL_PANEL_ID, { x: p.x, y: p.y, ...PANEL_SIZE.levels });
    this.updateLevelPanel({ shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** Remembers the level typed into the Level range panel (null clears it). */
  setLevel(level: number | null): void {
    this.updateLevelPanel({ level: level !== null && level >= 1 && level <= LEVEL_CAP ? Math.floor(level) : null });
  }

  // ---------- naughty / nice lists ----------

  private updateListPanel(kind: PlayerListKind, patch: Partial<PlayerListPanel>): void {
    this.listPanels.update((lp) => ({ ...lp, [kind]: { ...lp[kind], ...patch } }));
  }

  /** Shows or hides a list's panel (its names are always kept). Reappears in its old spot if that's free. */
  toggleList(kind: PlayerListKind): void {
    const p = this.listPanels()[kind];
    if (p.shown) {
      this.updateListPanel(kind, { shown: false });
      return;
    }
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(listPanelId(kind), { x: p.x, y: p.y, ...PANEL_SIZE.players });
    this.updateListPanel(kind, { shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** Which list a player is on, if any. */
  findPlayer(name: string): { kind: PlayerListKind; entry: PlayerEntry } | null {
    const key = playerKey(name);
    if (!key) return null;
    for (const kind of PLAYER_LISTS) {
      const entry = this.players()[kind].find((p) => playerKey(p.name) === key);
      if (entry) return { kind, entry };
    }
    return null;
  }

  /**
   * Adds a player to a list. If they're on the other list they move over (keeping their note).
   * Returns what happened.
   */
  addPlayer(kind: PlayerListKind, name: string): 'added' | 'moved' | 'exists' | 'invalid' {
    name = name.trim().replace(/\s+/g, ' ');
    if (!name) return 'invalid';
    const found = this.findPlayer(name);
    if (found?.kind === kind) return 'exists';
    const entry: PlayerEntry = found ? { ...found.entry, added: Date.now() } : { name, note: '', added: Date.now() };
    this.players.update((lists) => {
      const next = { ...lists, [kind]: [...lists[kind], entry] };
      if (found) next[found.kind] = lists[found.kind].filter((p) => p !== found.entry);
      return next;
    });
    return found ? 'moved' : 'added';
  }

  /** Removes a player; returns the entry so it can be restored (undo). */
  removePlayer(kind: PlayerListKind, name: string): PlayerEntry | null {
    const key = playerKey(name);
    const entry = this.players()[kind].find((p) => playerKey(p.name) === key) ?? null;
    if (entry) this.players.update((lists) => ({ ...lists, [kind]: lists[kind].filter((p) => p !== entry) }));
    return entry;
  }

  restorePlayer(kind: PlayerListKind, entry: PlayerEntry): void {
    if (this.findPlayer(entry.name)) return;
    this.players.update((lists) => ({ ...lists, [kind]: [...lists[kind], entry] }));
  }

  setPlayerNote(kind: PlayerListKind, name: string, note: string): void {
    const key = playerKey(name);
    this.players.update((lists) => ({
      ...lists,
      [kind]: lists[kind].map((p) => (playerKey(p.name) === key ? { ...p, note: note.trim() } : p)),
    }));
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

  setTheme(id: Theme): void {
    this.theme.set(normalizeThemeId(id));
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
    // Kill history is kept per NPC, so a layout file adds to it instead of erasing what you have.
    this.campLogs.update((mine) => {
      const merged = new Map(mine.map((l) => [l.key, l]));
      for (const l of state.campLogs) {
        const prev = merged.get(l.key);
        merged.set(l.key, prev ? { ...prev, history: mergeHistory(prev.history, l.history) } : l);
      }
      return [...merged.values()];
    });
    this.lootLibrary.update((lib) => addToLibrary(lib, state.lootLibrary));
    this.buffPanels.set(
      state.buffPanels.map((p) => ({ ...p, buffs: p.buffs.map((b) => ({ ...b, endsAt: null })) })),
    );
    this.notes.set(state.notes);
    // Player lists are kept across layouts: the file's names are added to yours (yours win on conflicts).
    this.players.update((mine) => {
      const next = { naughty: [...mine.naughty], nice: [...mine.nice] };
      const known = new Set([...mine.naughty, ...mine.nice].map((p) => playerKey(p.name)));
      for (const k of PLAYER_LISTS) {
        for (const p of state.players[k]) if (!known.has(playerKey(p.name))) next[k].push(p);
      }
      return next;
    });
    this.listPanels.set(state.listPanels);
    this.levelPanel.set(state.levelPanel);
    this.spellPanel.set(state.spellPanel);
    // Buff sets are a library, so a layout file adds to them instead of wiping yours (same name: the file's wins).
    const incoming = new Set(state.buffSets.map((s) => s.name.toLowerCase()));
    this.buffSets.update((mine) => [...mine.filter((s) => !incoming.has(s.name.toLowerCase())), ...state.buffSets]);
    this.soundOn.set(state.soundOn);
    this.theme.set(state.theme);
    this.placeUnplaced();
    this.repairOverlaps();
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
      version: 5,
      timers: this.timers(),
      counters: this.counters(),
      campLogs: this.campLogs(),
      lootLibrary: this.lootLibrary(),
      buffPanels: this.buffPanels(),
      buffSets: this.buffSets(),
      notes: this.notes(),
      players: this.players(),
      listPanels: this.listPanels(),
      levelPanel: this.levelPanel(),
      spellPanel: this.spellPanel(),
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
    this.campLogs.set(state.campLogs);
    this.lootLibrary.set(state.lootLibrary);
    this.buffPanels.set(state.buffPanels);
    this.notes.set(state.notes);
    this.players.set(state.players);
    this.listPanels.set(state.listPanels);
    this.levelPanel.set(state.levelPanel);
    this.spellPanel.set(state.spellPanel);
    this.buffSets.set(state.buffSets);
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
