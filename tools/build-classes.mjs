// Builds public/classes.json (and the types in src/app/classes/class-data.ts), the data behind the Classes panel, from the class pages and class guides on
// Stories of Monsters & Memories (https://storiesofmnm.com/classes/), plus our own notes in data/class-notes.json.
//
//   node tools/build-classes.mjs           build from the cached pages in data/.cache/storiesofmnm (git-ignored)
//   node tools/build-classes.mjs --fetch   download the 36 pages first (2 seconds apart), then build
//
// Only facts and short lists are taken: ratings, stats, race numbers, trait and ability names, leveling zones, gear.
// The guides' own explanations ("Why", "Notes" columns and the prose sections) stay on their site; the panel links
// to each section instead.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'data', '.cache', 'storiesofmnm');
const SITE = 'https://storiesofmnm.com';
const CLASSES = [
  'archer', 'bard', 'beastmaster', 'cleric', 'druid', 'elementalist', 'enchanter', 'fighter', 'inquisitor', 'monk',
  'necromancer', 'paladin', 'ranger', 'rogue', 'shadow-knight', 'shaman', 'spellblade', 'wizard',
];
const classUrl = (c) => `${SITE}/class/${c}/`;
const guideUrl = (c) => `${SITE}/wiki/guide/${c}-class-guide/`;

// ---------- fetching ----------

if (process.argv.includes('--fetch')) {
  mkdirSync(cache, { recursive: true });
  const get = async (url, file) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'mnm-assistant (personal fan tool; class panel)' } });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(join(cache, file), await res.text());
    await new Promise((r) => setTimeout(r, 2000));
  };
  await get(`${SITE}/classes/`, 'classes.html');
  for (const c of CLASSES) {
    await get(classUrl(c), `class-${c}.html`);
    await get(guideUrl(c), `guide-${c}.html`);
    console.log('fetched', c);
  }
}

// ---------- HTML helpers (the pages are simple, well-formed WordPress templates) ----------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', middot: '·', times: '×', rarr: '→' };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const text = (html) => decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const all = (re, s) => [...s.matchAll(re)];
const read = (f) => readFileSync(join(cache, f), 'utf8');

function tables(html) {
  return all(/<table[\s\S]*?<\/table>/g, html).map((m) => {
    const t = m[0];
    const head = all(/<th[^>]*>([\s\S]*?)<\/th>/g, t).map((x) => text(x[1]));
    const rows = all(/<tr[^>]*>([\s\S]*?)<\/tr>/g, t)
      .map((r) => all(/<td[^>]*>([\s\S]*?)<\/td>/g, r[1]).map((x) => text(x[1])))
      .filter((r) => r.length);
    // The nearest heading before the table names it (for class-specific tables).
    const before = html.slice(0, m.index);
    const h = all(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/g, before).pop();
    return { head, rows, title: h ? text(h[1]).replace(/^\d+\s*/, '') : '', at: m.index };
  });
}

/** Columns that hold the guide's own explanations; those stay on the guide. */
const firstSentence = (s) => (s.match(/^.*?[.!?](?=\s|$)/) ?? [s])[0].replace(/\s*["“].*$/, '').trim();
/** "Pact of Haste , Spirit Mending" -> "Pact of Haste, Spirit Mending". */
const tidy = (s) => s.replace(/\s+([,.;])/g, '$1').replace(/\s+/g, ' ').trim();
/** Drop the guides' explanations in brackets: "Tough (+10 STA; …), Magic Resistant (…)" -> "Tough, Magic Resistant". */
const namesOnly = (s) => tidy(s.replace(/\s*\([^)]*\)/g, '').replace(/\s+—.*$/, ''));
/** Version / rework badges after a name: "Slow 0.30", "Mend Rework". */
const unbadge = (s) => s.replace(/\s+(\d+\.\d+|Rework|New)$/i, '').trim();
const UNKNOWN = new Set(['??', '', '—', '-', '–']);
const PROSE_COL = /^(why|notes?|why pick it|why it.s good)/i;

// ---------- per class ----------

const listing = read('classes.html');
const categoryOf = {};
for (const m of all(/href="https:\/\/storiesofmnm\.com\/class\/([a-z-]+)\/"[\s\S]*?<\/a>/g, listing)) {
  const tag = m[0].match(/\b(dps|tank|healer|support|hybrid)\b/i);
  if (tag && !categoryOf[m[1]]) categoryOf[m[1]] = tag[1].toLowerCase();
}
// Fall back to reading the listing text in order ("Archer dps …").
const listingText = text(listing);
for (const c of CLASSES) {
  if (categoryOf[c]) continue;
  const name = c.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const m = listingText.match(new RegExp(`${name}\\s+(dps|tank|healer|support|hybrid)`, 'i'));
  if (m) categoryOf[c] = m[1].toLowerCase();
}

const notes = JSON.parse(readFileSync(join(root, 'data', 'class-notes.json'), 'utf8'));
const out = [];

for (const c of CLASSES) {
  const page = read(`class-${c}.html`);
  let guide = read(`guide-${c}.html`);
  guide = guide.slice(0, guide.indexOf('Suggest an Edit') > 0 ? guide.indexOf('Suggest an Edit') : undefined);
  const name = text(guide.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]).replace(/^Monsters and Memories\s+/, '').replace(/\s+Guide$/, '');

  // Sections of the guide, for deep links.
  const sections = all(/<li><a href="#([a-z0-9-]+)"><span>(\d+)<\/span>([\s\S]*?)<\/a><\/li>/g, guide).map((m) => ({
    id: m[1],
    title: text(m[3]),
  }));

  // "At a glance" facts.
  const facts = {};
  for (const m of all(/<div><span>([^<]+)<\/span><strong>([\s\S]*?)<\/strong>(?:<small>([\s\S]*?)<\/small>)?<\/div>/g, guide)) {
    facts[text(m[1]).toLowerCase()] = { value: text(m[2]), note: m[3] ? text(m[3]) : '' };
  }
  const patch = (text(guide).match(/Updated for patch ([0-9.]+[^·]*?)(?:·|$)/) ?? [])[1]?.trim() ?? '';

  // Strengths / weaknesses and key attributes from the class page.
  const pageList = (label) => {
    const i = page.search(new RegExp(`>\\s*${label}\\s*<`));
    if (i < 0) return [];
    const ul = page.slice(i).match(/<ul[\s\S]*?<\/ul>/);
    return ul ? all(/<li[^>]*>([\s\S]*?)<\/li>/g, ul[0]).map((x) => text(x[1])) : [];
  };
  const pageText = text(page);
  const attrs = all(/(Strength|Stamina|Dexterity|Agility|Wisdom|Intelligence|Charisma)\s+(Primary|Secondary|Tertiary)/g,
    pageText.slice(pageText.indexOf('Key Attributes'), pageText.indexOf('Playstyle'))).map((m) => ({ stat: m[1], rank: m[2] }));
  const racesLine = (pageText.match(/Available Races\s+(.*?)\s+Races playable/) ?? [])[1] ?? '';

  // Tables.
  const tbls = [...tables(guide), ...tables(page).map((t) => ({ ...t, fromPage: true }))];
  const used = new Set();
  const take = (pred) => {
    const t = tbls.find((x, i) => !used.has(i) && pred(x));
    if (t) used.add(tbls.indexOf(t));
    return t;
  };
  const col = (t, re) => t.head.findIndex((h) => re.test(h));

  const raceT = take((t) => t.head[0] === 'Race');
  const races = raceT
    ? raceT.rows.map((r) => {
        const stats = {};
        raceT.head.forEach((h, i) => /^[A-Z]{3}$/.test(h) && (stats[h] = Number(r[i]) || r[i]));
        return { race: r[0], stats, startsIn: r[col(raceT, /^Starts/)] ?? '' };
      })
    : [];
  const statCols = raceT ? raceT.head.filter((h) => /^[A-Z]{3}$/.test(h)) : [];

  const traitT = take((t) => t.head[0] === 'Category' && t.head.includes('Best pick'));
  const traits = traitT
    ? traitT.rows.map((r) => ({ category: r[0], pick: namesOnly(r[1]), alternatives: namesOnly(r[col(traitT, /^Alternatives/)] ?? '') }))
    : [];

  const abilT = take((t) => /^Levels?$/.test(t.head[0]) && /^Key /.test(t.head[1] ?? ''));
  const keyLevels = abilT ? abilT.rows.map((r) => ({ level: r[0], names: tidy(r[1]) })) : [];
  const keyLabel = abilT ? abilT.head[1].replace(/^Key /, '') : 'abilities';

  const lines = [];
  for (let t; (t = take((x) => x.head[0] === 'Line')); ) {
    for (const r of t.rows) {
      lines.push({ line: unbadge(r[0]), starts: unbadge(r[1]), progression: tidy(r[2]), purpose: firstSentence(r[3] ?? '') });
    }
  }

  const pathT = take((t) => t.head[0] === 'Levels' && t.head[1] === 'Where');
  const path = pathT ? pathT.rows.map((r) => ({ levels: r[0], where: r[1] })) : [];

  const gear = [];
  for (let t; (t = take((x) => x.head[0] === 'Item' && x.head.includes('Slot'))); ) {
    gear.push({ title: t.title, rows: t.rows.map((r) => ({ item: r[0], slot: r[1], stats: r[2], where: r[3] ?? '' })) });
  }

  // Anything else (pet families, seasons, instruments, stances…): keep the factual columns.
  const extras = tbls
    .filter((t, i) => !used.has(i) && t.rows.length && t.head.length)
    .map((t) => {
      const keep = t.head.map((h, i) => (PROSE_COL.test(h) ? -1 : i)).filter((i) => i >= 0);
      const rows = t.rows.map((r) => keep.map((i) => r[i] ?? ''));
      // Skill tables are mostly "??" so far: keep only the rows with a known cap.
      const known = /Skills$/.test(t.title) ? rows.filter((r) => r.slice(2).some((v) => !UNKNOWN.has(v))) : rows;
      return { title: t.title || 'More', head: keep.map((i) => t.head[i]), rows: known };
    })
    .filter((t) => t.rows.length)
    .filter((t) => t.head.length >= 2)
    // The class page and the guide sometimes show the same table; keep one.
    .filter((t, i, arr) => arr.findIndex((u) => JSON.stringify(u.rows) === JSON.stringify(t.rows)) === i);

  const note = notes[c];
  if (!note) throw new Error(`No notes for ${c} in data/class-notes.json`);

  out.push({
    id: c,
    name,
    category: categoryOf[c] ?? 'dps',
    facts,
    patch,
    attributes: attrs,
    strengths: pageList('Strengths'),
    weaknesses: pageList('Weaknesses'),
    racesAvailable: racesLine.split(',').map((s) => s.trim()).filter(Boolean),
    statCols,
    races,
    traits,
    keyLabel,
    keyLevels,
    lines,
    path,
    gear,
    extras,
    sections,
    classUrl: classUrl(c),
    guideUrl: guideUrl(c),
    ...note,
  });
}

const ts = `// Generated by tools/build-classes.mjs. Don't edit by hand: edit data/class-notes.json (our own notes) and run
// \`npm run classes\` (add --fetch to refresh the pages from Stories of Monsters & Memories).

export interface ClassFact {
  value: string;
  note: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  category: 'tank' | 'healer' | 'dps' | 'support' | 'hybrid';
  /** "At a glance": role, armor, key stats, solo, group demand, difficulty. */
  facts: Record<string, ClassFact>;
  patch: string;
  attributes: { stat: string; rank: string }[];
  strengths: string[];
  weaknesses: string[];
  racesAvailable: string[];
  /** The stat columns of the race table, in the guide's order. */
  statCols: string[];
  races: { race: string; stats: Record<string, number | string>; startsIn: string }[];
  traits: { category: string; pick: string; alternatives: string }[];
  /** "spells", "abilities" or "songs". */
  keyLabel: string;
  keyLevels: { level: string; names: string }[];
  lines: { line: string; starts: string; progression: string; purpose: string }[];
  path: { levels: string; where: string }[];
  gear: { title: string; rows: { item: string; slot: string; stats: string; where: string }[] }[];
  extras: { title: string; head: string[]; rows: string[][] }[];
  /** The guide's sections, for links (guideUrl + '#' + id). */
  sections: { id: string; title: string }[];
  classUrl: string;
  guideUrl: string;
  /** Our own summary and tips (data/class-notes.json). */
  oneLiner: string;
  howToPlay: string;
  tips: string[];
}

export const CLASS_SOURCE = { name: 'Stories of Monsters & Memories', url: '${SITE}/classes/' };

/** Class ids and names, A–Z (the full data, public/classes.json, loads when the Classes panel opens). */
export const CLASS_LIST: { id: string; name: string; category: ClassInfo['category'] }[] = ${JSON.stringify(
  out.map(({ id, name, category }) => ({ id, name, category })),
)};
`;
mkdirSync(join(root, 'src', 'app', 'classes'), { recursive: true });
writeFileSync(join(root, 'src', 'app', 'classes', 'class-data.ts'), ts);
writeFileSync(join(root, 'public', 'classes.json'), JSON.stringify(out));
for (const k of out) {
  console.log(
    `${k.name.padEnd(13)} ${k.category.padEnd(7)} facts ${Object.keys(k.facts).length} attrs ${k.attributes.length} str/weak ${k.strengths.length}/${k.weaknesses.length} races ${k.races.length} traits ${k.traits.length} key ${k.keyLevels.length} lines ${k.lines.length} path ${k.path.length} gear ${k.gear.reduce((n, g) => n + g.rows.length, 0)} extras ${k.extras.map((e) => e.title).join('; ')}`,
  );
}
