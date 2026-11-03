/** Position on the layout grid, in grid cells (see layout.ts). */
export interface GridPos {
  x: number;
  y: number;
}

export interface TimerItem extends GridPos {
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

interface CounterBase extends GridPos {
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

/** Tracks named spawns vs placeholder spawns at a camp, with a full kill history. */
export interface NamedPhCounter extends CounterBase {
  kind: 'namedPh';
  ph: number;
  named: number;
  /** Placeholders killed since the last named. */
  phSinceNamed: number;
  /** Every kill, oldest first. Survives counter resets; cleared only from the history dialog. */
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
export interface BuffPanel extends GridPos {
  id: string;
  name: string;
  buffs: BuffEntry[];
}

/** A free-text note panel. */
export interface NoteItem extends GridPos {
  id: string;
  name: string;
  text: string;
  /** Text size in px. */
  fontSize: number;
}

export type Theme = 'spirit' | 'classic';

export interface AppState {
  version: 4;
  timers: TimerItem[];
  counters: CounterItem[];
  buffPanels: BuffPanel[];
  notes: NoteItem[];
  soundOn: boolean;
  theme: Theme;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';
