/**
 * Where to level, from Worth the Camp's data (https://worththecamp.com/leveling explains the rules this follows):
 *  - Solo aims at or below your level, lower for classes that find soloing hard (the class's community solo tier):
 *    S −3 to 0, A −3 to −1, B −4 to −2, C −5 to −3, D −6 to −4. Group aims 2–3 levels above you.
 *  - Named mobs (anything not called "a …" or "an …") hit harder, so they're matched against the target moved 2
 *    levels lower.
 *  - An NPC counts when its known level range overlaps the target. Raid bosses are left out.
 *  - Zones with more NPCs in range come first. Cities and hubs have NPCs of every level, so they count for less.
 *  - Con colours follow the in-game consider colours, judged at the NPC's highest level (the safe side).
 * The ranking is our own (Worth the Camp doesn't publish its exact formula), so the order can differ a little from
 * their page.
 */

export type SoloTier = 'S' | 'A' | 'B' | 'C' | 'D';
export type LevelingMode = 'solo' | 'group';
export type Con = 'grey' | 'green' | 'lightblue' | 'blue' | 'white' | 'yellow' | 'red';

/** An NPC as the panel keeps it (trimmed from Worth the Camp's npcs.json). */
export interface WtcNpc {
  /** Worth the Camp's id (its page is /npc/<id>). */
  id: string;
  name: string;
  zone: string;
  lo: number;
  hi: number;
  /** How many items it's known to drop. */
  drops: number;
  /** A raid boss (left out of leveling; the Gear Planner can include its drops). */
  raid?: boolean;
}

/** A zone's page on Worth the Camp, by zone name. */
export interface WtcZone {
  name: string;
  url: string;
}

export interface WtcClass {
  name: string;
  tier: SoloTier;
}

export interface Target {
  lo: number;
  hi: number;
  /** Where named mobs are matched (2 levels lower). */
  namedLo: number;
  namedHi: number;
}

export interface ZoneMatch {
  zone: string;
  /** NPCs in range: the regulars (what you'd grind) lowest level first, then the named. */
  npcs: (WtcNpc & { named: boolean; con: Con })[];
  /** Level range of every NPC known in the zone. */
  zoneLo: number;
  zoneHi: number;
  /** A city or hub (NPCs of every level): counts for less. */
  hub: boolean;
  score: number;
}

/** Solo target, relative to your level, per class tier. */
export const SOLO_OFFSETS: Record<SoloTier, [number, number]> = {
  S: [-3, 0],
  A: [-3, -1],
  B: [-4, -2],
  C: [-5, -3],
  D: [-6, -4],
};

/** Group target, relative to your level. */
export const GROUP_OFFSETS: [number, number] = [2, 3];

/** How much a city or hub's NPCs count. */
const HUB_WEIGHT = 0.6;
/** Zones whose NPCs span at least this many levels are hubs too. */
const HUB_SPREAD = 30;
const CITIES = new Set(['night harbor', "ail'vorith", 'faelindral']);

export function targetFor(level: number, mode: LevelingMode, tier: SoloTier): Target {
  const [a, b] = mode === 'group' ? GROUP_OFFSETS : SOLO_OFFSETS[tier];
  const lo = Math.max(1, level + a);
  const hi = Math.max(1, level + b);
  return { lo, hi, namedLo: Math.max(1, lo - 2), namedHi: Math.max(1, hi - 2) };
}

/** Named: anything not called "a …" or "an …". */
export function isNamed(name: string): boolean {
  return !/^an? /i.test(name.trim());
}

/** The consider colour of a mob `mobLevel` to you at `level`. */
export function conOf(mobLevel: number, level: number): Con {
  const d = mobLevel - level;
  if (d >= 3) return 'red';
  if (d >= 1) return 'yellow';
  if (d === 0) return 'white';
  if (d >= -3) return 'blue';
  if (d === -4) return 'lightblue';
  if (d === -5) return 'green';
  return 'grey';
}

export const CON_LABEL: Record<Con, string> = {
  grey: 'Grey: too low to be worth anything',
  green: 'Green: trivial',
  lightblue: 'Light blue: much lower level',
  blue: 'Blue: lower level',
  white: 'White: same level',
  yellow: 'Yellow: higher level',
  red: 'Red: much higher level',
};

/** Zones to level in, best first. */
export function levelingPlan(npcs: readonly WtcNpc[], level: number, mode: LevelingMode, tier: SoloTier): ZoneMatch[] {
  const t = targetFor(level, mode, tier);
  const byZone = new Map<string, WtcNpc[]>();
  for (const n of npcs) {
    if (n.raid) continue;
    const list = byZone.get(n.zone);
    if (list) list.push(n);
    else byZone.set(n.zone, [n]);
  }
  const out: ZoneMatch[] = [];
  for (const [zone, all] of byZone) {
    const npcsIn = all
      .map((n) => ({ ...n, named: isNamed(n.name) }))
      .filter((n) => (n.named ? n.lo <= t.namedHi && n.hi >= t.namedLo : n.lo <= t.hi && n.hi >= t.lo))
      .map((n) => ({ ...n, con: conOf(n.hi, level) }))
      .sort((a, b) => Number(a.named) - Number(b.named) || a.lo - b.lo || a.hi - b.hi || a.name.localeCompare(b.name));
    if (!npcsIn.length) continue;
    const zoneLo = Math.min(...all.map((n) => n.lo));
    const zoneHi = Math.max(...all.map((n) => n.hi));
    const hub = CITIES.has(zone.toLowerCase()) || zoneHi - zoneLo >= HUB_SPREAD;
    out.push({ zone, npcs: npcsIn, zoneLo, zoneHi, hub, score: npcsIn.length * (hub ? HUB_WEIGHT : 1) });
  }
  const regulars = (m: ZoneMatch) => m.npcs.filter((n) => !n.named).length;
  return out.sort((a, b) => b.score - a.score || regulars(b) - regulars(a) || a.zone.localeCompare(b.zone));
}

/** Worth the Camp's own leveling page for these choices. */
export function wtcLevelingUrl(cls: string | null, level: number | null, mode: LevelingMode): string {
  const q = new URLSearchParams();
  if (cls) q.set('cls', cls);
  if (level) q.set('lvl', String(level));
  q.set('mode', mode);
  return `https://worththecamp.com/leveling?${q}`;
}

/** A zone's page on Worth the Camp (its own link when the zone list has one). */
export function wtcZoneUrl(zone: string, zones: readonly WtcZone[]): string {
  const known = zones.find((z) => z.name.toLowerCase() === zone.toLowerCase());
  if (known) return known.url;
  const slug = zone
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://worththecamp.com/npcs/${slug}`;
}

export function wtcNpcUrl(id: string): string {
  return `https://worththecamp.com/npc/${encodeURIComponent(id)}`;
}
