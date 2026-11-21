import type { CustomItem } from '../models';

/**
 * Gear Planner logic: the paper doll's positions, how an item is scored for a class, and the upgrade finder.
 * Item data is Worth the Camp's (adapted from the community wiki, CC BY-SA 4.0); NPC levels come from their NPC list.
 *
 * Scoring: an item's score is the sum of its stats, each times the class's weight for that stat, plus its
 * damage / delay ratio times a weapon weight (in the weapon slots). The default weights per class are Castanova's
 * Arcane Ledger's (https://arcaneledger.tools/), editable per character. An upgrade's gain is its score minus the
 * score of what it replaces.
 */

export type SlotType =
  | 'primary'
  | 'offhand'
  | 'ranged'
  | 'ammo'
  | 'head'
  | 'face'
  | 'ear'
  | 'neck'
  | 'shoulders'
  | 'back'
  | 'chest'
  | 'shirt'
  | 'wrist'
  | 'hands'
  | 'finger'
  | 'waist'
  | 'legs'
  | 'feet';

export type PositionId =
  | 'primary'
  | 'offhand'
  | 'ranged'
  | 'ammo'
  | 'head'
  | 'face'
  | 'ear1'
  | 'ear2'
  | 'neck'
  | 'shoulders'
  | 'back'
  | 'chest'
  | 'shirt'
  | 'wrist1'
  | 'wrist2'
  | 'hands'
  | 'finger1'
  | 'finger2'
  | 'waist'
  | 'legs'
  | 'feet';

export interface Position {
  id: PositionId;
  slot: SlotType;
  label: string;
}

/** Every equipment position: ears, wrists and fingers come in pairs. */
export const POSITIONS: readonly Position[] = [
  { id: 'head', slot: 'head', label: 'Head' },
  { id: 'face', slot: 'face', label: 'Face' },
  { id: 'ear1', slot: 'ear', label: 'Ear' },
  { id: 'ear2', slot: 'ear', label: 'Ear' },
  { id: 'neck', slot: 'neck', label: 'Neck' },
  { id: 'shoulders', slot: 'shoulders', label: 'Shoulders' },
  { id: 'back', slot: 'back', label: 'Back' },
  { id: 'chest', slot: 'chest', label: 'Chest' },
  { id: 'shirt', slot: 'shirt', label: 'Shirt' },
  { id: 'wrist1', slot: 'wrist', label: 'Wrist' },
  { id: 'wrist2', slot: 'wrist', label: 'Wrist' },
  { id: 'hands', slot: 'hands', label: 'Hands' },
  { id: 'finger1', slot: 'finger', label: 'Finger' },
  { id: 'finger2', slot: 'finger', label: 'Finger' },
  { id: 'waist', slot: 'waist', label: 'Waist' },
  { id: 'legs', slot: 'legs', label: 'Legs' },
  { id: 'feet', slot: 'feet', label: 'Feet' },
  { id: 'primary', slot: 'primary', label: 'Primary' },
  { id: 'offhand', slot: 'offhand', label: 'Offhand' },
  { id: 'ranged', slot: 'ranged', label: 'Ranged' },
  { id: 'ammo', slot: 'ammo', label: 'Ammo' },
];

export const POSITION_BY_ID = new Map(POSITIONS.map((p) => [p.id, p]));

/** Slot types in the order the finder's slot list shows them. */
export const SLOT_TYPES: readonly SlotType[] = [...new Set(POSITIONS.map((p) => p.slot))];

export const SLOT_LABEL: Record<SlotType, string> = Object.fromEntries(POSITIONS.map((p) => [p.slot, p.label])) as Record<SlotType, string>;

export type Stat =
  | 'ac'
  | 'hp'
  | 'mana'
  | 'str'
  | 'sta'
  | 'agi'
  | 'dex'
  | 'int'
  | 'wis'
  | 'cha'
  | 'sv_magic'
  | 'sv_fire'
  | 'sv_cold'
  | 'sv_poison'
  | 'sv_disease'
  | 'sv_corruption'
  | 'sv_electric'
  | 'sv_holy';

/** Stats in display order. */
export const STATS: readonly Stat[] = [
  'ac',
  'hp',
  'mana',
  'str',
  'sta',
  'agi',
  'dex',
  'int',
  'wis',
  'cha',
  'sv_magic',
  'sv_fire',
  'sv_cold',
  'sv_poison',
  'sv_disease',
  'sv_corruption',
  'sv_electric',
  'sv_holy',
];

export const STAT_LABEL: Record<Stat, string> = {
  ac: 'AC',
  hp: 'HP',
  mana: 'Mana',
  str: 'STR',
  sta: 'STA',
  agi: 'AGI',
  dex: 'DEX',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
  sv_magic: 'MR',
  sv_fire: 'FR',
  sv_cold: 'CR',
  sv_poison: 'PR',
  sv_disease: 'DR',
  sv_corruption: 'CoR',
  sv_electric: 'ER',
  sv_holy: 'HR',
};

/** What each weight means, for the weights editor. */
export type WeightKey = Stat | 'weapon' | 'ranged';
export const WEIGHT_KEYS: readonly WeightKey[] = [...STATS, 'weapon', 'ranged'];
export const WEIGHT_LABEL: Record<WeightKey, string> = { ...STAT_LABEL, weapon: 'Weapon ratio', ranged: 'Ranged ratio' };
export type Weights = Record<WeightKey, number>;

/** An item as the planner keeps it (trimmed from Worth the Camp's items.json: wearable items only). */
export interface GearItem {
  id: number;
  name: string;
  slots: SlotType[];
  stats: Partial<Record<Stat, number>>;
  /** Weapon damage and delay (0 when it isn't a weapon). */
  dmg: number;
  delay: number;
  /** Two-handed: takes the primary and offhand together. */
  twoHand: boolean;
  /** Classes that can wear it (Worth the Camp's names); empty = every class. */
  classes: string[];
  /** Race codes (Hum, Dgn, …) that can wear it; empty = every race. */
  races: string[];
  flags: string[];
  /** The tradeskill(s) that make it, e.g. "Smithing (trivial 20)"; null if it can't be crafted. */
  crafted: string | null;
  drops: GearDrop[];
  /** Icon file name on Worth the Camp (game art), when it has a real one. */
  icon: string | null;
  /** An item of your own (🛠 My items): its icon's full URL and where it comes from, in your words. */
  custom?: { iconUrl: string | null; source: string };
}

/** An NPC an item drops from. */
export interface GearDrop {
  /** Worth the Camp NPC id (the slug in its /npc/ link). */
  npc: string;
  name: string;
  zone: string;
  /** Observed drop rate (0–1) and kills seen, from MnMdb via Worth the Camp, when known. */
  rate: number | null;
  kills: number | null;
}

/** NPC levels by id (raid bosses flagged). */
export interface NpcLevel {
  lo: number;
  hi: number;
  raid: boolean;
}

/** What you're wearing: an item id and name per position (the name is kept in case the item drops out of the data). */
export type GearSet = Partial<Record<PositionId, { id: number; name: string }>>;

const ART = 'https://images.squarespace-cdn.com/content/v1/603cb2299959d83fcdc26265/';

export interface Race {
  /** The code Worth the Camp's item data uses in race limits ("Dgn"). */
  code: string;
  name: string;
  /** Male and female portraits from the official races page (https://monstersandmemories.com/races). */
  art: { m: string; f: string };
}

/**
 * The playable races (as on the official races page). Codes are Worth the Camp's; Varánai's isn't known (no item in
 * their data is limited to it yet), so "Var" stands in.
 */
export const RACES: readonly Race[] = [
  { code: 'Def', name: 'Deep Elf', art: { m: 'd77d66aa-b899-45c0-88dc-592d98aa9765/DeepElfM.png', f: '61139019-765d-4b92-a207-bbd158ba96d7/DeepElfF.png' } },
  { code: 'Ddf', name: 'Deep Dwarf', art: { m: '435daf55-fba4-48e1-99aa-9df4ffe9b793/DeepDwarfM.png', f: 'd373a319-1699-40fe-bf55-c2ea7c73af61/DeepDwarfF.png' } },
  { code: 'Dgn', name: 'Deep Gnome', art: { m: '2fd5e7fa-6452-4167-a415-1cc9c98ecf4c/DeepGnomeM.png', f: '61096f04-1fb2-4f02-a3be-1e3071f34829/DeepGnomeF.png' } },
  { code: 'Dwf', name: 'Dwarf', art: { m: 'a106d762-d76c-49bc-bd33-99ef2a0cd319/DwarfM.png', f: '436c3cf9-70b7-402f-b75e-4d298ba30e2a/DwarfF.png' } },
  { code: 'Gnm', name: 'Gnome', art: { m: '53b8ca04-6956-486d-af76-a13c73052fc4/GnomeM.png', f: '07a7c2ab-48b9-4295-8c62-5d6edaa36664/GnomeF.png' } },
  { code: 'Gob', name: 'Goblin', art: { m: '75423d34-c758-4312-81e9-9ff3b5bebe3c/GoblnM.png', f: 'ff2405f8-0527-4482-b2eb-42840b2a104d/GoblinF.png' } },
  { code: 'Hfl', name: 'Halfling', art: { m: 'faff2ded-1d9c-4ed1-adba-8d37b30318d8/HalflingM.png', f: '70aca49f-8673-4fe7-a84b-18d3b265000b/HalflingF.png' } },
  { code: 'Hie', name: 'High Elf', art: { m: '1060650e-e2f5-4007-aa3d-320606930219/HighElfM.png', f: '01520d92-b3a7-4675-814a-d283c41b87e1/HighElfF.png' } },
  { code: 'Hum', name: 'Human', art: { m: '7b71bd9e-fe93-4f3f-a14b-3c48604c005d/HumanM.png', f: '960dfbb6-2cc0-4bc9-90f8-7c18cf59ed65/HumanF.png' } },
  { code: 'Ogr', name: 'Ogre', art: { m: '16865c97-2f4d-4bf6-bf03-6482b62f17b9/OgreM.png', f: '6b7951e5-fad8-4ec6-88cb-767e298da317/OgreF.png' } },
  { code: 'Trl', name: 'Troll', art: { m: 'e63cdba9-c37e-4145-9b91-fd14703406f9/TrollM.png', f: 'ed3cef77-b3d5-4ceb-abc1-b3ff81e12fcc/TrollF.png' } },
  { code: 'Var', name: 'Varánai', art: { m: '58144ae2-0a41-4951-9556-edb5d42a1244/LizardM.png', f: '26d1f4cd-ab0d-4095-9422-2c81c943ec61/LizardF.png' } },
  { code: 'Elf', name: 'Wood Elf', art: { m: 'e89ee048-d760-4f9d-abb4-4f5941a05119/WoodElfM.png', f: '65a5054d-0cbf-42c5-b0a1-9571c858d1a5/WoodElfF.png' } },
];

export function raceName(code: string): string {
  return RACES.find((r) => r.code === code)?.name ?? code;
}

/** A race's portrait (male or female), or null for no race. */
export function raceArt(code: string | null, look: 'm' | 'f'): string | null {
  const r = RACES.find((x) => x.code === code);
  return r ? ART + r.art[look] : null;
}

// ---------- weights ----------

/**
 * Default stat weights per class, from Castanova's Arcane Ledger (https://arcaneledger.tools/data/classes.json), in
 * Worth the Camp's class spelling. "Ratio" is per point of damage ÷ delay × 100. Stats a class doesn't list count 0.
 * (Arcane Ledger's Bard instrument weights are left out: Worth the Camp's items don't carry instrument bonuses.)
 */
const CLASS_WEIGHTS: Record<string, Partial<Record<Stat | 'Ratio', number>>> = {
  Archer: { dex: 1, agi: 0.6, str: 0.4, sta: 0.4, hp: 0.1, Ratio: 1 },
  Bard: { cha: 0.7, dex: 0.5, str: 0.5, sta: 0.5, hp: 0.1, mana: 0.05, Ratio: 0.7 },
  Beastmaster: { str: 0.7, dex: 0.7, agi: 0.5, sta: 0.5, wis: 0.3, hp: 0.1, Ratio: 1 },
  Cleric: { wis: 1, mana: 0.1, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
  Druid: { wis: 1, mana: 0.1, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
  Elementalist: { int: 1, mana: 0.1, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
  Enchanter: { int: 1, mana: 0.1, cha: 0.3, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
  Fighter: { sta: 1, ac: 0.4, hp: 0.1, str: 0.7, agi: 0.5, dex: 0.3, Ratio: 0.7 },
  Inquisitor: { sta: 1, ac: 0.3, hp: 0.1, str: 0.5, int: 0.5, mana: 0.05, Ratio: 0.5 },
  Monk: { str: 0.8, dex: 0.7, agi: 0.7, sta: 0.5, hp: 0.1, ac: 0.1, Ratio: 1 },
  Necromancer: { int: 1, mana: 0.1, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
  Paladin: { sta: 1, ac: 0.3, hp: 0.1, str: 0.5, wis: 0.5, mana: 0.05, Ratio: 0.5 },
  Ranger: { str: 0.7, dex: 0.7, agi: 0.5, sta: 0.5, wis: 0.3, hp: 0.1, Ratio: 1 },
  Rogue: { dex: 0.8, str: 0.8, agi: 0.5, sta: 0.4, hp: 0.1, Ratio: 1.2 },
  Shadowknight: { sta: 1, ac: 0.3, hp: 0.1, str: 0.5, int: 0.5, mana: 0.05, Ratio: 0.5 },
  Shaman: { wis: 1, mana: 0.1, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
  Spellblade: { str: 0.7, dex: 0.5, int: 0.5, sta: 0.5, hp: 0.1, mana: 0.05, Ratio: 1 },
  Wizard: { int: 1, mana: 0.1, sta: 0.2, dex: 0.15, hp: 0.05, ac: 0.05 },
};

/** The classes, in Worth the Camp's spelling. */
export const GEAR_CLASSES = Object.keys(CLASS_WEIGHTS);

/** "Shadow Knight", "shadow-knight" or "shadowknight" → "Shadowknight" (null if it isn't a class). */
export function gearClassName(name: string | null | undefined): string | null {
  const key = (name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return GEAR_CLASSES.find((c) => c.toLowerCase() === key) ?? null;
}

/**
 * A class's default weights (Arcane Ledger's). Their weapon Ratio is per point of damage ÷ delay × 100, so it's
 * scaled by 100 here; it counts the same for melee and ranged weapons, as there.
 */
export function defaultWeights(cls: string | null): Weights {
  const table = (cls && CLASS_WEIGHTS[cls]) || {};
  const w = {} as Weights;
  for (const s of STATS) w[s] = table[s] ?? 0;
  const ratio = (table.Ratio ?? 0) * 100;
  w.weapon = ratio;
  w.ranged = ratio;
  return w;
}

/** A character's weights: the class defaults with any you've changed. */
export function weightsFor(cls: string | null, overrides: Partial<Record<WeightKey, number>> | null | undefined): Weights {
  return { ...defaultWeights(cls), ...(overrides ?? {}) };
}

// ---------- scoring ----------

/** How much an item is worth to you in a slot (higher is better). */
export function itemScore(item: GearItem, w: Weights, slot: SlotType): number {
  let s = 0;
  for (const k of STATS) {
    const v = item.stats[k];
    if (v) s += v * w[k];
  }
  if (item.dmg > 0 && item.delay > 0) {
    const ratio = item.dmg / item.delay;
    if (slot === 'primary' || slot === 'offhand') s += ratio * w.weapon;
    else if (slot === 'ranged') s += ratio * w.ranged;
  }
  return round2(s);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function canWear(item: GearItem, cls: string | null, race: string | null): boolean {
  if (cls && item.classes.length && !item.classes.includes(cls)) return false;
  if (race && item.races.length && !item.races.includes(race)) return false;
  return true;
}

/** A stat that goes up or down. */
export interface StatChange {
  label: string;
  delta: number;
}

/** How each stat changes going from `from` (one or more items, or none) to `to`. */
export function statChanges(to: GearItem, from: readonly GearItem[]): StatChange[] {
  const out: StatChange[] = [];
  for (const k of STATS) {
    const d = (to.stats[k] ?? 0) - from.reduce((n, i) => n + (i.stats[k] ?? 0), 0);
    if (d) out.push({ label: STAT_LABEL[k], delta: Math.round(d * 10) / 10 });
  }
  return out;
}

/** One line of an item's stats: "6/23 · AC 5 · HP 10 · WIS 2" (weapon damage / delay first). */
export function itemSummary(item: GearItem): string {
  const parts: string[] = [];
  if (item.dmg > 0 && item.delay > 0) parts.push(`${item.dmg}/${item.delay}${item.twoHand ? ' 2H' : ''}`);
  for (const k of STATS) {
    const v = item.stats[k];
    if (v) parts.push(`${STAT_LABEL[k]} ${v > 0 ? v : `−${-v}`}`);
  }
  return parts.join(' · ') || 'No stats';
}

/** Everything worn added up. */
export function totals(items: readonly GearItem[]): StatChange[] {
  const out: StatChange[] = [];
  for (const k of STATS) {
    const v = items.reduce((n, i) => n + (i.stats[k] ?? 0), 0);
    if (v) out.push({ label: STAT_LABEL[k], delta: Math.round(v * 10) / 10 });
  }
  return out;
}

// ---------- sources ----------

export type SourceKind = 'drop' | 'crafted' | 'quest';

/** A drop with its NPC's level, when known. */
export interface DropInfo extends GearDrop {
  lo: number | null;
  hi: number | null;
  raid: boolean;
}

export function dropInfo(d: GearDrop, npcs: ReadonlyMap<string, NpcLevel>): DropInfo {
  const n = npcs.get(d.npc);
  return { ...d, lo: n?.lo ?? null, hi: n?.hi ?? null, raid: n?.raid ?? false };
}

/** No known drop and not craftable: a quest reward, starting gear, a vendor item or simply unknown. */
export function isQuestOrOther(item: GearItem): boolean {
  return !item.drops.length && !item.crafted;
}

// ---------- the finder ----------

export interface FinderOptions {
  /** Only this slot type; null = every slot. */
  slot: SlotType | null;
  /** Only drops from mobs up to this level; null = any level. */
  maxMob: number | null;
  drops: boolean;
  crafted: boolean;
  quest: boolean;
  /** Include drops from raid bosses. */
  raid: boolean;
}

export interface Upgrade {
  item: GearItem;
  /** Where it would go (for pairs, the weaker of the two). */
  position: PositionId;
  score: number;
  gain: number;
  /** What it replaces (both hands for a two-hander). */
  replaces: GearItem[];
  changes: StatChange[];
  /** How you'd get it: the easiest matching drop (lowest-level mob first), crafting, or quest / other. */
  how: { kind: 'drop'; drop: DropInfo; more: number } | { kind: 'crafted'; text: string } | { kind: 'quest' } | { kind: 'mine'; text: string };
}

export interface Wearer {
  cls: string | null;
  race: string | null;
  gear: GearSet;
}

/**
 * Upgrades for a character: every item they can wear that the filters allow, at its best position, by gain.
 * Items already worn are skipped (most good gear is LORE / UNIQUE anyway). A two-hander is compared with the
 * primary and offhand together; offhand items are skipped while you hold a two-hander.
 */
export function findUpgrades(
  items: readonly GearItem[],
  byId: ReadonlyMap<number, GearItem>,
  npcs: ReadonlyMap<string, NpcLevel>,
  who: Wearer,
  w: Weights,
  opts: FinderOptions,
  onlyUpgrades = true,
): Upgrade[] {
  const worn = new Map<PositionId, GearItem>();
  for (const p of POSITIONS) {
    const g = who.gear[p.id];
    const it = g ? byId.get(g.id) : undefined;
    if (it) worn.set(p.id, it);
  }
  const wornIds = new Set([...worn.values()].map((i) => i.id));
  const twoHanded = worn.get('primary')?.twoHand ?? false;
  const scoreAt = (pos: PositionId) => {
    const it = worn.get(pos);
    return it ? itemScore(it, w, POSITION_BY_ID.get(pos)!.slot) : 0;
  };

  const out: Upgrade[] = [];
  for (const item of items) {
    if (wornIds.has(item.id) || !canWear(item, who.cls, who.race)) continue;
    const how = howToGet(item, npcs, opts);
    if (!how) continue;
    let best: Upgrade | null = null;
    for (const slot of item.slots) {
      if (opts.slot && slot !== opts.slot) continue;
      if (slot === 'offhand' && twoHanded) continue;
      if (item.twoHand && slot !== 'primary') continue;
      const spots = POSITIONS.filter((p) => p.slot === slot).map((p) => p.id);
      const pos = spots.reduce((a, b) => (scoreAt(b) < scoreAt(a) ? b : a));
      const replacesIds: PositionId[] = item.twoHand ? ['primary', 'offhand'] : [pos];
      const replaces = replacesIds.map((p) => worn.get(p)).filter((i): i is GearItem => !!i);
      const score = itemScore(item, w, slot);
      const gain = round2(score - replacesIds.reduce((n, p) => n + scoreAt(p), 0));
      if (!best || gain > best.gain) best = { item, position: pos, score, gain, replaces, changes: statChanges(item, replaces), how };
    }
    if (best && (!onlyUpgrades || best.gain > 0)) out.push(best);
  }
  return out.sort((a, b) => b.gain - a.gain || a.item.name.localeCompare(b.item.name));
}

/** How the filters let you get an item, or null if they rule it out. */
function howToGet(item: GearItem, npcs: ReadonlyMap<string, NpcLevel>, opts: FinderOptions): Upgrade['how'] | null {
  // Your own items always count (Recommended leaves them out: it's drops only).
  if (item.custom) return { kind: 'mine', text: item.custom.source };
  if (opts.drops && item.drops.length) {
    const ok = item.drops
      .map((d) => dropInfo(d, npcs))
      .filter((d) => (opts.raid || !d.raid) && (opts.maxMob === null || (d.lo !== null && d.lo <= opts.maxMob)))
      .sort((a, b) => (a.hi ?? 999) - (b.hi ?? 999) || a.name.localeCompare(b.name));
    if (ok.length) return { kind: 'drop', drop: ok[0], more: ok.length - 1 };
  }
  if (opts.crafted && item.crafted) return { kind: 'crafted', text: item.crafted };
  if (opts.quest && isQuestOrOther(item)) return { kind: 'quest' };
  return null;
}

/** Mobs this far above you still count as "around your level" for recommendations (a group can take them). */
export const RECOMMEND_ABOVE = 3;
/** How many recommendations to show. */
export const RECOMMEND_COUNT = 12;

/**
 * The biggest upgrades you can get around your level: drops from non-raid mobs up to RECOMMEND_ABOVE levels above
 * you, the best one for each position, biggest gain first.
 */
export function recommend(
  items: readonly GearItem[],
  byId: ReadonlyMap<number, GearItem>,
  npcs: ReadonlyMap<string, NpcLevel>,
  who: Wearer,
  w: Weights,
  level: number,
): Upgrade[] {
  const all = findUpgrades(items.filter((i) => !i.custom), byId, npcs, who, w, {
    slot: null,
    maxMob: level + RECOMMEND_ABOVE,
    drops: true,
    crafted: false,
    quest: false,
    raid: false,
  });
  // What's worn now, scored, so a second ring can go on the other finger with its own gain.
  const wornAt = (pos: PositionId) => {
    const g = who.gear[pos];
    return g ? byId.get(g.id) : undefined;
  };
  const scoreAt = (pos: PositionId) => {
    const it = wornAt(pos);
    return it ? itemScore(it, w, POSITION_BY_ID.get(pos)!.slot) : 0;
  };
  const taken = new Set<PositionId>();
  let twoHanderPicked = false;
  const out: Upgrade[] = [];
  for (const u of all) {
    if (u.item.twoHand) {
      if (taken.has('primary') || taken.has('offhand')) continue;
      taken.add('primary').add('offhand');
      twoHanderPicked = true;
      out.push(u);
      continue;
    }
    const slot = POSITION_BY_ID.get(u.position)!.slot;
    if (slot === 'offhand' && twoHanderPicked) continue;
    const pos = POSITIONS.filter((p) => p.slot === slot && !taken.has(p.id))
      .map((p) => p.id)
      .sort((a, b) => scoreAt(a) - scoreAt(b))[0];
    if (!pos) continue;
    const gain = round2(u.score - scoreAt(pos));
    if (gain <= 0) continue;
    taken.add(pos);
    if (slot === 'primary') taken.add('primary');
    const replaces = [wornAt(pos)].filter((i): i is GearItem => !!i);
    out.push(pos === u.position ? u : { ...u, position: pos, gain, replaces, changes: statChanges(u.item, replaces) });
  }
  return out.sort((a, b) => b.gain - a.gain || a.item.name.localeCompare(b.item.name)).slice(0, RECOMMEND_COUNT);
}

// ---------- links ----------

/** An item's icon (Monsters & Memories art, served by Worth the Camp), or null. */
export function itemIconUrl(item: Pick<GearItem, 'icon' | 'custom'> | null | undefined): string | null {
  if (item?.custom) return item.custom.iconUrl;
  return item?.icon ? `https://worththecamp.com/icons/${encodeURIComponent(item.icon)}` : null;
}

/** An item of your own, as a Gear Planner item. */
export function customToGear(c: CustomItem): GearItem {
  return {
    id: c.id,
    name: c.name,
    slots: c.slots.filter((s): s is SlotType => (SLOT_TYPES as readonly string[]).includes(s)),
    stats: Object.fromEntries(STATS.filter((k) => c.stats[k]).map((k) => [k, c.stats[k]!])) as Partial<Record<Stat, number>>,
    dmg: c.dmg,
    delay: c.delay,
    twoHand: c.twoHand,
    classes: [],
    races: [],
    flags: [],
    crafted: null,
    drops: [],
    icon: null,
    custom: { iconUrl: c.icon, source: c.source },
  };
}

export function wtcItemUrl(item: Pick<GearItem, 'id' | 'name' | 'custom'>): string | null {
  if (item.custom) return null; // your own item has no page
  const slug = item.name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://worththecamp.com/item/${item.id}-${slug}`;
}
