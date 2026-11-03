import { Component, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { LootItem } from '../models';
import { TrackerStore } from '../tracker.store';
import { WIKI_HOME, WikiService } from '../wiki.service';

interface Suggestion {
  item: LootItem;
  source: 'recent' | 'wiki';
  detail: string;
}

/** Text box with autocomplete from previously entered items and the M&M wiki. */
@Component({
  selector: 'app-item-search',
  template: `
    <div class="search">
      <input
        #box
        [value]="query()"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
        placeholder="Item name… (Enter to add)"
        autocomplete="off"
        spellcheck="false"
      />
      @if (suggestions().length) {
        <ul class="list">
          @for (s of suggestions(); track s.item.name + s.source; let i = $index) {
            <li>
              <button [class.active]="i === highlighted()" (mousedown)="$event.preventDefault()" (click)="pick(s.item)">
                <span class="nm">{{ s.item.name }}</span>
                <span class="src">{{ s.detail }}</span>
              </button>
            </li>
          }
        </ul>
      }
      @if (hasWikiResults()) {
        <a class="attrib" [href]="wikiHome" target="_blank" rel="noopener">Data from the Monsters and Memories Wiki</a>
      } @else if (wiki.status() === 'no-key' && query().length >= 2) {
        <span class="attrib">Wiki search is off (no API key) — showing your past items.</span>
      } @else if (wiki.status() === 'rate-limited') {
        <span class="attrib">Wiki search is resting (rate limit) — try again shortly.</span>
      }
    </div>
  `,
  styles: `
    .search { position: relative; display: flex; flex-direction: column; gap: 4px; }
    .list {
      list-style: none;
      margin: 0;
      padding: 4px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--dialog-bg);
      max-height: 220px;
      overflow-y: auto;
    }
    .list button {
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      background: none;
      border: none;
      text-align: left;
      padding: 4px 6px;
      &.active, &:hover { background: var(--spirit-soft); filter: none; }
    }
    .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .src { color: var(--muted); font-size: 0.75rem; white-space: nowrap; }
    .attrib { font-size: 0.7rem; color: var(--muted); }
    a.attrib:hover { color: var(--spirit); }
  `,
})
export class ItemSearch {
  readonly picked = output<LootItem>();

  protected readonly store = inject(TrackerStore);
  protected readonly wiki = inject(WikiService);
  protected readonly wikiHome = WIKI_HOME;
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly query = signal('');
  protected readonly wikiResults = signal<LootItem[]>([]);
  private readonly wikiSlots = new Map<string, string>();
  protected readonly highlighted = signal(-1);
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;

  protected readonly suggestions = computed<Suggestion[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const wiki = this.wikiResults();
    const wikiNames = new Set(wiki.map((w) => w.name.toLowerCase()));
    const recent: Suggestion[] = this.store
      .knownItems()
      .filter((i) => i.name.toLowerCase().includes(q) && !wikiNames.has(i.name.toLowerCase()))
      .slice(0, 5)
      .map((item) => ({ item, source: 'recent', detail: 'recent' }));
    const fromWiki: Suggestion[] = wiki.map((item) => ({
      item,
      source: 'wiki',
      detail: this.wikiSlots.get(item.name) || 'wiki',
    }));
    return [...recent, ...fromWiki];
  });

  protected readonly hasWikiResults = computed(() => this.wikiResults().length > 0);

  constructor() {
    afterNextRender(() => this.box().nativeElement.focus({ preventScroll: true }));
  }

  protected onInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.query.set(value);
    this.highlighted.set(-1);
    clearTimeout(this.debounce);
    if (value.trim().length < 2) {
      this.wikiResults.set([]);
      return;
    }
    this.debounce = setTimeout(() => this.searchWiki(value), 250);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.suggestions().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.highlighted.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.highlighted.update((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = this.suggestions()[this.highlighted()];
      if (s) this.pick(s.item);
      else if (this.query().trim()) this.pick(this.exactMatch() ?? { name: this.query().trim() });
    } else if (e.key === 'Escape') {
      this.clear();
    }
  }

  protected pick(item: LootItem): void {
    this.picked.emit(item);
    this.clear();
    this.box().nativeElement.focus({ preventScroll: true });
  }

  /** Typing the full name of a known item reuses its wiki link. */
  private exactMatch(): LootItem | undefined {
    const q = this.query().trim().toLowerCase();
    return this.suggestions().find((s) => s.item.name.toLowerCase() === q)?.item;
  }

  private clear(): void {
    clearTimeout(this.debounce);
    this.query.set('');
    this.wikiResults.set([]);
    this.highlighted.set(-1);
  }

  private async searchWiki(q: string): Promise<void> {
    const seq = ++this.requestSeq;
    const results = await this.wiki.searchItems(q);
    if (seq !== this.requestSeq || this.query() !== q) return; // a newer search superseded this one
    for (const r of results) this.wikiSlots.set(r.name, r.slot.join(', '));
    this.wikiResults.set(results.map((r) => ({ name: r.name, wikiId: r.id, url: r.url })));
  }
}
