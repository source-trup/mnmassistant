import { Injectable, computed, inject } from '@angular/core';
import { GearDataService } from '../gear/gear-data.service';
import { customToGear } from '../gear/gear';
import { PriceService } from '../prices/price.service';
import { TrackerStore } from '../tracker.store';
import { CardData, cardFromGear, cardFromMnmdb, cardMissing } from './card-data';

/**
 * Finds an item by name in whatever the app has on hand, for a card: your own items first, then MnMdb's details
 * (the Wishlist and Price Checker load them), then Worth the Camp's items if the Gear Planner has loaded them.
 * Nothing is downloaded just for a card.
 */
@Injectable({ providedIn: 'root' })
export class ItemLookupService {
  private readonly store = inject(TrackerStore);
  private readonly prices = inject(PriceService);
  private readonly gear = inject(GearDataService);

  private readonly wtcByName = computed(() => new Map(this.gear.wtcItems().map((i) => [i.name.toLowerCase(), i])));

  /** The card for a name, or a "no item data" card when nothing knows it. */
  cardFor(name: string): CardData {
    const key = name.trim().toLowerCase();
    const mine = this.store.customItems().find((c) => c.name.toLowerCase() === key);
    if (mine) return cardFromGear(customToGear(mine), this.gear.npcs());
    const fromMnmdb = this.prices.find(name);
    const card = fromMnmdb ? cardFromMnmdb(fromMnmdb) : null;
    if (card) return card;
    const wtc = this.wtcByName().get(key);
    if (wtc) return cardFromGear(wtc, this.gear.npcs());
    return cardMissing(name.trim());
  }
}
