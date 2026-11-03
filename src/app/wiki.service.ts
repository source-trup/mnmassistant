import { Injectable, signal } from '@angular/core';

/** An item search hit from the Monsters and Memories Wiki partner API. */
export interface WikiItem {
  id: string;
  name: string;
  url: string;
  slot: string[];
}

export type WikiStatus = 'unknown' | 'ok' | 'no-key' | 'rate-limited' | 'offline';

export const WIKI_HOME = 'https://monstersandmemories.wiki/';

/**
 * Item search against https://monstersandmemories.wiki/api/partner/v1.
 *
 * Requests go to the same-origin path /api/partner/v1/..., which the Angular dev server proxies to
 * the wiki and adds the API key to (see proxy.conf.mjs). The key never reaches the browser.
 */
@Injectable({ providedIn: 'root' })
export class WikiService {
  readonly status = signal<WikiStatus>('unknown');

  private readonly cache = new Map<string, WikiItem[]>();
  private blockedUntil = 0;

  async searchItems(query: string): Promise<WikiItem[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const key = q.toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (this.status() === 'no-key' || Date.now() < this.blockedUntil) return [];

    try {
      const res = await fetch(`/api/partner/v1/search?type=item&limit=8&q=${encodeURIComponent(q)}`);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        this.status.set('no-key');
        return [];
      }
      if (res.status === 429) {
        const retry = Number(res.headers.get('Retry-After') ?? '30');
        this.blockedUntil = Date.now() + retry * 1000;
        this.status.set('rate-limited');
        return [];
      }
      if (!res.ok) {
        this.status.set('offline');
        return [];
      }
      const body = await res.json();
      const items: WikiItem[] = (body?.results ?? [])
        .filter((r: any) => r?.type === 'item' && r?.name)
        .map((r: any) => ({ id: String(r.id), name: r.name, url: r.url, slot: r.slot ?? [] }));
      this.cache.set(key, items);
      this.status.set('ok');
      return items;
    } catch {
      this.status.set('offline');
      return [];
    }
  }
}
