import { Injectable } from '@angular/core';
import { cacheGet, cacheSet } from '../idb-cache';
import { SiteKind, wikiPageKind } from '../site-links/site-urls';

/**
 * The community Monsters and Memories Wiki on Miraheze (CC BY-SA 4.0), read through its public MediaWiki API.
 *
 * Only live lookups, one at a time, when you search or open a page: no crawling. Results are cached for the session.
 * The one list it reads is the names of the wiki's item icons (for 🛠 My items), a few API pages at most once a week.
 * The API sends CORS headers for anonymous requests (origin=*), so the browser can call it directly.
 */
export const COMMUNITY_WIKI = {
  name: 'Monsters and Memories Wiki',
  url: 'https://monstersandmemories.miraheze.org/',
  api: 'https://monstersandmemories.miraheze.org/w/api.php',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export interface WikiHit {
  title: string;
  /** Plain-text snippet (search highlights and wiki markup removed). */
  snippet: string;
}

export interface WikiPage {
  title: string;
  /** Rendered page HTML from the wiki. Shown through Angular's sanitizer ([innerHTML]), which strips scripts and styles. */
  html: string;
  url: string;
  /** An item or NPC page (from its categories), or null for anything else. */
  kind: SiteKind | null;
}

export function wikiPageUrl(title: string): string {
  return `${COMMUNITY_WIKI.url}wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/** Spellings to try for an exact page: MediaWiki titles are case-sensitive after the first letter. */
function titleVariants(term: string): string[] {
  const t = term.trim().replace(/\s+/g, ' ');
  const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);
  const words = t.split(' ');
  const out = [
    t,
    cap(t),
    words.map(cap).join(' '),
    words.map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : cap(w.toLowerCase()))).join(' '),
  ];
  return [...new Set(out)].filter(Boolean).slice(0, 5);
}

/** Search snippets come with highlight spans and template markup; keep readable text only. */
function cleanSnippet(s: string): string {
  const el = document.createElement('div');
  el.innerHTML = s; // a detached element: nothing renders or runs
  return (el.textContent ?? '')
    .replace(/\{\{[^}]*\}\}?/g, ' ')
    .replace(/\|\s*[a-z_]+\s*=/gi, ' · ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/[{}|]+/g, ' ')
    .replace(/(\s*·\s*)+/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*·\s*/, '')
    .trim()
    .slice(0, 160);
}

/** One of the wiki's item icon files. */
export interface WikiIcon {
  /** File name, e.g. "Itemicon0106AA.png". */
  name: string;
  url: string;
}

const ICONS_KEY = 'wiki-item-icons.v1';
const ICONS_MAX_AGE_MS = 7 * 24 * 3_600_000;
/** 500 names a page; more pages than the wiki has item icons, so the list is never cut short in practice. */
const ICON_PAGES = 20;

@Injectable({ providedIn: 'root' })
export class CommunityWikiService {
  private icons: Promise<WikiIcon[]> | null = null;

  /**
   * Every item icon on the wiki (files named "Itemicon…"), from the API's file list, one page after another. Kept in
   * this browser for a week. Rejects if the wiki can't be reached and there's no saved copy.
   */
  itemIcons(): Promise<WikiIcon[]> {
    this.icons ??= this.loadIcons().catch((e) => {
      this.icons = null;
      throw e;
    });
    return this.icons;
  }

  private async loadIcons(): Promise<WikiIcon[]> {
    const saved = await cacheGet<{ at: number; icons: WikiIcon[] }>(ICONS_KEY);
    if (saved && Array.isArray(saved.icons) && Date.now() - saved.at < ICONS_MAX_AGE_MS) return saved.icons;
    try {
      const icons: WikiIcon[] = [];
      let from: string | undefined;
      for (let page = 0; page < ICON_PAGES; page++) {
        const data = await this.api({
          action: 'query',
          list: 'allimages',
          aiprefix: 'Itemicon',
          ailimit: '500',
          aiprop: 'url',
          ...(from ? { aicontinue: from } : {}),
        });
        for (const i of data?.query?.allimages ?? []) {
          if (typeof i?.name === 'string' && typeof i?.url === 'string' && i.url.startsWith('https://')) icons.push({ name: i.name, url: i.url });
        }
        from = data?.continue?.aicontinue;
        if (!from) break;
      }
      if (!icons.length) throw new Error('no icons');
      void cacheSet(ICONS_KEY, { at: Date.now(), icons });
      return icons;
    } catch (e) {
      if (saved?.icons?.length) return saved.icons;
      throw e;
    }
  }
  private readonly pages = new Map<string, WikiPage | null>();
  private readonly searches = new Map<string, WikiHit[]>();
  private readonly resolved = new Map<string, string | null>();

  private async api(params: Record<string, string>): Promise<any> {
    const q = new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' });
    const res = await fetch(`${COMMUNITY_WIKI.api}?${q}`);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  /** The wiki page a term names exactly (following redirects), or null if there isn't one. */
  async resolve(term: string): Promise<string | null> {
    const key = term.trim().toLowerCase();
    if (!key) return null;
    if (this.resolved.has(key)) return this.resolved.get(key)!;
    const variants = titleVariants(term);
    const data = await this.api({ action: 'query', titles: variants.join('|'), redirects: '1' });
    const q = data?.query ?? {};
    // Map each variant through normalisation and redirects to the page it lands on.
    const follow = (t: string) => {
      t = q.normalized?.find((n: any) => n.from === t)?.to ?? t;
      return q.redirects?.find((r: any) => r.from === t)?.to ?? t;
    };
    const existing = new Set((q.pages ?? []).filter((p: any) => !p.missing && !p.invalid).map((p: any) => p.title));
    const hit = variants.map(follow).find((t) => existing.has(t)) ?? null;
    this.resolved.set(key, hit);
    return hit;
  }

  async search(term: string): Promise<WikiHit[]> {
    const key = term.trim().toLowerCase();
    if (key.length < 2) return [];
    const cached = this.searches.get(key);
    if (cached) return cached;
    const data = await this.api({ action: 'query', list: 'search', srsearch: term.trim(), srlimit: '12', srprop: 'snippet', srnamespace: '0' });
    const hits: WikiHit[] = (data?.query?.search ?? []).map((h: any) => ({ title: h.title, snippet: cleanSnippet(h.snippet ?? '') }));
    // Pages whose title contains the term first.
    hits.sort((a, b) => Number(!a.title.toLowerCase().includes(key)) - Number(!b.title.toLowerCase().includes(key)));
    this.searches.set(key, hits);
    return hits;
  }

  /** The source of a wiki page as plain text (e.g. a gadget's script), or null if it doesn't exist. */
  async source(title: string): Promise<string | null> {
    const data = await this.api({ action: 'query', titles: title, prop: 'revisions', rvprop: 'content', rvslots: 'main' });
    const page = data?.query?.pages?.[0];
    return page && !page.missing ? (page.revisions?.[0]?.slots?.main?.content ?? null) : null;
  }

  /** A rendered page, or null if it doesn't exist. */
  async page(title: string): Promise<WikiPage | null> {
    if (this.pages.has(title)) return this.pages.get(title)!;
    const data = await this.api({
      action: 'parse',
      page: title,
      prop: 'text|categories',
      redirects: '1',
      disableeditsection: '1',
      disabletoc: '1',
      disablelimitreport: '1',
    });
    const p = data?.parse;
    const cats: string[] = (p?.categories ?? []).map((c: any) => String(c?.category ?? ''));
    const page: WikiPage | null = p ? { title: p.title, html: p.text ?? '', url: wikiPageUrl(p.title), kind: wikiPageKind(cats) } : null;
    this.pages.set(title, page);
    if (page && page.title !== title) this.pages.set(page.title, page);
    return page;
  }
}
