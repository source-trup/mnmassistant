/**
 * Monsters & Memories game time, worked out the same way as the community wiki's sidebar clock
 * (MediaWiki:Gadget-mnmGameTimeSidebar.js on monstersandmemories.miraheze.org):
 *
 *  - game time runs SPEED (20) times faster than real time, counted from midnight UTC:
 *    one game day lasts 72 real minutes, one game hour 3 real minutes;
 *  - "Day N of 20": the game days since midnight UTC;
 *  - the date: today's UTC weekday and month, with their Eth-ur names.
 */

/** Game minutes per real minute (the wiki's formula; GameClock can update it from the wiki). */
export const DEFAULT_SPEED = 20;
const DAY_MS = 86_400_000;
const GAME_DAY_MIN = 1440;

const MONTHS = ['Sundawn', 'Frostmelt', 'Earthtill', 'Heartsblood', 'Springsend', 'Sunpeak', 'Midsummer', 'Meldulstand', 'Harvesttide', 'Sheafall', 'Dyingember', 'Longwinter'];
const WEEKDAYS = ['Rellden', 'Eltinden', 'Sorophden', 'Tremden', 'Krivden', 'Tilustden', 'Matsden'];

export interface GameTime {
  /** Minutes into the game day, 0–1439. */
  minutes: number;
  hour: number;
  minute: number;
  /** Game day of the real (UTC) day, 1…speed. */
  dayOf: number;
  daysPerRealDay: number;
  weekday: string;
  month: string;
  dayOfMonth: number;
}

function utcMidnight(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** The game time at real time `t` (ms). `offset` shifts it by that many game minutes (to match your game). */
export function gameTime(t: number, speed = DEFAULT_SPEED, offset = 0): GameTime {
  const midnight = utcMidnight(t);
  const sinceMidnight = t - midnight;
  const raw = (sinceMidnight / 60_000) * speed + offset;
  const minutes = ((raw % GAME_DAY_MIN) + GAME_DAY_MIN) % GAME_DAY_MIN;
  const d = new Date(midnight);
  return {
    minutes,
    hour: Math.floor(minutes / 60),
    minute: Math.floor(minutes % 60),
    dayOf: Math.min(speed, Math.floor((sinceMidnight / DAY_MS) * speed) + 1),
    daysPerRealDay: speed,
    weekday: WEEKDAYS[d.getUTCDay()],
    month: MONTHS[d.getUTCMonth()],
    dayOfMonth: d.getUTCDate(),
  };
}

/** "9:41 PM" for a minute of the game day. */
export function formatGameClock(minutes: number): string {
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60) % 24;
  const mm = String(m % 60).padStart(2, '0');
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "10 PM" for a game hour. */
export function formatGameHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st (the same rule as the wiki's clock). */
export function ordinal(n: number): string {
  if (n > 3 && n < 21) return `${n}th`;
  const suffix = n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** Real milliseconds from `t` until the game clock next reads `targetMinutes` (0 if it reads it now). */
export function msUntilGameMinute(t: number, targetMinutes: number, speed = DEFAULT_SPEED, offset = 0): number {
  const now = gameTime(t, speed, offset).minutes;
  const ahead = (((targetMinutes - now) % GAME_DAY_MIN) + GAME_DAY_MIN) % GAME_DAY_MIN;
  return (ahead / speed) * 60_000;
}

export interface WindowStatus {
  open: boolean;
  /** Real ms until it closes (when open) or opens (when closed). */
  ms: number;
}

/** A window of game hours, e.g. 22 → 4 (wraps past midnight). from === to means all day. */
export function windowStatus(t: number, fromHour: number, toHour: number, speed = DEFAULT_SPEED, offset = 0): WindowStatus {
  const now = gameTime(t, speed, offset).minutes;
  const from = (((fromHour % 24) + 24) % 24) * 60;
  const to = (((toHour % 24) + 24) % 24) * 60;
  if (from === to) return { open: true, ms: Infinity };
  const open = from < to ? now >= from && now < to : now >= from || now < to;
  return { open, ms: msUntilGameMinute(t, open ? to : from, speed, offset) };
}

/**
 * Reads the speed out of the wiki gadget's source ("totalRealMinutes * 20) % 1440"), or null if the source doesn't
 * look like the formula this app implements (counted from midnight UTC, wrapping at 1440 game minutes).
 */
export function speedFromGadget(source: string): number | null {
  if (!/Date\.UTC\(/.test(source) || !/%\s*1440/.test(source)) return null;
  const m = source.match(/totalRealMinutes\s*\*\s*(\d+(?:\.\d+)?)/) ?? source.match(/Minutes\s*\*\s*(\d+(?:\.\d+)?)\s*\)\s*%\s*1440/);
  const speed = m ? Number(m[1]) : NaN;
  return speed > 0 && speed <= 1440 ? speed : null;
}
