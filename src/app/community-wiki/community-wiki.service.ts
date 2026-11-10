import { Injectable } from '@angular/core';

/**
 * The community Monsters and Memories Wiki on Miraheze (CC BY-SA 4.0), read through its public MediaWiki API.
 *
 * Only live lookups, one at a time, when you search or open a page: no crawling. Results are cached for the session.
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

@Injectable({ providedIn: 'root' })
export class CommunityWikiService {
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

  /** A rendered page, or null if it doesn't exist. */
  async page(title: string): Promise<WikiPage | null> {
    if (this.pages.has(title)) return this.pages.get(title)!;
    const data = await this.api({
      action: 'parse',
      page: title,
      prop: 'text',
      redirects: '1',
      disableeditsection: '1',
      disabletoc: '1',
      disablelimitreport: '1',
    });
    const p = data?.parse;
    const page: WikiPage | null = p ? { title: p.title, html: p.text ?? '', url: wikiPageUrl(p.title) } : null;
    this.pages.set(title, page);
    if (page && page.title !== title) this.pages.set(page.title, page);
    return page;
  }
}
