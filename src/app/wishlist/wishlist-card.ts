import { Component, computed, inject, input, signal } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { ItemSearch } from '../loot/item-search';
import { LootItem, WishItem, WishlistPanel } from '../models';
import { PriceService, coin, itemSources } from '../prices/price.service';
import { TrackerStore } from '../tracker.store';
import { WishDetails } from './wish-details';
import { ItemTip } from '../item-card/item-tip';
import { ItemEditorService } from '../item-card/item-editor.service';

/**
 * Items you're after. Add them by name (MnMdb suggestions as you type); click one for its stats, where it drops and
 * wiki links. Your own note on where it drops covers anything the sites don't know.
 */
@Component({
  selector: 'app-wishlist-card',
  imports: [ItemSearch, WishDetails, ItemTip],
  template: `
    <div class="card">
      <div class="head drag-handle" title="Drag to move">
        <span class="grip">⠿</span>
        <span class="name">⭐ Wishlist</span>
        @if (counts().total) {
          <span class="count" [title]="counts().got + ' of ' + counts().total + ' got'">{{ counts().got }}/{{ counts().total }} got</span>
        }
        @if (counts().got) {
          <button
            class="icon"
            [class.on]="panel().hideGot"
            (click)="store.updateWishlistPanel({ hideGot: !panel().hideGot })"
            [title]="panel().hideGot ? 'Show items you\\'ve got' : 'Hide items you\\'ve got'"
          >
            {{ panel().hideGot ? '◌' : '◉' }}
          </button>
        }
        <button class="icon" (click)="store.toggleWishlist()" title="Hide (show it again from Tools; your list is kept)">✕</button>
      </div>

      <div class="add">
        <app-item-search [autofocus]="false" placeholder="Add an item… (type a name, Enter)" (picked)="add($event)" />
        <button class="small make" (click)="make()" title="My items: make an item of your own (stats, icon) and add it here">🛠</button>
      </div>

      <ul class="list">
        @for (r of rows(); track r.item.id) {
          <li class="wish" [class.got]="r.item.got" [class.open]="isOpen(r.item.id)">
            <div class="row" [appItemTip]="r.item.name">
              <input
                type="checkbox"
                [checked]="r.item.got"
                (change)="store.updateWish(r.item.id, { got: !r.item.got })"
                [title]="r.item.got ? 'Got it (click to undo)' : 'Mark as got'"
                [attr.aria-label]="'Got ' + r.item.name"
              />
              <button class="nm" (click)="toggle(r.item.id)" [attr.aria-expanded]="isOpen(r.item.id)">
                <span class="title">{{ r.item.name }}</span>
                <span class="from" [class.unknown]="!r.from">{{ r.from || 'where? click to add' }}</span>
              </button>
              @if (r.price) {
                <span class="price" title="Typical Trem asking price (last 30 days)">~{{ r.price }}</span>
              }
              <button class="icon x" (click)="remove(r.item, $event)" title="Remove (Shift+click to skip confirmation)">✕</button>
            </div>
            @if (isOpen(r.item.id)) {
              <app-wish-details [item]="r.item" />
            }
          </li>
        } @empty {
          <li class="empty">
            @if (counts().total) {
              Everything here is got. <button class="small" (click)="store.updateWishlistPanel({ hideGot: false })">Show them</button>
            } @else {
              Add gear or items you're after. You'll see their stats, who drops them and wiki links; add your own note
              when the sites don't know.
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .add {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      app-item-search {
        flex: 1;
        min-width: 0;
      }
      .make {
        flex: none;
        padding: 4px 8px;
      }
    }
    .card {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-left: 4px solid var(--named);
      border-radius: 8px;
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: grab;
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--bone);
    }
    .grip {
      color: var(--muted);
      font-family: initial;
    }
    .name {
      flex: 1;
    }
    .count {
      font-family: inherit;
      font-size: 0.75rem;
      color: var(--muted);
      font-weight: 400;
    }
    .icon.on {
      color: var(--spirit);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .wish {
      border-top: 1px solid var(--border);
      &.open {
        background: color-mix(in srgb, var(--spirit) 4%, transparent);
      }
      &.got .title {
        text-decoration: line-through;
        color: var(--muted);
      }
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      input[type='checkbox'] {
        width: auto;
        flex: none;
      }
    }
    .nm {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      background: none;
      border: none;
      padding: 0;
      text-align: left;
    }
    .title {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .from {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.75rem;
      color: var(--muted);
      &.unknown {
        font-style: italic;
        opacity: 0.7;
      }
    }
    .price {
      flex: none;
      font-size: 0.75rem;
      color: var(--named);
    }
    .x {
      flex: none;
      opacity: 0.6;
      &:hover {
        opacity: 1;
      }
    }
    .empty {
      padding: 10px 2px;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .small {
      padding: 1px 8px;
      font-size: 0.78rem;
    }
  `,
})
export class WishlistCard {
  readonly panel = input.required<WishlistPanel>();
  protected readonly store = inject(TrackerStore);
  private readonly prices = inject(PriceService);
  private readonly confirm = inject(ConfirmService);
  private readonly editor = inject(ItemEditorService);

  private readonly opened = signal<ReadonlySet<string>>(new Set());

  constructor() {
    void this.prices.load();
  }

  protected readonly counts = computed(() => {
    const items = this.panel().items;
    return { total: items.length, got: items.filter((i) => i.got).length };
  });

  /** Items still wanted first (newest first), then the ones you've got. */
  protected readonly rows = computed(() => {
    const p = this.panel();
    const items = [...p.items.filter((i) => !i.got), ...(p.hideGot ? [] : p.items.filter((i) => i.got))];
    return items.map((item) => {
      const it = this.prices.find(item.name);
      const drops = itemSources(it).drops;
      const auto = drops.length
        ? drops[0].mob + (drops[0].rate !== null ? ` (${(drops[0].rate * 100).toFixed(0)}%)` : '') + (drops.length > 1 ? ` +${drops.length - 1} more` : '')
        : '';
      const typical = it ? this.prices.typicalAsk(it) : null;
      return { item, from: item.from || auto, price: typical !== null ? coin(typical) : '' };
    });
  });

  protected isOpen(id: string): boolean {
    return this.opened().has(id);
  }

  protected toggle(id: string): void {
    const next = new Set(this.opened());
    if (!next.delete(id)) next.add(id);
    this.opened.set(next);
  }

  protected add(picked: LootItem): void {
    const item = this.store.addWish(picked.name, picked.url ?? null);
    // Open a new item with nothing known yet, so you can say where it drops.
    if (item && !this.prices.find(item.name) && !this.isOpen(item.id)) this.toggle(item.id);
  }

  /** 🛠: make an item of your own and put it on the list. */
  protected async make(): Promise<void> {
    const saved = await this.editor.open();
    if (saved) this.store.addWish(saved.name, null);
  }

  protected async remove(item: WishItem, e: MouseEvent): Promise<void> {
    if (e.shiftKey || (await this.confirm.ask('Remove from wishlist?', `Remove "${item.name}" from your wishlist?`, 'Remove'))) {
      this.store.removeWish(item.id);
    }
  }
}
