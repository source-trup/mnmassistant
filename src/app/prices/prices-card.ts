import { Component, computed, inject, input, signal } from '@angular/core';
import { atlasMapForZone } from '../map/atlas-maps';
import { PricePanel } from '../models';
import { formatAgo } from '../time';
import { TrackerStore } from '../tracker.store';
import { Listing, MARKET_SERVER, MNMDB_URL, PriceItem, PriceService, coin } from './price.service';

const DAY = 86_400_000;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Price checker: Trem auction asks and bids, NPC vendor value, and where an item comes from (data from MnMdb). */
@Component({
  selector: 'app-prices-card',
  templateUrl: './prices-card.html',
  styleUrl: './prices-card.scss',
})
export class PricesCard {
  readonly panel = input.required<PricePanel>();
  protected readonly store = inject(TrackerStore);
  protected readonly data = inject(PriceService);

  protected readonly SERVER = MARKET_SERVER;
  protected readonly MNMDB = MNMDB_URL;
  protected readonly coin = coin;

  constructor() {
    void this.data.load();
  }

  // ---------- search ----------

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);

  protected readonly suggestions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (q.length < 2) return [];
    const names = this.data.names();
    const starts = names.filter((n) => n.toLowerCase().startsWith(q));
    const contains = names.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 8).map((n) => {
      const it = this.data.find(n)!;
      return { name: n, asks: it.listings.filter((l) => l.intent === 'sell').length };
    });
  });

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.open.set(true);
  }

  protected onKey(e: KeyboardEvent, box: HTMLInputElement): void {
    const list = this.suggestions();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.open.set(true);
      if (list.length) this.active.set((this.active() + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
    } else if (e.key === 'Enter') {
      const pick = list[this.active()]?.name ?? this.data.find(box.value)?.name;
      if (pick) this.pick(pick, box);
    } else if (e.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected pick(name: string, box?: HTMLInputElement): void {
    this.store.updatePricePanel(this.store.pricePick(name));
    this.query.set('');
    this.open.set(false);
    if (box) box.value = '';
    this.listTab.set('sell');
  }

  protected closeSoon(): void {
    // Let a click on a suggestion land before the list closes.
    setTimeout(() => this.open.set(false), 150);
  }

  protected forgetRecent(name: string, e: Event): void {
    e.stopPropagation();
    this.store.updatePricePanel({ recent: this.panel().recent.filter((r) => r !== name) });
  }

  // ---------- the item ----------

  protected readonly item = computed<PriceItem | null>(() => {
    const name = this.panel().item;
    return name ? (this.data.find(name) ?? null) : null;
  });

  /** Listings inside the chosen window (counted back from MnMdb's last update). */
  private readonly inWindow = computed(() => {
    const it = this.item();
    if (!it) return { asks: [] as Listing[], bids: [] as Listing[] };
    const ref = this.data.updatedAt() ?? Date.now();
    const cutoff = ref - this.panel().days * DAY;
    const recent = it.listings.filter((l) => l.seen >= cutoff);
    return {
      asks: recent.filter((l) => l.intent === 'sell').sort((a, b) => a.unit - b.unit),
      bids: recent.filter((l) => l.intent === 'buy').sort((a, b) => b.unit - a.unit),
    };
  });

  protected readonly market = computed(() => {
    const { asks, bids } = this.inWindow();
    const au = asks.map((l) => l.unit);
    const bu = bids.map((l) => l.unit);
    const newest = Math.max(0, ...asks.map((l) => l.seen), ...bids.map((l) => l.seen));
    return {
      asks: asks.length,
      bids: bids.length,
      typical: median(au),
      low: au.length ? au[0] : null,
      high: au.length ? au[au.length - 1] : null,
      bidTypical: median(bu),
      bidHigh: bu.length ? bu[0] : null,
      newest: newest || null,
      /** Fewer than 3 listings: a rough guide only. */
      rough: asks.length > 0 && asks.length < 3,
    };
  });

  /** What NPC vendors pay: the most often seen price, and the range. */
  protected readonly vendor = computed(() => {
    const v = this.item()?.vendor ?? [];
    if (!v.length) return null;
    const common = [...v].sort((a, b) => b.count - a.count || b.copper - a.copper)[0];
    const prices = v.map((p) => p.copper);
    return { typical: common.copper, low: Math.min(...prices), high: Math.max(...prices), seen: v.reduce((n, p) => n + p.count, 0) };
  });

  /** Player market vs vendor: how many times more the typical ask is. */
  protected readonly versus = computed(() => {
    const t = this.market().typical;
    const v = this.vendor()?.typical;
    if (!t || !v) return null;
    const x = t / v;
    return x >= 1.5 ? `${x >= 10 ? Math.round(x) : x.toFixed(1)}× the vendor price` : x < 0.8 ? 'below the vendor price' : 'about the vendor price';
  });

  protected readonly listTab = signal<'sell' | 'buy'>('sell');
  protected readonly listings = computed(() => (this.listTab() === 'sell' ? this.inWindow().asks : this.inWindow().bids));

  /** The item's stat lines ("AC 22", "STR +2", "HP +10"…). */
  protected readonly statLines = computed(() => {
    const i = this.item()?.info;
    if (!i) return [];
    const out: string[] = [];
    if (i.slot) out.push(i.slot[0] + i.slot.slice(1).toLowerCase());
    if (i.ac) out.push(`AC ${i.ac}`);
    if (i.dmg && i.delay) out.push(`${i.dmg}/${i.delay} dmg/delay`);
    for (const [k, v] of Object.entries(i.stats)) out.push(`${k} ${v > 0 ? '+' : ''}${v}`);
    if (i.hp) out.push(`HP +${i.hp}`);
    if (i.mana) out.push(`Mana +${i.mana}`);
    if (i.haste) out.push(`Haste ${i.haste}%`);
    for (const [k, v] of Object.entries(i.resists)) out.push(`${k} resist +${v}`);
    return out;
  });

  protected readonly sources = computed(() => {
    const it = this.item();
    if (!it) return { drops: [] as { mob: string; rate: number | null }[], zones: [] as string[] };
    const drops = it.droppedBy.length
      ? it.droppedBy.slice(0, 6).map((d) => ({ mob: d.mob, rate: d.corpses >= 5 ? d.rate : null }))
      : (it.info?.from ?? []).slice(0, 6).map((mob) => ({ mob, rate: null }));
    // MnMdb's two files spell zones differently ("Fallen Pass" / "Fallenpass"): keep one of each, preferring the spaced one.
    const byKey = new Map<string, string>();
    for (const z of [...(it.info?.zones ?? []), ...it.zones]) {
      const key = z.toLowerCase().replace(/[^a-z]/g, '');
      const had = byKey.get(key);
      if (!had || (z.includes(' ') && !had.includes(' '))) byKey.set(key, z);
    }
    return { drops, zones: [...byKey.values()] };
  });

  // ---------- display helpers ----------

  protected ago(t: number | null): string {
    if (!t) return '';
    const ms = Date.now() - t;
    return ms < 60_000 ? 'just now' : `${formatAgo(ms)} ago`;
  }

  protected listed(l: Listing): string {
    return l.perStack && l.stack ? `${coin(l.price)} / ${l.stack}` : '';
  }

  protected setDays(days: 7 | 30): void {
    this.store.updatePricePanel({ days });
  }

  protected mapFor(zone: string): string | null {
    return atlasMapForZone(zone)?.id ?? null;
  }

  protected showMap(id: string): void {
    this.store.showMap({ map: id, level: null, find: null });
  }

  protected itemUrl(it: PriceItem): string {
    return `${MNMDB_URL}#/item/${encodeURIComponent(it.id)}`;
  }
}
