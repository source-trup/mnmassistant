import { Injectable, computed, signal } from '@angular/core';

/** MnMdb (https://mnm-db.com): a community economy database. Its data files are public JSON served with CORS. */
export const MNMDB_URL = 'https://mnm-db.com/';
/** The server whose auction channel MnMdb records. */
export const MARKET_SERVER = 'Trem';

export interface Listing {
  intent: 'sell' | 'buy';
  /** Price per single item, in copper. */
  unit: number;
  /** Price as listed (per stack when perStack), in copper, and as written ("6s"). */
  price: number;
  priceStr: string;
  stack: number | null;
  perStack: boolean;
  player: string;
  /** Last time the listing was seen, epoch ms. */
  seen: number;
  /** How many times the listing was seen. */
  count: number;
}

export interface ItemInfo {
  icon: string | null;
  flags: string[];
  slot: string | null;
  ac: number | null;
  dmg: number | null;
  delay: number | null;
  stats: Record<string, number>;
  hp: number | null;
  mana: number | null;
  haste: number | null;
  resists: Record<string, number>;
  weight: number | null;
  classes: string | null;
  races: string | null;
  tradeskills: string[];
  zones: string[];
  from: string[];
  effect: string | null;
}

export interface PriceItem {
  name: string;
  key: string;
  /** MnMdb item id, for its page (#/item/<id>). */
  id: string;
  info: ItemInfo | null;
  listings: Listing[];
  /** What NPC vendors paid players for it: price in copper and how many times seen. */
  vendor: { copper: number; count: number }[];
  droppedBy: { mob: string; rate: number; corpses: number }[];
  harvested: number;
  zones: string[];
  /** NPC merchants that sell it. */
  soldBy: { name: string; zone: string }[];
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** "1p 4g 5s 20c" from copper (100c = 1s, 100s = 1g, 100g = 1p). */
export function coin(copper: number | null | undefined): string {
  if (copper == null || !Number.isFinite(copper)) return '–';
  let c = Math.round(copper);
  if (c === 0) return '0c';
  const parts: string[] = [];
  for (const [unit, size] of [['p', 1_000_000], ['g', 10_000], ['s', 100]] as const) {
    if (c >= size) {
      parts.push(`${Math.floor(c / size)}${unit}`);
      c %= size;
    }
  }
  if (c) parts.push(`${c}c`);
  // Big prices: the two largest units are plenty ("2g 35s", not "2g 35s 12c").
  return parts.slice(0, 2).join(' ');
}

/**
 * Loads MnMdb's market data straight from mnm-db.com when the Prices panel opens (nothing is copied into this app):
 * auctions.json (Trem auction-channel listings and item details), data-ea.json (vendor sale prices, drops and
 * harvests seen in Early Access) and vendors.json (which NPC merchants sell what).
 */
@Injectable({ providedIn: 'root' })
export class PriceService {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** When MnMdb last rebuilt its auction data (epoch ms). */
  readonly updatedAt = signal<number | null>(null);
  readonly items = signal<Map<string, PriceItem>>(new Map());

  /** Item names for search, most-listed first. */
  readonly names = computed(() =>
    [...this.items().values()]
      .sort((a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name))
      .map((i) => i.name),
  );

  async load(force = false): Promise<void> {
    if (this.status() === 'loading' || (this.status() === 'ready' && !force)) return;
    this.status.set('loading');
    try {
      const get = async (file: string) => {
        const res = await fetch(MNMDB_URL + file, { cache: force ? 'reload' : 'default' });
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        return res.json();
      };
      const [auctions, ea, vendors] = await Promise.all([get('auctions.json'), get('data-ea.json'), get('vendors.json')]);
      this.items.set(this.build(auctions, ea, vendors));
      this.updatedAt.set(Date.parse(auctions.generatedAt) || null);
      this.status.set('ready');
    } catch {
      this.status.set(this.items().size ? 'ready' : 'error');
    }
  }

  find(name: string): PriceItem | undefined {
    return this.items().get(name.trim().toLowerCase());
  }

  private build(auctions: any, ea: any, vendors: any): Map<string, PriceItem> {
    const map = new Map<string, PriceItem>();
    const entry = (name: string): PriceItem => {
      const key = name.trim().toLowerCase();
      let it = map.get(key);
      if (!it) {
        it = { name: name.trim(), key, id: slug(name), info: null, listings: [], vendor: [], droppedBy: [], harvested: 0, zones: [], soldBy: [] };
        map.set(key, it);
      }
      return it;
    };

    for (const l of auctions?.listings ?? []) {
      if (l?.server !== MARKET_SERVER || !l.item || !(l.intent === 'sell' || l.intent === 'buy')) continue;
      const unit = Number(l.unit ?? l.price);
      if (!(unit > 0)) continue;
      entry(l.item).listings.push({
        intent: l.intent,
        unit,
        price: Number(l.price) || unit,
        priceStr: String(l.priceStr ?? ''),
        stack: Number(l.stack) || null,
        perStack: l.perStack === true,
        player: String(l.player ?? ''),
        seen: Date.parse(l.seen) || 0,
        count: Number(l.count) || 1,
      });
    }

    for (const [, s] of Object.entries<any>(auctions?.stats ?? {})) {
      if (!s?.name) continue;
      entry(s.name).info = {
        icon: typeof s.icon === 'string' ? s.icon : null,
        flags: Array.isArray(s.flags) ? s.flags : [],
        slot: s.slot ?? null,
        ac: s.ac ?? null,
        dmg: s.dmg ?? null,
        delay: s.delay ?? null,
        stats: s.stats ?? {},
        hp: s.hp ?? null,
        mana: s.mana ?? null,
        haste: s.haste ?? null,
        resists: s.resists ?? {},
        weight: s.weight ?? null,
        classes: s.class ?? null,
        races: s.race ?? null,
        tradeskills: Array.isArray(s.tradeskills) ? s.tradeskills : [],
        zones: Array.isArray(s.zones) ? s.zones : [],
        from: Array.isArray(s.from) ? s.from : [],
        effect: s.effect ?? null,
      };
    }

    for (const i of ea?.items ?? []) {
      if (!i?.name) continue;
      const it = entry(i.name);
      if (typeof i.id === 'string') it.id = i.id;
      it.vendor = (i.prices ?? []).filter((p: any) => p?.copper > 0).map((p: any) => ({ copper: p.copper, count: p.count || 1 }));
      it.droppedBy = (i.droppedBy ?? [])
        .map((d: any) => ({ mob: d.mob, rate: Number(d.rate) || 0, corpses: Number(d.corpses) || 0 }))
        .sort((a: any, b: any) => b.rate - a.rate);
      it.harvested = Number(i.harvested) || 0;
      it.zones = Array.isArray(i.zones) ? i.zones : [];
    }

    for (const v of vendors?.vendors ?? []) {
      for (const name of v?.sells ?? []) {
        const it = map.get(String(name).toLowerCase());
        if (it) it.soldBy.push({ name: v.name, zone: v.zone ?? '' });
      }
    }
    // Only keep items there's something to say about.
    for (const [k, it] of map) {
      if (!it.listings.length && !it.vendor.length && !it.info) map.delete(k);
    }
    return map;
  }
}
