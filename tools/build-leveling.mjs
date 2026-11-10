// Builds src/app/leveling/leveling-data.ts, which the Leveling panel uses, from two sources:
//   - data/leveling.csv: the community "where to level" sheet, exported as CSV
//   - data/hunting-guide.json: the Per-Level Hunting Guide from the Monsters and Memories Wiki on Miraheze
//     (CC BY-SA 4.0), extracted from https://monstersandmemories.miraheze.org/wiki/Per-Level_Hunting_Guide
// Run: node tools/build-leveling.mjs      (also: npm run leveling)
//
// Sheet layout: a header row of level columns (1, 5, 10 … 60), a region row ("Szuur Region"), then zones down
// column A with their camps listed under the level column they suit. A zone continues on the rows below it until
// the next zone name. "(R)" marks a raid encounter.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** "Newbie Lift | Newbie Ruins" -> two camps, but "Ashira (near TE | behind hidden wall)" stays one. */
function splitCamps(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '|' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Spelling fixes so the same camp listed twice merges. */
const SAME = { 'Maddening Echos': 'Maddening Echoes' };

const rows = parseCsv(readFileSync(join(root, 'data', 'leveling.csv'), 'utf8'));
let columns = null; // level of each sheet column (index 1..)
let region = '';
const zones = []; // { name, abbr, region, camps: Map<key, {name, raid, cols:Set}> }
let zone = null;

for (const r of rows) {
  const cells = r.map((c) => c.trim());
  // Header row of level columns.
  if (cells.slice(1).filter((c) => /^\d+$/.test(c)).length >= 10) {
    columns = cells.map((c) => (/^\d+$/.test(c) ? Number(c) : null));
    continue;
  }
  const regionCell = cells.slice(1).find((c) => /region$/i.test(c));
  if (regionCell) { region = regionCell.replace(/\s*region$/i, ''); continue; }
  if (!columns || cells.some((c) => /ROUGH LEVEL|ZONE LIST/.test(c)) && !cells[0].match(/\(\w+\)$/)) continue;
  if (cells[0]) {
    const m = cells[0].match(/^(.*?)\s*\((\w+)\)$/);
    zone = { name: m ? m[1] : cells[0], abbr: m ? m[2] : '', region, camps: new Map() };
    zones.push(zone);
  }
  if (!zone) continue;
  cells.forEach((cell, i) => {
    if (i === 0 || !cell || columns[i] == null) return;
    for (let name of splitCamps(cell)) {
      const raid = /\(R\)\s*$/.test(name);
      name = name.replace(/\s*\(R\)\s*$/, '');
      name = SAME[name] ?? name;
      const key = name.toLowerCase();
      const camp = zone.camps.get(key) ?? { name, raid, cols: new Set() };
      camp.raid ||= raid;
      camp.cols.add(columns[i]);
      zone.camps.set(key, camp);
    }
  });
}

const levels = columns.filter((c) => c != null);
/** A column's level bracket: from its level up to just before the next column (the last column is just itself). */
const bracketEnd = (lvl) => { const next = levels.find((l) => l > lvl); return next ? next - 1 : lvl; };

// ---------- Per-Level Hunting Guide ----------

const guide = JSON.parse(readFileSync(join(root, 'data', 'hunting-guide.json'), 'utf8'));
/** Guide zone names that are spelled differently in the sheet. */
const ZONE_ALIAS = { 'Tel Ekir': "Tel'Ekir" };

/**
 * Reads the guide's free-text levels: "1-5", "17+" (taken as 17-22), "12?", "~32+", "27".
 * Anything else ("Most Can't", blank) gives null.
 */
function parseLevels(text) {
  const t = text.replace(/[~?]/g, '').trim();
  let m = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
  m = t.match(/^(\d+)\s*\+$/);
  if (m) return [+m[1], Math.min(60, +m[1] + 5)];
  m = t.match(/^(\d+)$/);
  if (m) return [+m[1], +m[1]];
  return null;
}

for (const spot of guide.spots) {
  const ranges = [parseLevels(spot.solo), parseLevels(spot.group)].filter(Boolean);
  // No usable level on the row: fall back to the page section it's under ("Hunting Spots 16-20").
  const [min, max] = ranges.length
    ? [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))]
    : spot.section;
  const entry = { area: spot.area, monsters: spot.monsters, notes: spot.notes, solo: spot.solo, group: spot.group, min, max };
  for (const raw of spot.zones) {
    const name = ZONE_ALIAS[raw] ?? raw;
    let z = zones.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!z) {
      // A zone the sheet doesn't list ("Night Harbor East"): put it in the region of the zone it's named after.
      const parent = zones.find((x) => name.startsWith(x.name));
      z = { name, abbr: '', region: parent?.region ?? '', camps: new Map() };
      zones.splice(parent ? zones.indexOf(parent) + 1 : zones.length, 0, z);
    }
    (z.spots ??= []).push(entry);
  }
}

const out = zones.map((z) => ({
  name: z.name,
  abbr: z.abbr,
  region: z.region,
  camps: [...z.camps.values()]
    .map((c) => {
      const cols = [...c.cols].sort((a, b) => a - b);
      return { name: c.name, raid: c.raid, min: cols[0], max: bracketEnd(cols[cols.length - 1]), cols };
    })
    .sort((a, b) => a.min - b.min || a.max - b.max),
  spots: (z.spots ?? []).sort((a, b) => a.min - b.min || a.max - b.max),
}));

const ts = `// Generated by tools/build-leveling.mjs from data/leveling.csv and data/hunting-guide.json. Don't edit by
// hand: edit those files and run
// \`npm run leveling\`.

export interface LevelingCamp {
  name: string;
  /** Raid encounter ("(R)" in the sheet). */
  raid: boolean;
  /** Level range the camp suits (from the sheet's level columns). */
  min: number;
  max: number;
  /** The sheet columns it was listed under. */
  cols: number[];
}

/** A hunting spot from the wiki's Per-Level Hunting Guide. */
export interface HuntingSpot {
  area: string;
  monsters: string;
  notes: string;
  /** The guide's own level text, as written ("17+", "12?", "Most Can't"); may be empty. */
  solo: string;
  group: string;
  /** Level range used for filtering (solo and group combined, or the guide section when neither is a number). */
  min: number;
  max: number;
}

export interface LevelingZone {
  name: string;
  abbr: string;
  region: string;
  camps: LevelingCamp[];
  spots: HuntingSpot[];
}

/** Where the hunting spots came from, and their license. */
export const HUNTING_GUIDE = ${JSON.stringify({ url: guide.source, license: guide.license })};

/** The sheet's level columns. */
export const LEVELING_COLUMNS: number[] = ${JSON.stringify(levels)};

export const LEVELING_ZONES: LevelingZone[] = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(join(root, 'src', 'app', 'leveling', 'leveling-data.ts'), ts);
const camps = out.reduce((n, z) => n + z.camps.length, 0);
console.log(`${guide.spots.length} hunting guide spots merged`);
console.log(`${out.length} zones, ${camps} camps (${out.filter((z) => !z.camps.length && !z.spots.length).map((z) => z.name).join(', ') || 'none'} empty) -> src/app/leveling/leveling-data.ts`);
