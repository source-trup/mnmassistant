import { LEVEL_CAP } from './level-range/level-range';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AlertsService } from './alerts.service';
import { PANEL_MIN, PANEL_SIZE, Rect, findFreeSpot, overlaps, sizeOf } from './layout';
import { GRID } from './layout';
import { gearClassName } from './gear/gear';
import {
  AppState,
  BuffEntry,
  BuffPanel,
  BuffSet,
  CampEvent,
  CampLog,
  CounterItem,
  CustomItem,
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
  LevelingPanel,
  MapPanel,
  ClassPanel,
  PricePanel,
  WikiPanel,
  WishItem,
  WishlistPanel,
  GearCharacter,
  GearFinder,
  GearPanel,
  GameClockSettings,
  GameWindow,
  StandardCounter,
  Theme,
  TimerItem,
  TimerSession,
} from './models';
import { DEFAULT_THEME, applyTheme, normalizeThemeId, themeById } from './themes';
import { formatDuration } from './time';
import {
  MAX_SESSIONS,
  endSession,
  newSession,
  normalizeSessions,
  openSession,
  pauseSession,
  recordCount,
  resumeSession,
  worthKeeping,
} from './session-timer/session';

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
  | ({ id: string; kind: 'spells'; item: SpellPanel } & Rect)
  | ({ id: string; kind: 'leveling'; item: LevelingPanel } & Rect)
  | ({ id: string; kind: 'map'; item: MapPanel } & Rect)
  | ({ id: string; kind: 'classes'; item: ClassPanel } & Rect)
  | ({ id: string; kind: 'prices'; item: PricePanel } & Rect)
  | ({ id: string; kind: 'wiki'; item: WikiPanel } & Rect)
  | ({ id: string; kind: 'wishlist'; item: WishlistPanel } & Rect)
  | ({ id: string; kind: 'gear'; item: GearPanel } & Rect);

/** Panel id of the single Spells panel, and the smallest it can be resized to (grid cells). */
export const SPELL_PANEL_ID = 'spells';
export const SPELLS_MIN = { w: 15, h: 12 };

/** Panel id of the single Leveling panel, and the smallest it can be resized to. */
export const LEVELING_PANEL_ID = 'leveling';
export const LEVELING_MIN = { w: 15, h: 12 };

/** Panel id of the single Map panel, and the smallest it can be resized to. */
export const MAP_PANEL_ID = 'map';
export const MAP_MIN = { w: 15, h: 14 };

/** Panel id of the single Classes panel, and the smallest it can be resized to. */
export const CLASS_PANEL_ID = 'classes';
export const CLASS_MIN = { w: 17, h: 16 };
/** Panel id of the single Prices panel, and the smallest it can be resized to. */
export const PRICE_PANEL_ID = 'prices';
export const PRICE_MIN = { w: 16, h: 14 };

/** Panel id of the single Wiki panel, and the smallest it can be resized to. */
export const WIKI_PANEL_ID = 'wiki';
export const WIKI_MIN = { w: 16, h: 14 };

/** Panel id of the single Wishlist panel, and the smallest it can be resized to. */
export const WISHLIST_PANEL_ID = 'wishlist';
export const WISHLIST_MIN = { w: 15, h: 12 };
/** Most items kept on the wishlist. */
const WISHLIST_MAX = 200;

/** Panel id of the single Gear Planner panel, and the smallest it can be resized to. */
export const GEAR_PANEL_ID = 'gear';
export const GEAR_MIN = { w: 20, h: 20 };
/** Most characters kept in the Gear Planner. */
const GEAR_MAX_CHARACTERS = 30;

/** A link to an item page on monstersandmemories.wiki, or null if it isn't one. */
export function wikiItemUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' && u.hostname === 'monstersandmemories.wiki' && u.pathname.length > 1 ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * An item's page on monstersandmemories.wiki, built from its name the way the wiki names them
 * ("Wyvern Hide Tunic" → /items/wyvern-hide-tunic). The site can't be asked whether the page exists, so this is a
 * best guess: it may not have been written yet.
 */
export function wikiItemPageUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://monstersandmemories.wiki/items/${slug}`;
}

const CLASS_TABS: ClassPanel['tab'][] = ['overview', 'build', 'abilities', 'leveling', 'gear', 'more'];

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
  return { shown: false, ...PANEL_SIZE.spells, cls: 'Shaman', level: null, bought: [], ...UNPLACED };
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
    bought: Array.isArray(raw.bought) ? [...new Set<string>(raw.bought.filter((k: unknown) => typeof k === 'string' && k.length < 300))] : [],
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function defaultLevelingPanel(): LevelingPanel {
  return { shown: false, ...PANEL_SIZE.leveling, cls: null, level: null, mode: 'solo', ...UNPLACED };
}

function normalizeLevelingPanel(raw: any): LevelingPanel {
  const base = defaultLevelingPanel();
  if (!raw || typeof raw !== 'object') return base;
  const lvl = (v: unknown) => {
    const n = Math.floor(Number(v));
    return v !== null && n >= 1 && n <= LEVEL_CAP ? n : null;
  };
  return {
    shown: raw.shown === true,
    w: Math.max(LEVELING_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(LEVELING_MIN.h, Math.floor(Number(raw.h)) || base.h),
    cls: typeof raw.cls === 'string' && raw.cls ? raw.cls : null,
    // Boards saved before Worth the Camp's data kept a level range ("from" / "to"): its low end becomes the level.
    level: lvl(raw.level) ?? lvl(raw.from),
    mode: raw.mode === 'group' ? 'group' : 'solo',
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function defaultMapPanel(): MapPanel {
  return { shown: false, ...PANEL_SIZE.map, map: 'night-harbor', level: null, find: null, ...UNPLACED };
}

function normalizeMapPanel(raw: any): MapPanel {
  const base = defaultMapPanel();
  if (!raw || typeof raw !== 'object') return base;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null);
  return {
    shown: raw.shown === true,
    w: Math.max(MAP_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(MAP_MIN.h, Math.floor(Number(raw.h)) || base.h),
    map: text(raw.map) ?? base.map,
    level: text(raw.level),
    find: text(raw.find),
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function defaultClassPanel(): ClassPanel {
  return { shown: false, ...PANEL_SIZE.classes, cls: null, tab: 'overview', ...UNPLACED };
}

function normalizeClassPanel(raw: any): ClassPanel {
  const base = defaultClassPanel();
  if (!raw || typeof raw !== 'object') return base;
  return {
    shown: raw.shown === true,
    w: Math.max(CLASS_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(CLASS_MIN.h, Math.floor(Number(raw.h)) || base.h),
    cls: typeof raw.cls === 'string' && /^[a-z-]{2,30}$/.test(raw.cls) ? raw.cls : null,
    tab: CLASS_TABS.includes(raw.tab) ? raw.tab : 'overview',
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function defaultPricePanel(): PricePanel {
  return { shown: false, ...PANEL_SIZE.prices, item: null, days: 30, recent: [], ...UNPLACED };
}

function normalizePricePanel(raw: any): PricePanel {
  const base = defaultPricePanel();
  if (!raw || typeof raw !== 'object') return base;
  const name = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
  return {
    shown: raw.shown === true,
    w: Math.max(PRICE_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(PRICE_MIN.h, Math.floor(Number(raw.h)) || base.h),
    item: name(raw.item),
    days: raw.days === 7 ? 7 : 30,
    recent: Array.isArray(raw.recent) ? raw.recent.map(name).filter(Boolean).slice(0, 8) : [],
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function defaultWikiPanel(): WikiPanel {
  return { shown: false, ...PANEL_SIZE.wiki, page: null, ...UNPLACED };
}

function normalizeWikiPanel(raw: any): WikiPanel {
  const base = defaultWikiPanel();
  if (!raw || typeof raw !== 'object') return base;
  return {
    shown: raw.shown === true,
    w: Math.max(WIKI_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(WIKI_MIN.h, Math.floor(Number(raw.h)) || base.h),
    page: typeof raw.page === 'string' && raw.page.trim() ? raw.page.trim().slice(0, 200) : null,
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

function defaultWishlistPanel(): WishlistPanel {
  return { shown: false, ...PANEL_SIZE.wishlist, items: [], hideGot: false, ...UNPLACED };
}

function normalizeWishItem(raw: any): WishItem | null {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: raw.name.trim().slice(0, 100),
    from: typeof raw.from === 'string' ? raw.from.trim().slice(0, 300) : '',
    wikiUrl: wikiItemUrl(raw.wikiUrl),
    got: raw.got === true,
    added: Number(raw.added) || Date.now(),
  };
}

function normalizeWishlistPanel(raw: any): WishlistPanel {
  const base = defaultWishlistPanel();
  if (!raw || typeof raw !== 'object') return base;
  const seen = new Set<string>();
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map(normalizeWishItem)
    .filter((i: WishItem | null): i is WishItem => {
      if (!i || seen.has(i.name.toLowerCase())) return false;
      seen.add(i.name.toLowerCase());
      return true;
    })
    .slice(0, WISHLIST_MAX);
  return {
    shown: raw.shown === true,
    w: Math.max(WISHLIST_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(WISHLIST_MIN.h, Math.floor(Number(raw.h)) || base.h),
    items,
    hideGot: raw.hideGot === true,
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

/** Adds a layout file's wishlist to yours (same name: yours is kept, the file's note, link or "got it" fill gaps). */
function defaultGearFinder(): GearFinder {
  return { slot: null, maxMob: null, drops: true, crafted: false, quest: false, raid: false };
}

function defaultGearPanel(): GearPanel {
  return { shown: false, ...PANEL_SIZE.gear, view: 'doll', characters: [], active: null, finder: defaultGearFinder(), ...UNPLACED };
}

function gearLevel(v: unknown): number | null {
  const n = Math.floor(Number(v));
  return v !== null && v !== '' && n >= 1 && n <= LEVEL_CAP ? n : null;
}

function normalizeGearCharacter(raw: any): GearCharacter | null {
  if (!raw || typeof raw !== 'object') return null;
  const gear: GearCharacter['gear'] = {};
  for (const [pos, g] of Object.entries(raw.gear ?? {})) {
    const it = g as any;
    if (it && Number.isInteger(it.id) && typeof it.name === 'string') gear[pos] = { id: it.id, name: it.name.slice(0, 100) };
  }
  const weights: GearCharacter['weights'] = {};
  for (const [k, v] of Object.entries(raw.weights ?? {})) if (Number.isFinite(v)) weights[k] = v as number;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Character',
    cls: gearClassName(raw.cls),
    race: typeof raw.race === 'string' && raw.race ? raw.race.slice(0, 8) : null,
    look: raw.look === 'f' ? 'f' : 'm',
    level: gearLevel(raw.level),
    gear,
    weights,
  };
}

function normalizeGearPanel(raw: any): GearPanel {
  const base = defaultGearPanel();
  if (!raw || typeof raw !== 'object') return base;
  const characters = (Array.isArray(raw.characters) ? raw.characters : [])
    .map(normalizeGearCharacter)
    .filter((c: GearCharacter | null): c is GearCharacter => !!c)
    .slice(0, GEAR_MAX_CHARACTERS);
  const f = raw.finder ?? {};
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    shown: raw.shown === true,
    w: Math.max(GEAR_MIN.w, Math.floor(Number(raw.w)) || base.w),
    h: Math.max(GEAR_MIN.h, Math.floor(Number(raw.h)) || base.h),
    view: ['doll', 'finder', 'recommended'].includes(raw.view) ? raw.view : 'doll',
    characters,
    active: characters.some((c: GearCharacter) => c.id === raw.active) ? raw.active : (characters[0]?.id ?? null),
    finder: {
      slot: typeof f.slot === 'string' && f.slot ? f.slot : null,
      maxMob: gearLevel(f.maxMob),
      drops: bool(f.drops, true),
      crafted: bool(f.crafted, false),
      quest: bool(f.quest, false),
      raid: bool(f.raid, false),
    },
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

/** Most items you can make yourself. */
export const MAX_CUSTOM_ITEMS = 500;

/** A new id for an item of your own: negative (Worth the Camp's ids are positive) and unlikely to clash with another board's. */
export function newCustomItemId(): number {
  return -(1 + Math.floor(Math.random() * 2 ** 40));
}

function finite(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Items of your own as saved (any version): well-formed ones only. */
export function normalizeCustomItems(raw: unknown): CustomItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomItem[] = [];
  const ids = new Set<number>();
  for (const r of raw) {
    if (!r || typeof r !== 'object' || typeof r.name !== 'string' || !r.name.trim()) continue;
    let id = Number.isInteger(r.id) && r.id < 0 ? r.id : newCustomItemId();
    if (ids.has(id)) id = newCustomItemId();
    ids.add(id);
    const stats: Partial<Record<string, number>> = {};
    for (const [k, v] of Object.entries(r.stats ?? {})) if (finite(v)) stats[k] = finite(v);
    out.push({
      id,
      name: r.name.trim().slice(0, 80),
      icon: typeof r.icon === 'string' && /^https:\/\//.test(r.icon) ? r.icon : null,
      slots: Array.isArray(r.slots) ? r.slots.filter((x: unknown): x is string => typeof x === 'string') : [],
      stats,
      dmg: Math.max(0, finite(r.dmg)),
      delay: Math.max(0, finite(r.delay)),
      twoHand: r.twoHand === true,
      source: typeof r.source === 'string' ? r.source.slice(0, 200) : '',
      added: finite(r.added) || Date.now(),
    });
  }
  return out.slice(0, MAX_CUSTOM_ITEMS);
}

/** A layout file's own items are added to yours (same id: yours is kept). */
function mergeCustomItems(mine: CustomItem[], incoming: CustomItem[]): CustomItem[] {
  const ids = new Set(mine.map((c) => c.id));
  return [...mine, ...incoming.filter((c) => !ids.has(c.id))].slice(0, MAX_CUSTOM_ITEMS);
}

/** A layout file's characters are added to yours (same id: yours is kept). */
function mergeCharacters(mine: GearCharacter[], incoming: GearCharacter[]): GearCharacter[] {
  const ids = new Set(mine.map((c) => c.id));
  return [...mine, ...incoming.filter((c) => !ids.has(c.id))].slice(0, GEAR_MAX_CHARACTERS);
}

function mergeWishes(mine: WishItem[], incoming: WishItem[]): WishItem[] {
  const out = [...mine];
  for (const w of incoming) {
    const i = out.findIndex((m) => m.name.toLowerCase() === w.name.toLowerCase());
    if (i < 0) out.push(w);
    else out[i] = { ...out[i], from: out[i].from || w.from, wikiUrl: out[i].wikiUrl ?? w.wikiUrl, got: out[i].got || w.got };
  }
  return out.slice(0, WISHLIST_MAX);
}

function normalizeGameClock(raw: any): GameClockSettings {
  if (!raw || typeof raw !== 'object') return { windows: [], offset: 0 };
  const hour = (v: unknown) => Math.min(23, Math.max(0, Math.floor(Number(v)) || 0));
  return {
    windows: (Array.isArray(raw.windows) ? raw.windows : [])
      .filter((w: any) => w && typeof w.name === 'string')
      .map((w: any) => ({ id: typeof w.id === 'string' ? w.id : newId(), name: w.name.slice(0, 60), from: hour(w.from), to: hour(w.to) })),
    offset: Math.max(-720, Math.min(720, Math.round(Number(raw.offset)) || 0)),
  };
}

function normalizeLevelPanel(raw: any): LevelPanel {
  if (!raw || typeof raw !== 'object') return defaultLevelPanel();
  const level = Math.floor(Number(raw.level));
  return {
    shown: raw.shown === true,
    level: level >= 1 && level <= LEVEL_CAP ? level : null,
    ...savedSize(raw, PANEL_MIN.levels),
    x: raw.x ?? -1,
    y: raw.y ?? -1,
  };
}

/** A saved size from storage, if it's valid and at least the minimum; otherwise nothing (= default size). */
function savedSize(raw: any, min: { w: number; h: number }): { w?: number; h?: number } {
  const w = Math.floor(Number(raw?.w));
  const h = Math.floor(Number(raw?.h));
  return w >= min.w && h >= min.h ? { w, h } : {};
}

function normalizeListPanels(raw: any): Record<PlayerListKind, PlayerListPanel> {
  const out = defaultListPanels();
  for (const kind of PLAYER_LISTS) {
    const p = raw?.[kind];
    if (p) out[kind] = { kind, shown: p.shown === true, ...savedSize(p, PANEL_MIN.players), x: p.x ?? -1, y: p.y ?? -1 };
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

const DEFAULT_SESSION_NAME = 'Session';

/** A new Session timer: counts up, no sessions yet. */
function makeSessionTimer(name = DEFAULT_SESSION_NAME): TimerItem {
  return { ...makeTimer(0, name), autoNamed: name === DEFAULT_SESSION_NAME, mode: 'session', sessions: [] };
}

/** Board size of a timer panel: a Session timer is taller (it holds counters). */
function timerSize(t: TimerItem): { w: number; h: number } {
  return sizeOf(t, PANEL_SIZE[t.mode === 'session' ? 'session' : 'timer']);
}

function makeStandardCounter(name = 'Counter'): StandardCounter {
  return { id: newId(), since: Date.now(), ...UNPLACED, kind: 'standard', name, value: 0, step: 1, target: null };
}

const DEFAULT_NPH_NAME = 'Named / PH';
/** Starting countdown of a new Named / PH timer. */
const DEFAULT_CAMP_MS = 6 * 60_000;

/** Names the app gives a Named / PH timer: such a camp chimes and keeps its own log instead of an NPC's. */
function isAutoCampName(name: string): boolean {
  return name === DEFAULT_NPH_NAME || AUTO_TIMER_NAME.test(name);
}

/** A new Named / PH timer: the camp panel and its countdown (which lives in the timers list, never on its own). */
function makeCamp(name = DEFAULT_NPH_NAME, durationMs = DEFAULT_CAMP_MS): { camp: NamedPhCounter; timer: TimerItem } {
  const timer: TimerItem = { ...makeTimer(durationMs, name), autoNamed: isAutoCampName(name) };
  const camp: NamedPhCounter = {
    id: newId(),
    since: Date.now(),
    ...UNPLACED,
    kind: 'namedPh',
    name,
    ph: 0,
    named: 0,
    phSinceNamed: 0,
    timerId: timer.id,
    closed: false,
  };
  return { camp, timer };
}

/**
 * Before Named / PH timers, a camp counter could be linked to a separate timer panel. Each Named/PH counter now gets
 * a countdown of its own: the timer it was linked to (the two panels become one), or a new one. Standard counters
 * lose their link. Kill logs keep their keys: a camp tied to a timer you'd named still writes to that NPC's log.
 */
function migrateCamps(timers: TimerItem[], raw: any[]): { timers: TimerItem[]; counters: CounterItem[] } {
  const byId = new Map(timers.filter((t) => t.mode !== 'session').map((t) => [t.id, t]));
  const sessionTimers = new Set(timers.filter((t) => t.mode === 'session').map((t) => t.id));
  const owned = new Map<string, TimerItem>();
  const counters: CounterItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { linkedTimerId, history: _moved, timerId, ...rest } = r; // history now lives in campLogs
    const pos = { x: r.x ?? -1, y: r.y ?? -1 };
    if (r.kind !== 'namedPh') {
      const inTimer = typeof timerId === 'string' && sessionTimers.has(timerId) ? timerId : null;
      counters.push({ ...makeStandardCounter(), ...rest, kind: 'standard', ...pos, timerId: inTimer });
      continue;
    }
    const camp: NamedPhCounter = { ...makeCamp().camp, ...rest, kind: 'namedPh', closed: r.closed === true, ...pos };
    let timer = typeof timerId === 'string' && !owned.has(timerId) ? byId.get(timerId) : undefined;
    if (!timer) {
      const linked = typeof linkedTimerId === 'string' ? byId.get(linkedTimerId) : undefined;
      const free = linked && !owned.has(linked.id) ? linked : undefined;
      // A timer you'd named names the camp; otherwise the camp keeps its own name (and its own log).
      const oldAuto =
        camp.name === DEFAULT_NPH_NAME || camp.name === 'Camp named / PH' || (!!linked && camp.name === `${linked.name}'s log`);
      const npc = linked && !linked.autoNamed ? linked.name : null;
      const name = npc ?? (oldAuto ? DEFAULT_NPH_NAME : camp.name);
      timer = { ...(free ?? makeTimer(linked?.durationMs ?? DEFAULT_CAMP_MS)), name, autoNamed: npc === null };
      camp.name = name;
      // The new panel is bigger: drop any old size, and sit where the top one of the pair was.
      delete camp.w;
      delete camp.h;
      if (free && free.x >= 0 && free.y >= 0 && (camp.x < 0 || free.y < camp.y || (free.y === camp.y && free.x < camp.x))) {
        camp.x = free.x;
        camp.y = free.y;
      }
    }
    const { w: _w, h: _h, ...bare } = timer;
    owned.set(timer.id, { ...bare, ...UNPLACED });
    camp.timerId = timer.id;
    counters.push(camp);
  }
  return { timers: [...timers.filter((t) => !owned.has(t.id)), ...owned.values()], counters };
}

function npcKey(npc: string): string {
  return 'npc:' + npc.trim().toLowerCase();
}

/** Which log a Named/PH counter writes to: its named timer's NPC, or its own private log. */
function logKeyFor(c: { id: string; timerId?: string | null; linkedTimerId?: string | null }, timers: TimerItem[]): string {
  const id = c.timerId ?? c.linkedTimerId;
  const t = id ? timers.find((x) => x.id === id) : undefined;
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
  const { camp, timer } = makeCamp();
  return {
    version: 5,
    soundOn: true,
    theme: DEFAULT_THEME,
    timers: [timer],
    counters: [camp, makeStandardCounter('Kills')],
    campLogs: [],
    lootLibrary: [],
    buffPanels: [],
    buffSets: [],
    notes: [],
    players: { naughty: [], nice: [] },
    listPanels: defaultListPanels(),
    levelPanel: defaultLevelPanel(),
    spellPanel: defaultSpellPanel(),
    levelingPanel: defaultLevelingPanel(),
    mapPanel: defaultMapPanel(),
    classPanel: defaultClassPanel(),
    pricePanel: defaultPricePanel(),
    wikiPanel: defaultWikiPanel(),
    wishlistPanel: defaultWishlistPanel(),
    gearPanel: defaultGearPanel(),
    customItems: [],
    gameClock: { windows: [], offset: 0 },
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

/** Accepts state saved by any version of the app (or a layout file) and upgrades it. */
function normalizeState(parsed: any): AppState | null {
  if (!parsed || ![1, 2, 3, 4, 5].includes(parsed.version)) return null;
  if (!Array.isArray(parsed.timers) || !Array.isArray(parsed.counters)) return null;
  const savedTimers: TimerItem[] = parsed.timers.map((t: any) => ({
    repeat: false,
    endsAt: null,
    pausedRemainingMs: null,
    ...t,
    autoNamed: t.autoNamed ?? AUTO_TIMER_NAME.test(t.name ?? ''),
    x: t.x ?? -1,
    y: t.y ?? -1,
    mode: t.mode === 'session' ? ('session' as const) : undefined,
    sessions: t.mode === 'session' ? normalizeSessions(t.sessions) : undefined,
  }));
  const campLogs = normalizeLogs(parsed, savedTimers);
  const { timers, counters } = migrateCamps(savedTimers, parsed.counters);
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
    levelingPanel: normalizeLevelingPanel(parsed.levelingPanel),
    mapPanel: normalizeMapPanel(parsed.mapPanel),
    classPanel: normalizeClassPanel(parsed.classPanel),
    pricePanel: normalizePricePanel(parsed.pricePanel),
    wikiPanel: normalizeWikiPanel(parsed.wikiPanel),
    wishlistPanel: normalizeWishlistPanel(parsed.wishlistPanel),
    gearPanel: normalizeGearPanel(parsed.gearPanel),
    customItems: normalizeCustomItems(parsed.customItems),
    gameClock: normalizeGameClock(parsed.gameClock),
    notes: (Array.isArray(parsed.notes) ? parsed.notes : []).filter((n: any) => n && typeof n === 'object').map(normalizeNote),
    timers,
    counters,
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
  readonly levelingPanel = signal<LevelingPanel>(defaultLevelingPanel());
  readonly mapPanel = signal<MapPanel>(defaultMapPanel());
  readonly classPanel = signal<ClassPanel>(defaultClassPanel());
  readonly pricePanel = signal<PricePanel>(defaultPricePanel());
  readonly wikiPanel = signal<WikiPanel>(defaultWikiPanel());
  readonly wishlistPanel = signal<WishlistPanel>(defaultWishlistPanel());
  readonly gearPanel = signal<GearPanel>(defaultGearPanel());
  /** Items you made yourself (Gear Planner, Wishlist). */
  readonly customItems = signal<CustomItem[]>([]);
  /** The toolbar game clock: your spawn windows and any adjustment. */
  readonly gameClock = signal<GameClockSettings>({ windows: [], offset: 0 });
  /** A lookup another panel asked the Wiki panel to do (not saved). The counter makes repeat lookups fire again. */
  readonly wikiLookup = signal<{ term: string; n: number } | null>(null);
  /** Saved buff lists, sorted by name when shown. */
  readonly buffSets = signal<BuffSet[]>([]);
  readonly soundOn = signal(true);
  readonly theme = signal<Theme>(DEFAULT_THEME);
  /** Named kills waiting for loot entry; the first one is shown in the loot drawer. */
  readonly lootQueue = signal<LootRequest[]>([]);
  /** Board width in grid cells; kept up to date by the app shell. */
  readonly cols = signal(Math.max(15, Math.floor((window.innerWidth - 32) / GRID)));

  /** Every panel on the board with its grid footprint. */
  /** Countdowns that belong to a Named / PH timer (shown inside that panel, not on their own). */
  readonly campTimerIds = computed(() => new Set(this.counters().flatMap((c) => (c.kind === 'namedPh' ? [c.timerId] : []))));

  /** Session timers, by id. */
  readonly sessionTimers = computed(() => new Map(this.timers().flatMap((t) => (t.mode === 'session' ? [[t.id, t] as const] : []))));

  /** Counters that live in a Session timer (shown in that panel, not on their own). */
  readonly timerCounterIds = computed(() => {
    const timers = this.sessionTimers();
    return new Set(this.counters().flatMap((c) => (c.kind === 'standard' && c.timerId && timers.has(c.timerId) ? [c.id] : [])));
  });

  readonly panels = computed<Panel[]>(() => [
    ...this.timers()
      .filter((t) => !this.campTimerIds().has(t.id))
      .map((t) => ({ id: t.id, kind: 'timer' as const, item: t, x: t.x, y: t.y, ...timerSize(t) })),
    ...this.counters()
      .filter((c) => !(c.kind === 'namedPh' && c.closed) && !this.timerCounterIds().has(c.id))
      .map((c) => ({ id: c.id, kind: 'counter' as const, item: c, x: c.x, y: c.y, ...sizeOf(c, PANEL_SIZE[c.kind]) })),
    ...this.buffPanels().map((b) => ({ id: b.id, kind: 'buffs' as const, item: b, x: b.x, y: b.y, ...sizeOf(b, PANEL_SIZE.buffs) })),
    ...this.notes()
      .filter((n) => !n.closed)
      .map((n) => ({ id: n.id, kind: 'note' as const, item: n, x: n.x, y: n.y, w: n.w, h: n.h })),
    ...PLAYER_LISTS.map((k) => this.listPanels()[k])
      .filter((p) => p.shown)
      .map((p) => ({ id: listPanelId(p.kind), kind: 'players' as const, item: p, x: p.x, y: p.y, ...sizeOf(p, PANEL_SIZE.players) })),
    ...[this.levelPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: LEVEL_PANEL_ID, kind: 'levels' as const, item: p, x: p.x, y: p.y, ...sizeOf(p, PANEL_SIZE.levels) })),
    ...[this.spellPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: SPELL_PANEL_ID, kind: 'spells' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.levelingPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: LEVELING_PANEL_ID, kind: 'leveling' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.mapPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: MAP_PANEL_ID, kind: 'map' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.classPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: CLASS_PANEL_ID, kind: 'classes' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.pricePanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: PRICE_PANEL_ID, kind: 'prices' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.wikiPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: WIKI_PANEL_ID, kind: 'wiki' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.wishlistPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: WISHLIST_PANEL_ID, kind: 'wishlist' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
    ...[this.gearPanel()]
      .filter((p) => p.shown)
      .map((p) => ({ id: GEAR_PANEL_ID, kind: 'gear' as const, item: p, x: p.x, y: p.y, w: p.w, h: p.h })),
  ]);

  /** Named / PH timers that have been put away, in the order they were created. */
  readonly closedCamps = computed(() => this.counters().filter((c): c is NamedPhCounter => c.kind === 'namedPh' && c.closed));

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
    this.settleCamps();
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
    else if (id === LEVELING_PANEL_ID) this.updateLevelingPanel({ x, y });
    else if (id === MAP_PANEL_ID) this.updateMapPanel({ x, y });
    else if (id === CLASS_PANEL_ID) this.updateClassPanel({ x, y });
    else if (id === PRICE_PANEL_ID) this.updatePricePanel({ x, y });
    else if (id === WIKI_PANEL_ID) this.updateWikiPanel({ x, y });
    else if (id === WISHLIST_PANEL_ID) this.updateWishlistPanel({ x, y });
    else if (id === GEAR_PANEL_ID) this.updateGearPanel({ x, y });
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
    this.timers.update((list) => list.map((t) => ({ ...t, ...pos.get(t.id) }))); // camp countdowns aren't in `pos`
    this.counters.update((list) => list.map((c) => ({ ...c, ...pos.get(c.id) })) as CounterItem[]); // put-away camps aren't in `pos`
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
    const levelingSpot = pos.get(LEVELING_PANEL_ID);
    if (levelingSpot) this.updateLevelingPanel(levelingSpot);
    const mapSpot = pos.get(MAP_PANEL_ID);
    if (mapSpot) this.updateMapPanel(mapSpot);
    const classSpot = pos.get(CLASS_PANEL_ID);
    if (classSpot) this.updateClassPanel(classSpot);
    const priceSpot = pos.get(PRICE_PANEL_ID);
    if (priceSpot) this.updatePricePanel(priceSpot);
    const wikiSpot = pos.get(WIKI_PANEL_ID);
    if (wikiSpot) this.updateWikiPanel(wikiSpot);
    const wishSpot = pos.get(WISHLIST_PANEL_ID);
    if (wishSpot) this.updateWishlistPanel(wishSpot);
    const gearSpot = pos.get(GEAR_PANEL_ID);
    if (gearSpot) this.updateGearPanel(gearSpot);
  }

  /**
   * A Named / PH timer made from an old camp + timer pair is bigger than either was; if it now overlaps another
   * panel it moves to the first free spot instead of the whole board being re-tidied.
   */
  private settleCamps(): void {
    const ps = this.panels().filter((p) => p.x >= 0 && p.y >= 0);
    const moving = new Set<string>();
    for (const p of ps) {
      if (p.kind !== 'counter' || p.item.kind !== 'namedPh') continue;
      if (ps.some((o) => o.id !== p.id && !moving.has(o.id) && overlaps(o, p))) moving.add(p.id);
    }
    if (moving.size) this.counters.update((list) => list.map((c) => (moving.has(c.id) ? { ...c, ...UNPLACED } : c)));
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
    const campTimers = this.campTimerIds();
    const inTimers = this.timerCounterIds();
    this.timers.update((list) => list.map((t) => (campTimers.has(t.id) ? t : place(t, timerSize(t)))));
    this.counters.update((list) =>
      list.map((c) => ((c.kind === 'namedPh' && c.closed) || inTimers.has(c.id) ? c : place(c, sizeOf(c, PANEL_SIZE[c.kind])))),
    );
    this.buffPanels.update((list) => list.map((b) => place(b, sizeOf(b, PANEL_SIZE.buffs))));
    this.notes.update((list) => list.map((n) => (n.closed ? n : place(n, n))));
    this.listPanels.update((lp) => {
      const next = { ...lp };
      for (const k of PLAYER_LISTS) if (lp[k].shown) next[k] = place(lp[k], sizeOf(lp[k], PANEL_SIZE.players));
      return next;
    });
    this.levelPanel.update((p) => (p.shown ? place(p, sizeOf(p, PANEL_SIZE.levels)) : p));
    this.spellPanel.update((p) => (p.shown ? place(p, p) : p));
    this.levelingPanel.update((p) => (p.shown ? place(p, p) : p));
    this.mapPanel.update((p) => (p.shown ? place(p, p) : p));
    this.classPanel.update((p) => (p.shown ? place(p, p) : p));
    this.pricePanel.update((p) => (p.shown ? place(p, p) : p));
    this.wikiPanel.update((p) => (p.shown ? place(p, p) : p));
    this.wishlistPanel.update((p) => (p.shown ? place(p, p) : p));
    this.gearPanel.update((p) => (p.shown ? place(p, p) : p));
  }

  // ---------- timers ----------

  addTimer(durationMs: number, name?: string): void {
    this.timers.update((list) => [...list, makeTimer(durationMs, name)]);
    this.placeUnplaced();
  }

  removeTimer(id: string): void {
    if (this.campTimerIds().has(id)) return; // a camp's countdown goes with its panel
    this.timers.update((list) => list.filter((t) => t.id !== id));
    this.timerAlerted.delete(id);
    // A Session timer's counters live only in it, so they go too.
    this.counters.update((list) => list.filter((c) => !(c.kind === 'standard' && c.timerId === id)));
  }

  updateTimer(id: string, patch: Partial<TimerItem>): void {
    this.timers.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  renameTimer(id: string, name: string): void {
    if (!this.timers().some((t) => t.id === id)) return;
    const camp = this.counters().find((c) => c.kind === 'namedPh' && c.timerId === id);
    this.updateTimer(id, { name, autoNamed: camp ? isAutoCampName(name) : AUTO_TIMER_NAME.test(name) });
    // A Named / PH timer's name is the camp's name (and, once it's your own, the NPC whose log it keeps).
    if (camp) this.counters.update((list) => list.map((c) => (c.id === camp.id ? { ...c, name } : c)));
    this.adoptPrivateLogs();
  }

  /** Changes the timer's length; a generated name follows the new length. */
  setTimerDuration(id: string, durationMs: number): void {
    const t = this.timers().find((x) => x.id === id);
    if (!t) return;
    const camp = this.campTimerIds().has(id); // a camp keeps its name
    this.updateTimer(id, { durationMs, ...(t.autoNamed && !camp ? { name: autoTimerName(durationMs) } : {}) });
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

  // ---------- Session timers ----------

  /** Adds a Session timer (counts up; holds counters). */
  addSessionTimer(name?: string): void {
    this.timers.update((list) => [...list, makeSessionTimer(name)]);
    this.placeUnplaced();
  }

  /** Changes the session going (if any) of a Session timer. */
  private updateSession(timerId: string, fn: (s: TimerSession) => TimerSession): void {
    this.timers.update((list) =>
      list.map((t) => {
        const open = t.id === timerId ? openSession(t) : null;
        if (!open) return t;
        const sessions = [...t.sessions!];
        sessions[sessions.length - 1] = fn(open);
        return { ...t, sessions };
      }),
    );
  }

  /** The counters in a Session timer, in board order. */
  countersIn(timerId: string): StandardCounter[] {
    return this.counters().filter((c): c is StandardCounter => c.kind === 'standard' && c.timerId === timerId);
  }

  /**
   * Starts a Session timer: resumes a paused session, or starts a new one, which starts its counters from 0 (the last
   * session's counts are in the stats).
   */
  startSession(timerId: string): void {
    const t = this.sessionTimers().get(timerId);
    if (!t) return;
    const now = Date.now();
    if (openSession(t)) {
      this.updateSession(timerId, (s) => resumeSession(s, now));
      return;
    }
    const sessions = [...(t.sessions ?? []), newSession(newId(), now)].slice(-MAX_SESSIONS);
    this.updateTimer(timerId, { sessions });
    const mine = new Set(this.countersIn(timerId).map((c) => c.id));
    this.counters.update((list) => list.map((c) => (mine.has(c.id) ? { ...c, value: 0, since: now } : c)));
  }

  pauseSession(timerId: string): void {
    const now = Date.now();
    this.updateSession(timerId, (s) => pauseSession(s, now));
  }

  /** Ends the session going: it's kept for the stats (unless it was a few seconds with nothing counted). */
  endSession(timerId: string): void {
    const t = this.sessionTimers().get(timerId);
    const open = t && openSession(t);
    if (!t || !open) return;
    const ended = endSession(open, Date.now());
    const sessions = t.sessions!.slice(0, -1);
    this.updateTimer(timerId, { sessions: worthKeeping(ended) ? [...sessions, ended] : sessions });
  }

  /** Deletes one session from a Session timer's history. */
  deleteSession(timerId: string, sessionId: string): void {
    const t = this.sessionTimers().get(timerId);
    if (t) this.updateTimer(timerId, { sessions: (t.sessions ?? []).filter((s) => s.id !== sessionId) });
  }

  /** Deletes every finished session (the one going, if any, stays). */
  clearSessions(timerId: string): void {
    const t = this.sessionTimers().get(timerId);
    if (!t) return;
    const open = openSession(t);
    this.updateTimer(timerId, { sessions: open ? [open] : [] });
  }

  /** A new counter inside a Session timer. */
  addTimerCounter(timerId: string, name: string): void {
    if (!this.sessionTimers().has(timerId)) return;
    const c: StandardCounter = { ...makeStandardCounter(name.trim() || 'Counter'), timerId };
    this.counters.update((list) => [...list, c]);
    this.growForCounter(timerId);
  }

  /** Moves a counter from the board into a Session timer (its own panel goes away). */
  moveCounterToTimer(counterId: string, timerId: string): void {
    const c = this.counters().find((x) => x.id === counterId);
    if (!c || c.kind !== 'standard' || !this.sessionTimers().has(timerId) || c.timerId === timerId) return;
    this.updateCounter(counterId, { timerId });
    this.growForCounter(timerId);
  }

  /** Takes a counter out of its Session timer and gives it its own panel again. */
  moveCounterToBoard(counterId: string): void {
    const c = this.counters().find((x) => x.id === counterId);
    if (!c || c.kind !== 'standard' || !c.timerId) return;
    this.updateCounter(counterId, { timerId: null, ...UNPLACED });
    this.placeUnplaced();
  }

  /** Each counter row needs room: past two counters, a Session timer grows a row when there's space below it. */
  private growForCounter(timerId: string): void {
    const p = this.panels().find((x) => x.id === timerId);
    if (!p || p.kind !== 'timer') return;
    const needed = PANEL_SIZE.session.h + Math.max(0, this.countersIn(timerId).length - 2) * 2;
    if (p.h < needed) this.resizePanel(timerId, p.w, Math.min(needed, p.h + 2));
  }

  // ---------- counters ----------

  addCounter(kind: CounterKind): void {
    if (kind === 'namedPh') {
      this.addCamp();
      return;
    }
    this.counters.update((list) => [...list, makeStandardCounter()]);
    this.placeUnplaced();
  }

  /** Adds a Named / PH timer with this respawn countdown. */
  addCamp(durationMs = DEFAULT_CAMP_MS): void {
    const { camp, timer } = makeCamp(DEFAULT_NPH_NAME, durationMs);
    this.timers.update((list) => [...list, timer]);
    this.counters.update((list) => [...list, camp]);
    this.placeUnplaced();
  }

  /** Deletes the counter (and a Named / PH timer's countdown). A named NPC's history is kept; a camp's own log goes with it. */
  removeCounter(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    this.counters.update((list) => list.filter((x) => x.id !== id));
    if (c?.kind === 'namedPh') {
      this.timers.update((list) => list.filter((t) => t.id !== c.timerId));
      this.timerAlerted.delete(c.timerId);
    }
    this.campLogs.update((logs) => logs.filter((l) => l.key !== 'counter:' + id));
    this.lootQueue.update((q) => q.filter((r) => r.counterId !== id));
  }

  updateCounter(id: string, patch: Partial<StandardCounter> | Partial<NamedPhCounter>): void {
    const c = this.counters().find((x) => x.id === id);
    // A Named / PH timer's name lives on its countdown too.
    if (c?.kind === 'namedPh' && patch.name !== undefined && patch.name !== c.name) {
      const { name, ...others } = patch;
      this.renameTimer(c.timerId, name);
      patch = others;
    }
    this.counters.update((list) => list.map((x) => (x.id === id ? ({ ...x, ...patch } as CounterItem) : x)));
  }

  /** Takes a Named / PH timer off the board (its countdown stops); counts and kill log are kept. */
  closeCamp(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (c?.kind !== 'namedPh' || c.closed) return;
    this.resetTimer(c.timerId);
    this.lootQueue.update((q) => q.filter((r) => r.counterId !== id));
    this.updateCounter(id, { closed: true });
  }

  /** Puts a saved Named / PH timer back on the board: in its old spot if that's still free, otherwise the first free spot. */
  openCamp(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (c?.kind !== 'namedPh' || !c.closed) return;
    const size = sizeOf(c, PANEL_SIZE.namedPh);
    const fits = c.x >= 0 && c.y >= 0 && this.canPlace(id, { x: c.x, y: c.y, ...size });
    this.updateCounter(id, { closed: false, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** A Named / PH timer's countdown. */
  campTimer(c: NamedPhCounter): TimerItem | undefined {
    return this.timers().find((t) => t.id === c.timerId);
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

  /** The NPC whose history a Named / PH timer shows, or null while the camp has no name of your own. */
  npcOf(c: CounterItem): string | null {
    if (c.kind !== 'namedPh' || !this.logKeyOf(c).startsWith('npc:')) return null;
    return this.campTimer(c)?.name ?? null;
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
   * When a camp gets a name of your own (an NPC), kills it logged before that move into
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

  /** Forgets a named NPC and its whole kill history (camps with that name start a fresh log). */
  forgetNpc(name: string): void {
    const key = npcKey(name);
    this.campLogs.update((logs) => logs.filter((l) => l.key !== key));
  }

  npcLog(name: string): CampLog | undefined {
    const key = npcKey(name);
    return this.campLogs().find((l) => l.key === key);
  }

  /** Standard counter +/-. */
  bump(id: string, direction: 1 | -1): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'standard') return;
    // In a Session timer with no session going, counting up starts one (which starts the counts from 0).
    const timer = c.timerId ? this.sessionTimers().get(c.timerId) : undefined;
    const fresh = direction === 1 && !!timer && !openSession(timer);
    if (timer && fresh) this.startSession(timer.id);
    this.setCounterValue(id, (fresh ? 0 : c.value) + direction * c.step);
  }

  /** Sets a counter's value; in a Session timer the change counts toward the session going (if any). */
  setCounterValue(id: string, value: number): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'standard' || !Number.isFinite(value)) return;
    const delta = value - c.value;
    this.updateCounter(id, { value });
    if (c.timerId && delta) {
      const now = Date.now();
      this.updateSession(c.timerId, (s) => recordCount(s, id, c.name, delta, now));
    }
  }

  /** Placeholder killed: +1 PH, log it, and restart the camp's countdown. */
  phKill(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    this.startTimer(c.timerId);
    this.autoSession(c);
    const event: CampEvent = { id: newId(), t: Date.now(), type: 'ph', loot: [] };
    this.updateNph(id, (n) => ({ ...n, ph: n.ph + 1, phSinceNamed: n.phSinceNamed + 1 }));
    this.updateLog(this.logKeyOf(c), this.logNameFor(c), (h) => [...h, event].slice(-MAX_HISTORY));
  }

  /** Named killed: +1 named, log it, restart the camp's countdown, then offer loot entry. */
  namedKill(id: string): void {
    const c = this.counters().find((x) => x.id === id);
    if (!c || c.kind !== 'namedPh') return;
    this.startTimer(c.timerId);
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

  // ---------- leveling ----------

  updateLevelingPanel(patch: Partial<LevelingPanel>): void {
    this.levelingPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Leveling Spots panel (it comes back in its old spot if that's still free). */
  toggleLeveling(): void {
    const p = this.levelingPanel();
    if (p.shown) {
      this.updateLevelingPanel({ shown: false });
      return;
    }
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(LEVELING_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h });
    // First time: start from the level typed into the Group Range panel, if any.
    const level = p.level ?? this.levelPanel().level;
    this.updateLevelingPanel({ shown: true, level, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  // ---------- map (MnM Atlas) ----------

  updateMapPanel(patch: Partial<MapPanel>): void {
    this.mapPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Map panel (it comes back in its old spot and size, on the map it last showed). */
  toggleMap(): void {
    const p = this.mapPanel();
    if (p.shown) {
      this.updateMapPanel({ shown: false });
      return;
    }
    this.showMap({});
  }

  /** Shows the Map panel (if hidden) on a given map, e.g. from a zone in the Leveling panel. */
  showMap(view: Partial<Pick<MapPanel, 'map' | 'level' | 'find'>>): void {
    const p = this.mapPanel();
    const fits = p.shown || (p.x >= 0 && p.y >= 0 && this.canPlace(MAP_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h }));
    this.updateMapPanel({ ...view, shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  // ---------- classes ----------

  updateClassPanel(patch: Partial<ClassPanel>): void {
    this.classPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Classes panel (it comes back in its old spot and size). */
  toggleClasses(): void {
    const p = this.classPanel();
    if (p.shown) {
      this.updateClassPanel({ shown: false });
      return;
    }
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(CLASS_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h });
    this.updateClassPanel({ shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  // ---------- prices ----------

  updatePricePanel(patch: Partial<PricePanel>): void {
    this.pricePanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Prices panel (it comes back in its old spot and size). */
  togglePrices(): void {
    const p = this.pricePanel();
    if (p.shown) {
      this.updatePricePanel({ shown: false });
      return;
    }
    this.showPrice(null);
  }

  /** Shows the Prices panel (if hidden), optionally on an item, e.g. from a loot entry. */
  showPrice(item: string | null): void {
    const p = this.pricePanel();
    const fits = p.shown || (p.x >= 0 && p.y >= 0 && this.canPlace(PRICE_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h }));
    this.updatePricePanel({ shown: true, ...(item ? this.pricePick(item) : {}), ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** Picks an item in the Prices panel and puts it at the front of the recent list. */
  pricePick(item: string): Partial<PricePanel> {
    const name = item.trim();
    const recent = [name, ...this.pricePanel().recent.filter((r) => r.toLowerCase() !== name.toLowerCase())].slice(0, 8);
    return { item: name, recent };
  }

  // ---------- game time ----------

  addGameWindow(name: string, from: number, to: number): void {
    const w: GameWindow = { id: newId(), name: name.trim().slice(0, 60) || 'Window', from, to };
    this.gameClock.update((c) => ({ ...c, windows: [...c.windows, w] }));
  }

  removeGameWindow(id: string): void {
    this.gameClock.update((c) => ({ ...c, windows: c.windows.filter((w) => w.id !== id) }));
  }

  /** Shift the game clock by game minutes (−720…720), e.g. if your game disagrees with the wiki's clock. */
  setGameClockOffset(minutes: number): void {
    this.gameClock.update((c) => ({ ...c, offset: Math.max(-720, Math.min(720, Math.round(minutes))) }));
  }

  // ---------- community wiki ----------

  updateWikiPanel(patch: Partial<WikiPanel>): void {
    this.wikiPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Wiki panel (it comes back in its old spot and size). */
  toggleWiki(): void {
    const p = this.wikiPanel();
    if (p.shown) {
      this.updateWikiPanel({ shown: false });
      return;
    }
    this.openWikiPanel();
  }

  /** Looks a name up in the Wiki panel (opening it if hidden): its page if there is one, otherwise search results. */
  showWiki(term: string): void {
    const t = term.trim();
    if (!t) return;
    this.openWikiPanel();
    this.wikiLookup.set({ term: t, n: (this.wikiLookup()?.n ?? 0) + 1 });
  }

  private openWikiPanel(): void {
    const p = this.wikiPanel();
    if (p.shown) return;
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(WIKI_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h });
    this.updateWikiPanel({ shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  // ---------- wishlist ----------

  updateWishlistPanel(patch: Partial<WishlistPanel>): void {
    this.wishlistPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Wishlist panel (it comes back in its old spot and size). */
  toggleWishlist(): void {
    const p = this.wishlistPanel();
    if (p.shown) {
      this.updateWishlistPanel({ shown: false });
      return;
    }
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(WISHLIST_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h });
    this.updateWishlistPanel({ shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** Adds an item to the wishlist (or returns the one already there with that name). */
  addWish(name: string, wikiUrl: string | null = null): WishItem | null {
    const n = name.trim().slice(0, 100);
    if (!n) return null;
    const url = wikiItemUrl(wikiUrl);
    const had = this.wishlistPanel().items.find((i) => i.name.toLowerCase() === n.toLowerCase());
    if (had) {
      if (url && !had.wikiUrl) this.updateWish(had.id, { wikiUrl: url });
      return had;
    }
    const item = normalizeWishItem({ name: n, wikiUrl: url, added: Date.now() })!;
    this.updateWishlistPanel({ items: [item, ...this.wishlistPanel().items].slice(0, WISHLIST_MAX) });
    return item;
  }

  updateWish(id: string, patch: Partial<Pick<WishItem, 'from' | 'got' | 'wikiUrl'>>): void {
    const clean: Partial<WishItem> = { ...patch };
    if (patch.from !== undefined) clean.from = patch.from.trim().slice(0, 300);
    if (patch.wikiUrl !== undefined) clean.wikiUrl = wikiItemUrl(patch.wikiUrl);
    this.updateWishlistPanel({ items: this.wishlistPanel().items.map((i) => (i.id === id ? { ...i, ...clean } : i)) });
  }

  removeWish(id: string): void {
    this.updateWishlistPanel({ items: this.wishlistPanel().items.filter((i) => i.id !== id) });
  }

  /** Marks a spell as bought, or unmarks it (bought spells aren't counted in the Spells panel's costs). */
  toggleSpellBought(key: string): void {
    const bought = this.spellPanel().bought;
    this.updateSpellPanel({ bought: bought.includes(key) ? bought.filter((k) => k !== key) : [...bought, key] });
  }

  clearBoughtSpells(): void {
    this.updateSpellPanel({ bought: [] });
  }

  /** Shows the Spells panel (if hidden) filtered to a class, e.g. from the Classes panel. */
  showSpellsFor(cls: string): void {
    this.updateSpellPanel({ cls, level: null });
    if (!this.spellPanel().shown) this.toggleSpells();
  }

  /** Shows the Leveling Spots panel (if hidden) for a level, and a class if given (e.g. from a class's leveling path). */
  showLevelingFor(level: number, cls?: string): void {
    this.updateLevelingPanel({ level, ...(cls ? { cls } : {}) });
    if (!this.levelingPanel().shown) this.toggleLeveling();
  }

  // ---------- gear planner ----------

  updateGearPanel(patch: Partial<GearPanel>): void {
    this.gearPanel.update((p) => ({ ...p, ...patch }));
  }

  /** Shows or hides the Gear Planner (it comes back in its old spot and size). The first time, it starts a character. */
  toggleGear(): void {
    const p = this.gearPanel();
    if (p.shown) {
      this.updateGearPanel({ shown: false });
      return;
    }
    if (!p.characters.length) this.addGearCharacter();
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(GEAR_PANEL_ID, { x: p.x, y: p.y, w: p.w, h: p.h });
    this.updateGearPanel({ shown: true, ...(fits ? {} : UNPLACED) });
    this.placeUnplaced();
  }

  /** A new character (your theme's class and the level from Leveling Spots, when there is one), shown right away. */
  addGearCharacter(): GearCharacter | null {
    const list = this.gearPanel().characters;
    if (list.length >= GEAR_MAX_CHARACTERS) return null;
    let n = list.length + 1;
    while (list.some((c) => c.name === `Character ${n}`)) n++;
    const c: GearCharacter = {
      id: newId(),
      name: `Character ${n}`,
      cls: gearClassName(this.theme()),
      race: null,
      look: 'm',
      level: this.levelingPanel().level ?? this.levelPanel().level,
      gear: {},
      weights: {},
    };
    this.updateGearPanel({ characters: [...list, c], active: c.id });
    return c;
  }

  updateGearCharacter(id: string, patch: Partial<Omit<GearCharacter, 'id'>>): void {
    this.updateGearPanel({ characters: this.gearPanel().characters.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }

  removeGearCharacter(id: string): void {
    const p = this.gearPanel();
    const characters = p.characters.filter((c) => c.id !== id);
    this.updateGearPanel({ characters, active: p.active === id ? (characters[0]?.id ?? null) : p.active });
  }

  /** Puts an item on (or takes it off, with null) at these positions; other positions listed are emptied. */
  setGear(charId: string, pos: string, item: { id: number; name: string } | null, clear: readonly string[] = []): void {
    const c = this.gearPanel().characters.find((x) => x.id === charId);
    if (!c) return;
    const gear = { ...c.gear };
    for (const k of clear) delete gear[k];
    if (item) gear[pos] = { id: item.id, name: item.name };
    else delete gear[pos];
    this.updateGearCharacter(charId, { gear });
  }

  setGearFinder(patch: Partial<GearFinder>): void {
    this.updateGearPanel({ finder: { ...this.gearPanel().finder, ...patch } });
  }

  // ---------- items of your own ----------

  /** Saves an item of your own: a new one (no id yet) or changes to one. Returns it as saved. */
  saveCustomItem(item: Omit<CustomItem, 'id' | 'added'> & { id?: number }): CustomItem | null {
    const had = item.id !== undefined ? this.customItems().find((c) => c.id === item.id) : undefined;
    const [saved] = normalizeCustomItems([{ ...item, id: had?.id ?? newCustomItemId(), added: had?.added ?? Date.now() }]);
    if (!saved) return null;
    if (had) this.customItems.update((list) => list.map((c) => (c.id === had.id ? saved : c)));
    else if (this.customItems().length < MAX_CUSTOM_ITEMS) this.customItems.update((list) => [...list, saved]);
    else return null;
    // A renamed item keeps its name wherever it's worn.
    if (had && had.name !== saved.name) {
      this.gearPanel.update((p) => ({
        ...p,
        characters: p.characters.map((c) => ({
          ...c,
          gear: Object.fromEntries(Object.entries(c.gear).map(([k, g]) => [k, g && g.id === saved.id ? { ...g, name: saved.name } : g])),
        })),
      }));
    }
    return saved;
  }

  /** Deletes an item of your own (characters wearing it keep its name, as with an item that's left the item data). */
  removeCustomItem(id: number): void {
    this.customItems.update((list) => list.filter((c) => c.id !== id));
  }

  /** Smallest size a panel can be resized to, or null if it can't be resized. */
  minSize(p: Panel): { w: number; h: number } {
    switch (p.kind) {
      case 'note':
        return NOTE_MIN;
      case 'spells':
        return SPELLS_MIN;
      case 'leveling':
        return LEVELING_MIN;
      case 'map':
        return MAP_MIN;
      case 'classes':
        return CLASS_MIN;
      case 'prices':
        return PRICE_MIN;
      case 'wiki':
        return WIKI_MIN;
      case 'wishlist':
        return WISHLIST_MIN;
      case 'gear':
        return GEAR_MIN;
      case 'counter':
        return PANEL_MIN[p.item.kind];
      case 'timer':
        return PANEL_MIN[p.item.mode === 'session' ? 'session' : 'timer'];
      default:
        return PANEL_MIN[p.kind];
    }
  }

  /** Resizes any panel (grid cells) if the new footprint is free. */
  resizePanel(id: string, w: number, h: number): boolean {
    const p = this.panels().find((x) => x.id === id);
    const min = p && this.minSize(p);
    if (!p || !min || w < min.w || h < min.h || p.x + w - 1 > this.cols()) return false;
    if (!this.canPlace(id, { x: p.x, y: p.y, w, h })) return false;
    const size = { w, h };
    switch (p.kind) {
      case 'timer':
        this.updateTimer(id, size);
        break;
      case 'counter':
        this.updateCounter(id, size);
        break;
      case 'buffs':
        this.updateBuffPanel(id, size);
        break;
      case 'note':
        this.updateNote(id, size);
        break;
      case 'players':
        this.updateListPanel(p.item.kind, size);
        break;
      case 'levels':
        this.updateLevelPanel(size);
        break;
      case 'spells':
        this.updateSpellPanel(size);
        break;
      case 'leveling':
        this.updateLevelingPanel(size);
        break;
      case 'map':
        this.updateMapPanel(size);
        break;
      case 'classes':
        this.updateClassPanel(size);
        break;
      case 'prices':
        this.updatePricePanel(size);
        break;
      case 'wiki':
        this.updateWikiPanel(size);
        break;
      case 'wishlist':
        this.updateWishlistPanel(size);
        break;
      case 'gear':
        this.updateGearPanel(size);
        break;
    }
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
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(LEVEL_PANEL_ID, { x: p.x, y: p.y, ...sizeOf(p, PANEL_SIZE.levels) });
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
    const fits = p.x >= 0 && p.y >= 0 && this.canPlace(listPanelId(kind), { x: p.x, y: p.y, ...sizeOf(p, PANEL_SIZE.players) });
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
    this.timers.set(
      state.timers.map((t) => ({
        ...t,
        endsAt: null,
        pausedRemainingMs: null,
        // A session that was going comes back paused, at the time it had when the file was saved.
        ...(t.sessions ? { sessions: t.sessions.map((x) => (x.runningSince === null ? x : { ...x, runningSince: null })) } : {}),
      })),
    );
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
    this.levelingPanel.set(state.levelingPanel);
    this.mapPanel.set(state.mapPanel);
    this.classPanel.set(state.classPanel);
    this.pricePanel.set(state.pricePanel);
    this.wikiPanel.set(state.wikiPanel);
    // The wishlist is kept across layouts: the file's items are added to yours.
    this.wishlistPanel.set({ ...state.wishlistPanel, items: mergeWishes(this.wishlistPanel().items, state.wishlistPanel.items) });
    // Gear Planner characters are kept across layouts too: the file's are added to yours.
    const chars = mergeCharacters(this.gearPanel().characters, state.gearPanel.characters);
    const active = [state.gearPanel.active, this.gearPanel().active].find((id) => chars.some((c) => c.id === id)) ?? chars[0]?.id ?? null;
    this.gearPanel.set({ ...state.gearPanel, characters: chars, active });
    // Your own items are kept too: the file's are added to yours.
    this.customItems.update((mine) => mergeCustomItems(mine, state.customItems));
    this.gameClock.set(state.gameClock);
    // Buff sets are a library, so a layout file adds to them instead of wiping yours (same name: the file's wins).
    const incoming = new Set(state.buffSets.map((s) => s.name.toLowerCase()));
    this.buffSets.update((mine) => [...mine.filter((s) => !incoming.has(s.name.toLowerCase())), ...state.buffSets]);
    this.soundOn.set(state.soundOn);
    this.theme.set(state.theme);
    this.settleCamps();
    this.placeUnplaced();
    this.repairOverlaps();
    this.adoptPrivateLogs();
    return true;
  }

  // ---------- internals ----------

  /** Runs the clock now (the pop-out window calls this when the main window's timers are throttled). */
  tickNow(): void {
    this.tick();
  }

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
      levelingPanel: this.levelingPanel(),
      mapPanel: this.mapPanel(),
      classPanel: this.classPanel(),
      pricePanel: this.pricePanel(),
      wikiPanel: this.wikiPanel(),
      wishlistPanel: this.wishlistPanel(),
      gearPanel: this.gearPanel(),
      customItems: this.customItems(),
      gameClock: this.gameClock(),
      soundOn: this.soundOn(),
      theme: this.theme(),
    };
  }

  /** True when this browser had no saved board yet (a first visit), e.g. to show the quick guide once. */
  firstVisit = false;

  private load(): void {
    let state: AppState = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.firstVisit = !raw;
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
    this.levelingPanel.set(state.levelingPanel);
    this.mapPanel.set(state.mapPanel);
    this.classPanel.set(state.classPanel);
    this.pricePanel.set(state.pricePanel);
    this.wikiPanel.set(state.wikiPanel);
    this.wishlistPanel.set(state.wishlistPanel);
    this.gearPanel.set(state.gearPanel);
    this.customItems.set(state.customItems);
    this.gameClock.set(state.gameClock);
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
