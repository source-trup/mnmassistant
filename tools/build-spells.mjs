// Converts data/spells.txt (the tab-separated spell list) into public/spells.json, which the Spells panel loads.
// Run: node tools/build-spells.mjs      (also runs via "npm run spells")
//
// Each spell in the text file is:
//   Name
//   <tab>Kind(s)<tab>Lvl<tab>School<tab>Mana<tab>Price<tab>
//   Class            (one line per class)
//   <tab>Effect
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = ['Damage', 'Heal', 'Buff', 'Debuff', 'Crowd control', 'Defense', 'Pet', 'Cure', 'Threat', 'Utility'];
const NONE = new Set(['', '–', '-']);

/** "DamageCrowd controlDebuff" -> ["Damage", "Crowd control", "Debuff"] (kinds run together in the file). */
function splitKinds(text) {
  const out = [];
  let rest = text.trim();
  while (rest && !NONE.has(rest)) {
    const kind = KINDS.find((k) => rest.startsWith(k));
    if (!kind) throw new Error(`Unknown kind in "${text}"`);
    out.push(kind);
    rest = rest.slice(kind.length);
  }
  return out;
}

/** "1g 4s 50c", "25cp", "11sp" -> copper (100c = 1s, 100s = 1g); "–" -> null. */
function parsePrice(text) {
  const t = text.trim();
  if (NONE.has(t)) return null;
  let copper = 0;
  for (const m of t.matchAll(/(\d+)\s*(g|s|c)p?/g)) copper += +m[1] * { g: 10000, s: 100, c: 1 }[m[2]];
  if (!/^(\d+\s*[gsc]p?\s*)+$/.test(t)) throw new Error(`Unreadable price "${text}"`);
  return copper;
}

const lines = readFileSync(join(root, 'data', 'spells.txt'), 'utf8').replace(/\r/g, '').split('\n').slice(1);
const schools = [];
const classes = [];
const index = (list, value) => (list.includes(value) ? list.indexOf(value) : list.push(value) - 1);
const spells = [];

for (let i = 0; i < lines.length; ) {
  if (!lines[i].trim()) { i++; continue; }
  const name = lines[i++].trim();
  const meta = lines[i++].split('\t');
  if (meta.length < 6 || meta[0] !== '') throw new Error(`Bad details line for "${name}"`);
  const cls = [];
  while (i < lines.length && lines[i] && !lines[i].startsWith('\t')) cls.push(lines[i++].trim());
  const effect = (lines[i++] ?? '').trim();
  if (!cls.length) throw new Error(`No classes for "${name}"`);
  const [, kind, lvl, school, mana, price] = meta.map((m) => m.trim());
  spells.push([
    name,
    splitKinds(kind).map((k) => KINDS.indexOf(k)),
    Number(lvl),
    NONE.has(school) ? -1 : index(schools, school),
    NONE.has(mana) ? null : /^\d+$/.test(mana) ? Number(mana) : mana, // number, "Innate", "None" or null
    parsePrice(price),
    cls.map((c) => index(classes, c)),
    NONE.has(effect) ? '' : effect,
  ]);
}

const out = { kinds: KINDS, schools, classes, spells };
writeFileSync(join(root, 'public', 'spells.json'), JSON.stringify(out));
console.log(`${spells.length} spells, ${classes.length} classes, ${schools.length} schools -> public/spells.json`);
