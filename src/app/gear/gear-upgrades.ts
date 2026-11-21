import { Component, computed, inject, input, signal } from '@angular/core';
import { CON_LABEL, Con, conOf } from '../leveling/wtc-leveling';
import { atlasMapForZone } from '../map/atlas-maps';
import { GearCharacter, GearFinder } from '../models';
import { TrackerStore } from '../tracker.store';
import {
  DropInfo,
  FinderOptions,
  GearSet,
  POSITION_BY_ID,
  RECOMMEND_ABOVE,
  SLOT_LABEL,
  SLOT_TYPES,
  SlotType,
  Upgrade,
  Wearer,
  Weights,
  findUpgrades,
  recommend,
  wtcItemUrl,
} from './gear';
import { GearDataService } from './gear-data.service';
import { ItemTip } from '../item-card/item-tip';

/** Upgrades listed before "Show more". */
const PAGE = 40;

/**
 * The Upgrades view (every upgrade the filters allow: slot, mob level, drops / crafted / quest / raid) and the
 * Recommended view (the biggest upgrade per slot from mobs around your level), sharing one list.
 */
@Component({
  selector: 'app-gear-upgrades',
  imports: [ItemTip],
  templateUrl: './gear-upgrades.html',
  styleUrl: './gear-upgrades.scss',
})
export class GearUpgrades {
  readonly character = input.required<GearCharacter>();
  readonly weights = input.required<Weights>();
  readonly finder = input.required<GearFinder>();
  readonly recommended = input(false);

  protected readonly store = inject(TrackerStore);
  protected readonly data = inject(GearDataService);

  protected readonly SLOT_TYPES = SLOT_TYPES;
  protected readonly SLOT_LABEL = SLOT_LABEL;
  protected readonly ABOVE = RECOMMEND_ABOVE;
  protected readonly conLabel = CON_LABEL;
  protected readonly itemUrl = wtcItemUrl;

  protected readonly limit = signal(PAGE);

  protected readonly level = computed(() => this.character().level);

  /** The mob level cap in use: yours, or your level + 3 when none is typed. */
  protected readonly maxMob = computed(() => {
    const lvl = this.level();
    return this.finder().maxMob ?? (lvl !== null ? lvl + RECOMMEND_ABOVE : null);
  });

  protected readonly results = computed<Upgrade[]>(() => {
    const c = this.character();
    const items = this.data.items();
    const byId = this.data.byId();
    const npcs = this.data.npcs();
    const who: Wearer = { cls: c.cls, race: c.race, gear: c.gear as GearSet };
    if (this.recommended()) {
      const lvl = this.level();
      return lvl === null ? [] : recommend(items, byId, npcs, who, this.weights(), lvl);
    }
    const f = this.finder();
    const opts: FinderOptions = {
      slot: (f.slot as SlotType | null) ?? null,
      maxMob: this.maxMob(),
      drops: f.drops,
      crafted: f.crafted,
      quest: f.quest,
      raid: f.raid,
    };
    return findUpgrades(items, byId, npcs, who, this.weights(), opts);
  });

  protected readonly shown = computed(() => this.results().slice(0, this.limit()));

  // ---------- filters ----------

  protected set(patch: Partial<GearFinder>): void {
    this.store.setGearFinder(patch);
    this.limit.set(PAGE);
  }

  protected setMaxMob(box: HTMLInputElement): void {
    const n = parseInt(box.value, 10);
    this.set({ maxMob: Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : null });
  }

  // ---------- a result ----------

  /** Adds to the Wishlist and shows the Wishlist panel if it's hidden. */
  protected wish(name: string): void {
    this.store.addWish(name);
    if (!this.store.wishlistPanel().shown) this.store.toggleWishlist();
  }

  protected wear(u: Upgrade): void {
    this.store.setGear(this.character().id, u.position, u.item, u.item.twoHand ? ['offhand'] : []);
  }

  protected slotOf(u: Upgrade): string {
    return SLOT_LABEL[POSITION_BY_ID.get(u.position)!.slot];
  }

  protected slotName(slot: string): string {
    return SLOT_LABEL[slot as SlotType] ?? slot;
  }

  protected dropOf(u: Upgrade): DropInfo | null {
    return u.how.kind === 'drop' ? u.how.drop : null;
  }

  protected moreDrops(u: Upgrade): number {
    return u.how.kind === 'drop' ? u.how.more : 0;
  }

  protected craftedOf(u: Upgrade): string | null {
    return u.how.kind === 'crafted' ? u.how.text : null;
  }

  protected con(hi: number | null): Con | null {
    const lvl = this.level();
    return hi !== null && lvl !== null ? conOf(hi, lvl) : null;
  }

  protected levels(lo: number | null, hi: number | null): string {
    if (lo === null || hi === null) return 'level ?';
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  }

  protected atlasId(zone: string): string | null {
    return zone ? (atlasMapForZone(zone)?.id ?? null) : null;
  }

  protected pct(rate: number): string {
    const p = rate * 100;
    return p >= 10 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
  }

  protected fmt(n: number): string {
    return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0';
  }
}
