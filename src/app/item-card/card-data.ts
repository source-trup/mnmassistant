import { GEAR_CLASSES, GearItem, NpcLevel, RACES, SLOT_LABEL, STATS, STAT_LABEL, Stat, SlotType, dropInfo, itemIconUrl } from '../gear/gear';
import { PriceItem, itemSources } from '../prices/price.service';

/**
 * What an item card shows, whichever source the item came from: Worth the Camp's items (Gear Planner) or MnMdb's
 * item details (Wishlist, Price Checker).
 */
export interface CardData {
  name: string;
  /** Full URL of the icon, or null. */
  icon: string | null;
  flags: string[];
  slots: string;
  weapon: { dmg: number; delay: number; ratio: string; note: string } | null;
  /** AC, HP and Mana. */
  headline: StatLine[];
  attributes: StatLine[];
  resists: StatLine[];
  /** Haste, regen, weight and the like. */
  extras: string[];
  effect: string | null;
  classes: string;
  races: string;
  drops: CardDrop[];
  moreDrops: number;
  /** Zones it comes from, when there's no drop list. */
  zones: string[];
  crafted: string | null;
  /** Where it comes from in your words (your own items). */
  note: string;
  /** Where the details come from, for the card's footer. */
  source: string;
  /** Nothing is known about it: the card just says so. */
  missing?: boolean;
}

export interface StatLine {
  label: string;
  value: number;
  text: string;
}

export interface CardDrop {
  key: string;
  name: string;
  levels: string;
  zone: string;
  raid: boolean;
  rate: string;
}

/** Drops listed on a card; the rest are counted. */
const DROPS_SHOWN = 3;

function line(label: string, value: number, plain = false): StatLine {
  return { label, value, text: value > 0 ? (plain ? `${value}` : `+${value}`) : `−${-value}` };
}

function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

/** "All", a short list, or "All except …" when that's shorter. */
function classList(list: string[]): string {
  if (!list.length || list.length >= GEAR_CLASSES.length) return 'All';
  const missing = GEAR_CLASSES.filter((c) => !list.includes(c));
  return missing.length < list.length ? `All except ${missing.join(', ')}` : list.join(', ');
}

function raceList(codes: string[]): string {
  if (!codes.length) return 'All';
  return codes.map((c) => RACES.find((r) => r.code.toLowerCase() === c.toLowerCase())?.name ?? c).join(', ');
}

// ---------- Worth the Camp (Gear Planner) ----------

const HEADLINE: Stat[] = ['ac', 'hp', 'mana'];
const isResist = (s: Stat) => s.startsWith('sv_');

export function cardFromGear(item: GearItem, npcs: ReadonlyMap<string, NpcLevel>): CardData {
  const pick = (test: (s: Stat) => boolean) =>
    STATS.filter((s) => test(s) && item.stats[s]).map((s) => line(STAT_LABEL[s], item.stats[s]!, s === 'ac'));
  const drops = item.drops.map((d) => dropInfo(d, npcs)).sort((a, b) => (a.lo ?? 999) - (b.lo ?? 999) || a.name.localeCompare(b.name));
  return {
    name: item.name,
    icon: itemIconUrl(item),
    flags: item.flags.map((f) => f.toUpperCase()),
    slots: [...new Set(item.slots.map((s) => SLOT_LABEL[s] ?? s))].join(', '),
    weapon:
      item.dmg > 0 && item.delay > 0
        ? { dmg: item.dmg, delay: item.delay, ratio: (item.dmg / item.delay).toFixed(2), note: item.twoHand ? 'two-handed' : '' }
        : null,
    headline: pick((s) => HEADLINE.includes(s)),
    attributes: pick((s) => !HEADLINE.includes(s) && !isResist(s)),
    resists: pick(isResist),
    extras: [],
    effect: null,
    classes: classList(item.classes),
    races: raceList(item.races),
    drops: drops.slice(0, DROPS_SHOWN).map((d) => ({
      key: d.npc,
      name: d.name,
      levels: d.lo === null ? '' : d.hi !== null && d.hi !== d.lo ? `${d.lo}–${d.hi}` : `${d.lo}`,
      zone: d.zone,
      raid: d.raid,
      rate: d.rate !== null ? pct(d.rate) : '',
    })),
    moreDrops: Math.max(0, drops.length - DROPS_SHOWN),
    zones: [],
    crafted: item.crafted,
    note: item.custom?.source ?? '',
    source: item.custom ? 'your own item' : 'Worth the Camp',
  };
}

/** A card for a name nothing is known about. */
export function cardMissing(name: string): CardData {
  return {
    name,
    icon: null,
    flags: [],
    slots: '',
    weapon: null,
    headline: [],
    attributes: [],
    resists: [],
    extras: [],
    effect: null,
    classes: '',
    races: '',
    drops: [],
    moreDrops: 0,
    zones: [],
    crafted: null,
    note: '',
    source: '',
    missing: true,
  };
}

// ---------- MnMdb (Wishlist, Price Checker) ----------

/** MnMdb's class abbreviations. */
const MNMDB_CLASS: Record<string, string> = {
  ARC: 'Archer',
  BRD: 'Bard',
  BST: 'Beastmaster',
  CLR: 'Cleric',
  DRU: 'Druid',
  ELE: 'Elementalist',
  ENC: 'Enchanter',
  FTR: 'Fighter',
  INQ: 'Inquisitor',
  MNK: 'Monk',
  NEC: 'Necromancer',
  PAL: 'Paladin',
  RNG: 'Ranger',
  ROG: 'Rogue',
  SHD: 'Shadowknight',
  SHM: 'Shaman',
  SPB: 'Spellblade',
  WIZ: 'Wizard',
};

/** MnMdb's slot words, in the planner's names. */
const MNMDB_SLOT: Record<string, SlotType> = { primary: 'primary', secondary: 'offhand', range: 'ranged', ammo: 'ammo' };

const ATTR_ORDER = ['STR', 'STA', 'AGI', 'DEX', 'INT', 'WIS', 'CHA'];

function codes(text: string | null): string[] {
  const t = (text ?? '').trim();
  return !t || t.toUpperCase() === 'ALL' ? [] : t.split(/\s+/);
}

function title(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** A card for an item in MnMdb's data, or null when MnMdb has no details for it (only prices). */
export function cardFromMnmdb(it: PriceItem): CardData | null {
  const i = it.info;
  if (!i) return null;
  const slots = (i.slot ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const s = MNMDB_SLOT[w.toLowerCase()] ?? (w.toLowerCase() as SlotType);
      return SLOT_LABEL[s] ?? title(w);
    });
  const attrs = Object.entries(i.stats)
    .filter(([, v]) => v)
    .sort(([a], [b]) => (ATTR_ORDER.indexOf(a) + 1 || 99) - (ATTR_ORDER.indexOf(b) + 1 || 99));
  const extras: string[] = [];
  if (i.haste) extras.push(`Haste ${i.haste}%`);
  if (i.hpRegen) extras.push(`HP regen +${i.hpRegen}`);
  if (i.manaRegen) extras.push(`Mana regen +${i.manaRegen}`);
  if (i.weight !== null) extras.push(`Weight ${i.weight}`);
  const two = /2H/i.test(i.handed ?? '') || /2H/i.test(i.skill ?? '');
  const src = itemSources(it);
  return {
    name: it.name,
    icon: i.icon,
    flags: i.flags.map((f) => f.toUpperCase()),
    slots: [...new Set(slots)].join(', ') || 'Not worn',
    weapon:
      i.dmg && i.delay
        ? { dmg: i.dmg, delay: i.delay, ratio: (i.dmg / i.delay).toFixed(2), note: [i.skill ? title(i.skill) : '', two && !/2H/i.test(i.skill ?? '') ? 'two-handed' : ''].filter(Boolean).join(' · ') }
        : null,
    headline: [i.ac ? line('AC', i.ac, true) : null, i.hp ? line('HP', i.hp) : null, i.mana ? line('Mana', i.mana) : null].filter((x) => x !== null),
    attributes: attrs.map(([k, v]) => line(k, v)),
    resists: Object.entries(i.resists)
      .filter(([, v]) => v)
      .map(([k, v]) => line(k, v)),
    extras,
    effect: i.effect,
    classes: classList(codes(i.classes).map((c) => MNMDB_CLASS[c.toUpperCase()] ?? c)),
    races: raceList(codes(i.races)),
    drops: src.drops.slice(0, DROPS_SHOWN).map((d) => ({ key: d.mob, name: d.mob, levels: '', zone: '', raid: false, rate: d.rate !== null ? pct(d.rate) : '' })),
    moreDrops: Math.max(0, src.drops.length - DROPS_SHOWN),
    zones: src.zones,
    crafted: i.tradeskills.length ? i.tradeskills.join(', ') : null,
    note: '',
    source: 'MnMdb',
  };
}
