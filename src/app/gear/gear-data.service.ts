import { Injectable, computed, inject, signal } from '@angular/core';
import { cacheDelete, cacheGet, cacheSet } from '../idb-cache';
import { WorthTheCampService } from '../leveling/worth-the-camp.service';
import { GearItem, NpcLevel } from './gear';
import { trimItems } from './gear-trim';

const ITEMS_URL = 'https://worththecamp.com/api/v1/items.json';
/** In IndexedDB (see idb-cache): over a megabyte, too big to share localStorage with the board. */
/** v2 adds item icons; a v1 copy is simply never read again. */
const CACHE_KEY = 'wtc-items.v2';
const OLD_CACHE_KEYS = ['wtc-items.v1'];
/** Worth the Camp asks for at most hourly; daily is plenty. */
const MAX_AGE_MS = 24 * 3_600_000;

interface ItemCache {
  items: GearItem[];
  fetchedAt: number;
}

/**
 * Worth the Camp's items for the Gear Planner: downloaded only when the panel is opened, at most once a day, trimmed
 * to wearable items and kept in this browser. NPC levels come from the same NPC list Leveling Spots uses.
 */
@Injectable({ providedIn: 'root' })
export class GearDataService {
  private readonly wtc = inject(WorthTheCampService);

  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly items = signal<readonly GearItem[]>([]);
  readonly fetchedAt = signal<number | null>(null);
  private pending: Promise<void> | null = null;

  readonly byId = computed(() => new Map(this.items().map((i) => [i.id, i])));

  /** NPC levels by Worth the Camp id (raid bosses flagged). */
  readonly npcs = computed(() => {
    const m = new Map<string, NpcLevel>();
    for (const n of this.wtc.data()?.npcs ?? []) m.set(n.id, { lo: n.lo, hi: n.hi, raid: n.raid === true });
    return m;
  });

  load(): Promise<void> {
    void this.wtc.load();
    if (this.pending) return this.pending;
    this.pending = this.fetchOrCache().finally(() => (this.pending = null));
    return this.pending;
  }

  private async fetchOrCache(): Promise<void> {
    const cached = this.items().length ? { items: this.items(), fetchedAt: this.fetchedAt() ?? 0 } : await readCache();
    if (cached) {
      this.items.set(cached.items);
      this.fetchedAt.set(cached.fetchedAt);
      this.status.set('ready');
      if (Date.now() - cached.fetchedAt < MAX_AGE_MS) return;
    } else {
      this.status.set('loading');
    }
    try {
      const res = await fetch(ITEMS_URL);
      if (!res.ok) throw new Error(`items: ${res.status}`);
      const items = trimItems(await res.json());
      if (!items.length) throw new Error('items: none');
      const data = { items, fetchedAt: Date.now() };
      this.items.set(items);
      this.fetchedAt.set(data.fetchedAt);
      this.status.set('ready');
      void cacheSet(CACHE_KEY, data);
      for (const k of OLD_CACHE_KEYS) void cacheDelete(k);
    } catch {
      // Offline or their API is down: keep the last copy if there is one.
      if (!cached) this.status.set('error');
    }
  }
}

async function readCache(): Promise<ItemCache | null> {
  const d = await cacheGet<ItemCache>(CACHE_KEY);
  return d && Array.isArray(d.items) && Number.isFinite(d.fetchedAt) ? d : null;
}
