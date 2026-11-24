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
  /** Warn this long before it reaches zero (a Named / PH timer's "Warn at"); missing or null = no warning. */
  warnMs?: number | null;
  /**
   * 'session': a Session timer, which counts up instead of down. Each start → end is a session (pauses allowed), and
   * it can hold counters whose counts are kept per session for the stats. Missing means a countdown.
   */
  mode?: 'session';
  /** Session timer: every session, oldest first. The last one is still going while its `end` is null. */
  sessions?: TimerSession[];
}

/** One session of a Session timer: from start to end, with what each of its counters added up to. */
export interface TimerSession {
  id: string;
  /** Epoch ms it started, and ended (null while it's still going). */
  start: number;
  end: number | null;
  /** Time counted before the current run (pauses don't count). */
  elapsedMs: number;
  /** Epoch ms the current run began; null while paused or after the end. */
  runningSince: number | null;
  /** What each counter added up to this session, by counter id. */
  counts: Record<string, SessionCount>;
}

/** One counter's tally in one session. */
export interface SessionCount {
  /** The counter's name then (kept if the counter is renamed or deleted later). */
  name: string;
  total: number;
  /** The changes by minute of session time (pauses don't count): [minute, change], minutes in order. */
  marks: [number, number][];
}

interface CounterBase extends GridPos, Sized {
  id: string;
  name: string;
  /** Epoch ms of the last reset, used for per-hour rates and "session" stats. */
  since: number;
}

/** A single number starting at 0. */
export interface StandardCounter extends CounterBase {
  kind: 'standard';
  value: number;
  step: number;
  /** Optional goal, e.g. "collect 20". */
  target: number | null;
  /** The Session timer it lives in (it's shown in that panel, not on its own); missing or null = its own panel. */
  timerId?: string | null;
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
 * A Named / PH timer: one panel with the camp's respawn countdown and its named vs placeholder kills. + PH and
 * + Named restart the countdown. The kill history lives in a CampLog: the named NPC's log once the camp has a name
 * of your own (e.g. "Grimfang"), otherwise the camp's own log.
 */
export interface NamedPhCounter extends CounterBase {
  kind: 'namedPh';
  /**
   * The camp's countdown. It's kept in the timers list (so it alerts like any timer) but only ever shown inside this
   * panel; its name is the camp's name.
   */
  timerId: string;
  /** Put away: kept (counts, countdown length, kill log) but not shown on the board. Reopen it from ＋ Add. */
  closed: boolean;
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
  /** Checklist: show Trem market prices next to the items. */
  priced?: boolean;
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
  /** Spells you've bought (spellKey: name|level|classes), left out of the cost totals. */
  bought: string[];
}

/** The single Leveling panel: position, size, visibility and the last filters used. */
export interface LevelingPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Your class, as Worth the Camp names it ("Shaman"); null = follow the theme's class. */
  cls: string | null;
  /** Your level; null = nothing picked yet. */
  level: number | null;
  /** Hunting alone or with a group. */
  mode: 'solo' | 'group';
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

/** The single Wiki panel (community wiki on Miraheze): position, size, visibility and the page last open. */
export interface WikiPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  /** Page title last shown, or null for the search view. */
  page: string | null;
}

/** An item on the wishlist. Stats and sources come from MnMdb and the wikis; `from` is what you typed yourself. */
export interface WishItem {
  id: string;
  name: string;
  /** Where it drops or how to get it, in your own words (shown when MnMdb has nothing, or alongside it). */
  from: string;
  /** Its page on monstersandmemories.wiki, when known (found by the wiki's item search, or pasted in). */
  wikiUrl: string | null;
  /** Got it: kept on the list, struck through, at the bottom. */
  got: boolean;
  added: number;
}

/** The single Wishlist panel: position, size, visibility and the list itself. */
export interface WishlistPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  items: WishItem[];
  /** Hide items you've got. */
  hideGot: boolean;
}

/** One character in the Gear Planner: who they are and what they wear. */
export interface GearCharacter {
  id: string;
  name: string;
  /** Class, as Worth the Camp names it ("Shaman", "Shadowknight"); null = not picked. */
  cls: string | null;
  /** Race code as Worth the Camp's item data uses it ("Dgn"); null = not picked (race limits aren't checked). */
  race: string | null;
  /** Which of the race's portraits the paper doll shows (male / female). */
  look: 'm' | 'f';
  level: number | null;
  /** Item id and name per equipment position (see gear.ts POSITIONS). */
  gear: Partial<Record<string, { id: number; name: string }>>;
  /** Stat weights you've changed from the class defaults. */
  weights: Partial<Record<string, number>>;
}

/** The upgrade finder's filters. */
export interface GearFinder {
  /** Slot type, or null for every slot. */
  slot: string | null;
  /** Drops from mobs up to this level; null = your level + 3. */
  maxMob: number | null;
  drops: boolean;
  crafted: boolean;
  quest: boolean;
  raid: boolean;
}

/** The single Gear Planner panel: position, size, visibility, the view open, your characters and the finder's filters. */
export interface GearPanel extends GridPos {
  shown: boolean;
  w: number;
  h: number;
  view: 'doll' | 'finder' | 'recommended';
  characters: GearCharacter[];
  /** The character shown. */
  active: string | null;
  finder: GearFinder;
}

/**
 * An item you made yourself (🛠 My items): for anything the item sites don't have yet. It joins the Gear Planner's
 * items and the Wishlist like any other, with its own item card.
 */
export interface CustomItem {
  /** Negative, so it never clashes with Worth the Camp's item ids (gear is saved by id). */
  id: number;
  name: string;
  /** Full URL of its icon (one of the wiki's item icons), or null. */
  icon: string | null;
  /** Slot types it can go in (gear.ts SLOT_TYPES). */
  slots: string[];
  /** AC, HP, Mana, attributes and resists, by the planner's stat keys (gear.ts STATS). */
  stats: Partial<Record<string, number>>;
  /** Weapon damage and delay (0 when it isn't a weapon). */
  dmg: number;
  delay: number;
  twoHand: boolean;
  /** Where it comes from, in your words (shown on its card). */
  source: string;
  added: number;
}

/** A span of game hours to watch, e.g. a named that only spawns at night (22 → 4). */
export interface GameWindow {
  id: string;
  name: string;
  /** Game hours 0–23; the window wraps past midnight when from > to. */
  from: number;
  to: number;
}

/** The game clock in the toolbar: your windows and any correction. */
export interface GameClockSettings {
  windows: GameWindow[];
  /** Game minutes to shift the clock by, if your game disagrees with the wiki's clock. */
  offset: number;
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
  wikiPanel: WikiPanel;
  wishlistPanel: WishlistPanel;
  gearPanel: GearPanel;
  /** Items you made yourself. */
  customItems: CustomItem[];
  gameClock: GameClockSettings;
  soundOn: boolean;
  theme: Theme;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

/** Where a Session timer is: no session going, counting, or paused. */
export type SessionStatus = 'idle' | 'running' | 'paused';
