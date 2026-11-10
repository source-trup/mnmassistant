import { Component, ElementRef, OnInit, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { WikiPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { COMMUNITY_WIKI, CommunityWikiService, WikiHit, WikiPage, wikiPageUrl } from './community-wiki.service';

type View =
  | { kind: 'home' }
  | { kind: 'loading'; what: string }
  | { kind: 'results'; term: string; hits: WikiHit[]; noPage: boolean }
  | { kind: 'page'; page: WikiPage }
  | { kind: 'error'; retry: () => void };

/**
 * The community wiki inside the app: search it, read a page, and follow its links without leaving the board.
 * Other panels open it on a name with TrackerStore.showWiki().
 */
@Component({
  selector: 'app-wiki-card',
  templateUrl: './wiki-card.html',
  styleUrl: './wiki-card.scss',
})
export class WikiCard implements OnInit {
  readonly panel = input.required<WikiPanel>();
  protected readonly store = inject(TrackerStore);
  private readonly wiki = inject(CommunityWikiService);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  protected readonly WIKI = COMMUNITY_WIKI;
  protected readonly view = signal<View>({ kind: 'home' });
  /** Pages and searches visited, for Back. */
  private readonly trail = signal<(() => void)[]>([]);
  protected readonly canBack = () => this.trail().length > 0;
  protected readonly query = signal('');
  /** Bumps on every navigation so a slow, older request can't overwrite a newer one. */
  private seq = 0;

  ngOnInit(): void {
    // Reopen the page that was showing last time, unless another panel is already asking for a lookup.
    const last = this.panel().page;
    if (last && !this.store.wikiLookup()) void this.open(last, false);
  }

  constructor() {
    // Lookups asked for by other panels.
    effect(() => {
      const req = this.store.wikiLookup();
      if (!req) return;
      untracked(() => {
        this.store.wikiLookup.set(null);
        void this.lookup(req.term);
      });
    });
  }

  // ---------- navigation ----------

  /** A name from elsewhere in the app: its page if there is one, otherwise search results. */
  protected async lookup(term: string, push = true): Promise<void> {
    this.query.set(term);
    const n = ++this.seq;
    this.remember(push);
    this.view.set({ kind: 'loading', what: term });
    try {
      const title = await this.wiki.resolve(term);
      if (n !== this.seq) return;
      if (title) {
        await this.show(title, n);
        return;
      }
      const hits = await this.wiki.search(term);
      if (n !== this.seq) return;
      this.view.set({ kind: 'results', term, hits, noPage: true });
      this.store.updateWikiPanel({ page: null });
    } catch {
      if (n === this.seq) this.view.set({ kind: 'error', retry: () => void this.lookup(term, false) });
    }
  }

  protected async search(term: string, push = true): Promise<void> {
    const t = term.trim();
    if (t.length < 2) return;
    this.query.set(t);
    const n = ++this.seq;
    this.remember(push);
    this.view.set({ kind: 'loading', what: t });
    try {
      // An exact page goes first in the results.
      const [title, hits] = await Promise.all([this.wiki.resolve(t), this.wiki.search(t)]);
      if (n !== this.seq) return;
      // The exact page always comes first.
      const exact = title ? (hits.find((h) => h.title === title) ?? { title, snippet: '' }) : null;
      const list = exact ? [exact, ...hits.filter((h) => h !== exact)] : hits;
      this.view.set({ kind: 'results', term: t, hits: list, noPage: false });
      this.store.updateWikiPanel({ page: null });
    } catch {
      if (n === this.seq) this.view.set({ kind: 'error', retry: () => void this.search(t, false) });
    }
  }

  protected async open(title: string, push = true): Promise<void> {
    const n = ++this.seq;
    this.remember(push);
    this.view.set({ kind: 'loading', what: title });
    try {
      await this.show(title, n);
    } catch {
      if (n === this.seq) this.view.set({ kind: 'error', retry: () => void this.open(title, false) });
    }
  }

  private async show(title: string, n: number): Promise<void> {
    const page = await this.wiki.page(title);
    if (n !== this.seq) return;
    if (!page) {
      const hits = await this.wiki.search(title);
      if (n !== this.seq) return;
      this.view.set({ kind: 'results', term: title, hits, noPage: true });
      return;
    }
    this.view.set({ kind: 'page', page });
    this.store.updateWikiPanel({ page: page.title });
    setTimeout(() => this.body()?.nativeElement.scrollTo({ top: 0 }));
  }

  /** Before navigating, keep a way back to what's showing now. */
  private remember(push: boolean): void {
    if (!push) return;
    const v = this.view();
    const back =
      v.kind === 'page'
        ? () => void this.open(v.page.title, false)
        : v.kind === 'results'
          ? () => void (v.noPage ? this.lookup(v.term, false) : this.search(v.term, false))
          : null;
    if (back) this.trail.update((t) => [...t.slice(-29), back]);
  }

  protected back(): void {
    const t = this.trail();
    const prev = t[t.length - 1];
    if (!prev) return;
    this.trail.set(t.slice(0, -1));
    prev();
  }

  protected home(): void {
    this.remember(true);
    this.view.set({ kind: 'home' });
    this.store.updateWikiPanel({ page: null });
  }

  // ---------- links inside a page ----------

  /** Wiki links open here; files, categories and other sites open in a new tab. */
  protected onPageClick(e: MouseEvent): void {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    e.preventDefault();
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      this.body()?.nativeElement.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' });
      return;
    }
    const url = new URL(href, COMMUNITY_WIKI.url);
    const sameWiki = url.origin === new URL(COMMUNITY_WIKI.url).origin;
    // A red link (a page that doesn't exist yet): search for it instead.
    const redTitle = sameWiki ? url.searchParams.get('title') : null;
    if (redTitle && url.searchParams.get('redlink')) {
      void this.lookup(redTitle.replace(/_/g, ' '));
      return;
    }
    const m = sameWiki ? url.pathname.match(/^\/wiki\/(.+)$/) : null;
    const title = m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
    if (title && !/^(File|Category|Special|Template|User|Help|Talk|MediaWiki|Module):/i.test(title)) {
      void this.open(title);
      return;
    }
    window.open(url.toString(), '_blank', 'noopener');
  }

  protected pageUrl(title: string): string {
    return wikiPageUrl(title);
  }

  protected currentUrl(): string {
    const v = this.view();
    if (v.kind === 'page') return v.page.url;
    if (v.kind === 'results') return `${COMMUNITY_WIKI.url}w/index.php?search=${encodeURIComponent(v.term)}`;
    return COMMUNITY_WIKI.url;
  }
}
