import type { ThemeId } from './themes';

/** Position on the layout grid, in grid cells (see layout.ts). */
export interface GridPos {
  x: number;
  y: number;
}

/**
 * A panel's size in grid cells, once it has been resized. Missing means the default size for its kind
 * (PANEL_SIZE in layout.ts), so boards saved before panels were resizable load unchanged.
 */
export interface Sized {
  w?: number;
  h?: number;
}

export interface TimerItem extends GridPos, Sized {
  id: string;
  name: string;
  /** True while the name is the generated default (e.g. "6:00 spawn"); such timers chime instead of speaking. */
  autoNamed: boolean;
  /** Full countdown length in milliseconds. */
  durationMs: number;
  /** Epoch ms when the running countdown hits zero; null when idle or paused. */
  endsAt: number | null;
  /** Remaining ms while paused; null when not paused. */
  pausedRemainingMs: number | null;
  /** Automatically start over when it reaches zero. */
  repeat: boolean;
}

interface CounterBase extends GridPos, Sized {
  id: string;
  name: string;
  /** Epoch ms of the last reset, used for per-hour rates and "session" stats. */
  since: number;
  /** Timer to restart whenever this counter is incremented via its main buttons. */
  linkedTimerId: string | null;
}

/** A single number starting at 0. */
export interface StandardCounter extends CounterBase {
  kind: 'standard';
  value: number;
  step: number;
  /** Optional goal, e.g. "collect 20". */
  target: number | null;
}

/** An item that dropped, optionally matched to a wiki entry. */
export interface LootItem {
  name: string;
  wikiId?: string;
  url?: string;
}

/** One kill at a camp. */
export interface CampEvent {
  id: string;
  /** Epoch ms of the kill. */
  t: number;
  type: 'ph' | 'named';
  loot: LootItem[];
}

/**
 * Tracks named spawns vs placeholder spawns at a camp. The kill history lives in a CampLog: the named NPC's log
 * when the counter is linked to a timer you've named (e.g. "Grimfang"), otherwise the counter's own log.
 */
export interface NamedPhCounter extends CounterBase {
  kind: 'namedPh';
  ph: number;
  named: number;
  /** Placeholders killed since the last named. */
  phSinceNamed: number;
}

/**
 * Kill history for one named NPC (key "npc:<name>"), or for a camp that isn't tied to a named timer
 * (key "counter:<id>"). Survives counter resets and deletes; cleared only from the history dialog.
 */
export interface CampLog {
  key: string;
  /** NPC name (or counter name for a private log), for display. */
  name: string;
  /** Every kill, oldest first. */
  history: CampEvent[];
}

export type CounterItem = StandardCounter | NamedPhCounter;
export type CounterKind = CounterItem['kind'];

export interface BuffEntry {
  id: string;
  name: string;
  autoNamed: boolean;
  durationMs: number;
  /** Warn this long before the buff fades. */
  warnMs: number;
  /** Epoch ms when the buff fades; null when not active. */
  endsAt: number | null;
}

/** A panel holding a list of buff reminders. */
export interface BuffPanel extends GridPos, Sized {
  id: string;
  name: string;
  buffs: BuffEntry[];
}

/** A saved list of buffs (names and timings only) that can be loaded into any Buff Tracker. */
export interface BuffSet {
  id: string;
  name: string;
  buffs: { name: string; durationMs: number; warnMs: number }[];
}

/** One line of a checklist note, e.g. "18× Copper Ore". */
export interface CheckItem {
  id: string;
  text: string;
  /** How many you need, if the line had a count. */
  qty: number | null;
  done: boolean;
  /** Where it comes from (the wiki table's "From" column), shown as a tooltip. */
  from?: string;
}

/** A note panel: free text, or a checklist (shopping list). */
export interface NoteItem extends GridPos {
  id: string;
  name: string;
  type: 'text' | 'checklist';
  text: string;
  /** Checklist lines (type 'checklist'). */
  items: CheckItem[];
  /** Text size in px. */
  fontSize: number;
  /** Size in grid cells (notes can be resized). */
  w: number;
  h: number;
  /** Put away: kept (with its text) but not shown on the board. Reopen it from the Notes menu. */
  closed: boolean;
}

/** The two player lists. */
export type PlayerListKind = 'naughty' | 'nice';

/** A player on the Naughty or Nice list. */
export interface PlayerEntry {
  name: string;
  /** Optional reason, e.g. "ninja-looted the FBSS". */
  note: string;
  /** Epoch ms when added. */
  added: number;
}

/** Position and visibility of a list panel (each list has exactly one panel). */
export interface PlayerListPanel extends GridPos, Sized {
  kind: PlayerListKind;
  shown: boolean;
}

/** The single Level range panel: where it is, whether it's shown, and the last level typed in. */
export interface LevelPanel extends GridPos, Sized {
  shown: boolean;
  level: number | null;
}

/** The single Spells panel: position, size, visibility and the last class / level picked. */
export interface SpellPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Class filter; null = all classes. */
  cls: string | null;
  /** Level filter; null = all levels. */
  level: number | null;
}

/** The single Leveling panel: position, size, visibility and the last filters used. */
export interface LevelingPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Level, or the low end of a range; null = nothing picked yet. */
  from: number | null;
  /** High end of a range; null = a single level. */
  to: number | null;
  /** Region filter; null = all regions. */
  region: string | null;
  raids: boolean;
  /** Which data to show: the leveling sheet's camps, the wiki hunting guide's spots, or both. */
  source: 'both' | 'sheet' | 'guide';
}

/** The single Map panel (MnM Atlas embed): position, size, visibility and what it's showing. */
export interface MapPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Atlas map id (e.g. "night-harbor") and level / floor id, if the map has them. */
  map: string;
  level: string | null;
  /** A place or NPC searched for across all maps; while set, it's shown instead of the chosen map. */
  find: string | null;
}

/** The single Classes panel: position, size, visibility, the class shown and the open tab. */
export interface ClassPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Class id ("shaman", "shadow-knight"); null = follow the theme's class. */
  cls: string | null;
  tab: 'overview' | 'build' | 'abilities' | 'leveling' | 'gear' | 'more';
}

/** The single Prices panel (MnMdb market data): position, size, visibility and what it's showing. */
export interface PricePanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Item being looked at. */
  item: string | null;
  /** How far back listings count: the last 7 or 30 days. */
  days: 7 | 30;
  /** Recently checked items, newest first. */
  recent: string[];
}

/** One theme per class (see themes.ts); "shaman" is the default. */
export type Theme = ThemeId;

export interface AppState {
  version: 5;
  timers: TimerItem[];
  counters: CounterItem[];
  campLogs: CampLog[];
  /** Every item name ever entered as loot (kept even if the kill log it came from is deleted). */
  lootLibrary: LootItem[];
  buffPanels: BuffPanel[];
  buffSets: BuffSet[];
  notes: NoteItem[];
  /** Naughty / Nice player lists. */
  players: Record<PlayerListKind, PlayerEntry[]>;
  listPanels: Record<PlayerListKind, PlayerListPanel>;
  levelPanel: LevelPanel;
  spellPanel: SpellPanel;
  levelingPanel: LevelingPanel;
  mapPanel: MapPanel;
  classPanel: ClassPanel;
  pricePanel: PricePanel;
  soundOn: boolean;
  theme: Theme;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';
