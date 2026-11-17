import { Component, computed, inject, input, signal } from '@angular/core';
import { CommunityWikiService, wikiPageUrl } from '../community-wiki/community-wiki.service';
import { atlasMapForZone } from '../map/atlas-maps';
import { WishItem } from '../models';
import { PriceService, coin, itemSources, itemStatLines, mnmdbItemUrl } from '../prices/price.service';
import { TrackerStore, wikiItemPageUrl } from '../tracker.store';
import { WikiService } from '../wiki.service';

/**
 * One wishlist item opened up: its stats and where it comes from (MnMdb), your own note on where it drops, and links
 * to MnMdb, the Miraheze wiki and monstersandmemories.wiki where those pages exist.
 */
@Component({
  selector: 'app-wish-details',
  template: `
    <div class="details">
      @if (mnmdb(); as it) {
        @if (stats().length || it.info?.flags?.length) {
          <div class="stats">
            @for (s of stats(); track s) {
              <span>{{ s }}</span>
            }
            @for (f of it.info?.flags ?? []; track f) {
              <span class="flag">{{ f }}</span>
            }
          </div>
        }
        @if (it.info?.classes) {
          <p class="muted">Classes: {{ it.info!.classes }}@if (it.info?.races && it.info!.races !== 'ALL') { · Races: {{ it.info!.races }}}</p>
        }
        @if (it.info?.effect) {
          <p class="muted">Effect: {{ it.info!.effect }}</p>
        }
      }

      @if (hasSources()) {
        <div class="src">
          @if (sources().drops.length) {
            <p>
              <span class="k">Drops from</span>
              @for (d of sources().drops; track d.mob; let last = $last) {
                <span class="mob">{{ d.mob }}</span>@if (d.rate !== null) { <small>({{ (d.rate * 100).toFixed(0) }}%)</small>}@if (!last) {, }
              }
            </p>
          }
          @if (mnmdb()?.harvested) {
            <p><span class="k">Gathered</span> {{ mnmdb()!.harvested }} harvests recorded</p>
          }
          @if (mnmdb()?.info?.tradeskills?.length) {
            <p><span class="k">Made with</span> {{ mnmdb()!.info!.tradeskills.join(', ') }}</p>
          }
          @if (mnmdb()?.soldBy?.length) {
            <p>
              <span class="k">Sold by</span>
              @for (m of mnmdb()!.soldBy.slice(0, 4); track m.name; let last = $last) {
                {{ m.name }}@if (m.zone) { <small>({{ m.zone }})</small>}@if (!last) {, }
              }
            </p>
          }
          @if (sources().zones.length) {
            <div class="zones">
              @for (z of sources().zones; track z) {
                @if (mapFor(z); as m) {
                  <button class="small" (click)="store.showMap({ map: m, level: null, find: null })" [title]="'Show ' + z + ' on the Map panel'">🧭 {{ z }}</button>
                } @else {
                  <span class="zone">{{ z }}</span>
                }
              }
            </div>
          }
        </div>
      } @else if (prices.status() === 'ready') {
        <p class="none">MnMdb has no drop or stat data for this item yet.</p>
      } @else if (prices.status() === 'loading') {
        <p class="muted">Looking it up on MnMdb…</p>
      }

      <label class="note">
        <span class="k">Where it drops <em>(your note)</em></span>
        <input
          #from
          [value]="item().from"
          [placeholder]="hasSources() ? 'Anything to add? (camp, quest, who has one…)' : 'e.g. Grimfang, Fallen Pass (10%)'"
          (change)="store.updateWish(item().id, { from: from.value })"
          (keydown.enter)="from.blur()"
          aria-label="Where it drops"
        />
      </label>

      <div class="links">
        @if (mirahezeTitle(); as t) {
          <button class="small" (click)="store.showWiki(t)" title="Read it in the Wiki panel">📖 Wiki</button>
          <a class="small" [href]="pageUrl(t)" target="_blank" rel="noopener" title="Open on the Miraheze wiki">Miraheze ↗</a>
        }
        <a
          class="small"
          [href]="dotWikiUrl()"
          target="_blank"
          rel="noopener"
          [title]="item().wikiUrl ? 'Open on monstersandmemories.wiki' : 'Open on monstersandmemories.wiki (if the page has been written)'"
          >.wiki ↗</a
        >
        @if (mnmdb(); as it) {
          <a class="small" [href]="mnmdbUrl(it)" target="_blank" rel="noopener" title="Open on MnMdb">MnMdb ↗</a>
          <button class="small" (click)="store.showPrice(it.name)" title="Open in the Prices panel">💰 Price</button>
        }
        @if (addingLink()) {
          <input
            #link
            class="link-box"
            placeholder="Paste a monstersandmemories.wiki link"
            [value]="item().wikiUrl ?? ''"
            (keydown.enter)="saveLink(link)"
            (keydown.escape)="addingLink.set(false)"
            (blur)="saveLink(link)"
            aria-label=".wiki link"
          />
        } @else {
          <button class="small ghost" (click)="addingLink.set(true)" title="Wrong .wiki page? Paste the right link">✎ .wiki link</button>
        }
      </div>
    </div>
  `,
  styles: `
    .details {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 4px 8px 26px;
      font-size: 0.82rem;
    }
    p {
      margin: 0;
    }
    .muted {
      color: var(--muted);
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      span {
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--spirit-soft);
        font-size: 0.78rem;
      }
      .flag {
        background: var(--named-bg);
        color: var(--named);
      }
    }
    .k {
      color: var(--muted);
      margin-right: 4px;
      em {
        font-style: normal;
        opacity: 0.8;
      }
    }
    .mob {
      color: var(--text);
    }
    small {
      color: var(--muted);
    }
    .zones {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 2px;
    }
    .zone {
      font-size: 0.78rem;
      color: var(--muted);
    }
    .none {
      color: var(--paused);
    }
    .note {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
    }
    .small {
      padding: 2px 8px;
      font-size: 0.78rem;
    }
    a.small {
      color: var(--spirit);
      text-decoration: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      &:hover {
        background: var(--button-bg);
      }
    }
    .ghost {
      background: none;
      color: var(--muted);
    }
    .link-box {
      flex: 1;
      min-width: 160px;
      font-size: 0.78rem;
    }
  `,
})
export class WishDetails {
  readonly item = input.required<WishItem>();
  protected readonly store = inject(TrackerStore);
  protected readonly prices = inject(PriceService);
  private readonly community = inject(CommunityWikiService);
  private readonly partner = inject(WikiService);

  protected readonly mnmdb = computed(() => this.prices.find(this.item().name) ?? null);
  protected readonly stats = computed(() => itemStatLines(this.mnmdb()?.info));
  protected readonly sources = computed(() => itemSources(this.mnmdb()));
  protected readonly hasSources = computed(() => {
    const it = this.mnmdb();
    const s = this.sources();
    return !!it && (s.drops.length > 0 || s.zones.length > 0 || it.harvested > 0 || it.soldBy.length > 0 || !!it.info?.tradeskills?.length);
  });

  /** The Miraheze wiki page with this item's name, if there is one. */
  protected readonly mirahezeTitle = signal<string | null>(null);
  /** Its monstersandmemories.wiki page: a link you pasted or the wiki's search found, else one built from the name. */
  protected readonly dotWikiUrl = computed(() => this.item().wikiUrl ?? wikiItemPageUrl(this.item().name));
  protected readonly addingLink = signal(false);
  protected readonly coin = coin;

  ngOnInit(): void {
    const it = this.item();
    this.community
      .resolve(it.name)
      .then((t) => this.mirahezeTitle.set(t))
      .catch(() => this.mirahezeTitle.set(null));
    // monstersandmemories.wiki: an exact match from its item search gives the real page address. The search needs the
    // partner key, which only the local dev server has; elsewhere the link is built from the name.
    if (!it.wikiUrl) {
      this.partner
        .searchItems(it.name)
        .then((hits) => {
          const hit = hits.find((h) => h.name.toLowerCase() === it.name.toLowerCase());
          if (hit?.url) this.store.updateWish(it.id, { wikiUrl: hit.url });
        })
        .catch(() => undefined);
    }
  }

  protected pageUrl(title: string): string {
    return wikiPageUrl(title);
  }

  protected mnmdbUrl(it: NonNullable<ReturnType<typeof this.mnmdb>>): string {
    return mnmdbItemUrl(it);
  }

  protected mapFor(zone: string): string | null {
    return atlasMapForZone(zone)?.id ?? null;
  }

  protected saveLink(box: HTMLInputElement): void {
    if (!this.addingLink()) return;
    const v = box.value.trim();
    // Cleared: back to the link built from the name.
    if (!v) this.store.updateWish(this.item().id, { wikiUrl: null });
    else {
      this.store.updateWish(this.item().id, { wikiUrl: v });
      if (!this.store.wishlistPanel().items.find((i) => i.id === this.item().id)?.wikiUrl) {
        box.classList.add('invalid');
        box.select();
        return;
      }
    }
    this.addingLink.set(false);
  }
}
