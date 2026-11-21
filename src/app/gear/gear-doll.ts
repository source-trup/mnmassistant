import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { GearCharacter } from '../models';
import { THEMES, glyphSvg } from '../themes';
import { TrackerStore } from '../tracker.store';
import {
  GearItem,
  POSITIONS,
  POSITION_BY_ID,
  Position,
  PositionId,
  WEIGHT_KEYS,
  WEIGHT_LABEL,
  WeightKey,
  Weights,
  canWear,
  defaultWeights,
  gearClassName,
  itemIconUrl,
  itemScore,
  itemSummary,
  raceArt,
  raceName,
  totals,
  wtcItemUrl,
} from './gear';
import { GearDataService } from './gear-data.service';
import { ItemTip } from '../item-card/item-tip';
import { ItemEditorService } from '../item-card/item-editor.service';

/** Suggestions shown while typing an item name. */
const SUGGESTIONS = 12;

const LEFT: PositionId[] = ['head', 'face', 'ear1', 'ear2', 'neck', 'shoulders', 'back'];
const RIGHT: PositionId[] = ['chest', 'shirt', 'wrist1', 'wrist2', 'hands', 'finger1', 'finger2'];
const MIDDLE: PositionId[] = ['waist', 'legs', 'feet'];
const WEAPONS: PositionId[] = ['primary', 'offhand', 'ranged', 'ammo'];

/**
 * The paper doll: every equipment position, what's in it, and its score. Click a position to pick an item for it
 * (suggestions fit the slot and your class and race), take it off, or look for upgrades. Totals in the middle.
 */
@Component({
  selector: 'app-gear-doll',
  imports: [NgTemplateOutlet, ItemTip],
  templateUrl: './gear-doll.html',
  styleUrl: './gear-doll.scss',
})
export class GearDoll {
  readonly character = input.required<GearCharacter>();
  readonly weights = input.required<Weights>();
  /** "Find upgrades for this slot": the card switches to the Upgrades view. */
  readonly findUpgrades = output<void>();

  protected readonly store = inject(TrackerStore);
  protected readonly data = inject(GearDataService);

  protected readonly LEFT = LEFT;
  protected readonly RIGHT = RIGHT;
  protected readonly MIDDLE = MIDDLE;
  protected readonly WEAPONS = WEAPONS;
  protected readonly WEIGHT_KEYS = WEIGHT_KEYS;
  protected readonly WEIGHT_LABEL = WEIGHT_LABEL;
  protected readonly summary = itemSummary;
  protected readonly itemUrl = wtcItemUrl;
  protected readonly iconUrl = itemIconUrl;
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('q');

  /** The position being edited. */
  protected readonly selected = signal<PositionId | null>(null);
  protected readonly query = signal('');

  protected pos(id: PositionId): Position {
    return POSITION_BY_ID.get(id)!;
  }

  /** What's worn at a position: the item (if the data still has it) and its saved name. */
  protected worn(id: PositionId): { name: string; item: GearItem | null } | null {
    const g = this.character().gear[id];
    if (!g) return null;
    const item = this.data.byId().get(g.id) ?? null;
    return { name: item?.name ?? g.name, item };
  }

  protected scoreAt(id: PositionId): number | null {
    const it = this.worn(id)?.item;
    return it ? itemScore(it, this.weights(), this.pos(id).slot) : null;
  }

  /** Offhand is taken by a two-hander in the primary. */
  protected readonly twoHanded = computed(() => this.worn('primary')?.item?.twoHand ?? false);

  protected readonly wornItems = computed(() => {
    this.character();
    return POSITIONS.map((p) => this.worn(p.id)?.item).filter((i): i is GearItem => !!i);
  });

  protected readonly totals = computed(() => totals(this.wornItems()));

  protected readonly gearScore = computed(() => {
    let n = 0;
    for (const p of POSITIONS) n += this.scoreAt(p.id) ?? 0;
    return Math.round(n);
  });

  protected readonly filled = computed(() => POSITIONS.filter((p) => this.character().gear[p.id]).length);

  // ---------- editing a position ----------

  /** Opens a position for editing. An empty one gets the item search focused, so you can start typing straight away. */
  protected select(id: PositionId): void {
    this.selected.set(this.selected() === id ? null : id);
    this.query.set('');
    this.searchFocused.set(false);
    if (this.selected() && !this.worn(id)) setTimeout(() => this.searchBox()?.nativeElement.focus());
  }

  /** The item search has the cursor. */
  protected readonly searchFocused = signal(false);

  /**
   * While you type an item name, the doll slides away and only the slot being edited stays, so the suggestions have
   * room. It comes back when the search loses focus, on Escape, or when the slot is closed.
   */
  protected readonly searching = computed(() => !!this.selected() && this.searchFocused() && this.query().trim().length > 0);

  /** Escape: clear the search and slide the doll back. */
  protected endSearch(box: HTMLInputElement): void {
    this.query.set('');
    box.blur();
  }

  /**
   * Pressing a button or link in the slot editor keeps the cursor in the search until the click lands; otherwise the
   * doll would slide back in and move the button out from under the pointer.
   */
  protected keepSearchFocus(e: MouseEvent): void {
    if ((e.target as Element).closest('button, a')) e.preventDefault();
  }

  protected close(): void {
    this.selected.set(null);
    this.query.set('');
    this.searchFocused.set(false);
  }

  /** Items that fit the selected slot and your class and race, matching what's typed: name starts first, then best. */
  protected readonly suggestions = computed(() => {
    const id = this.selected();
    const q = this.query().trim().toLowerCase();
    if (!id || q.length < 2) return [];
    const slot = this.pos(id).slot;
    const c = this.character();
    const w = this.weights();
    const current = this.scoreAt(id) ?? 0;
    const words = q.split(/\s+/);
    return this.data
      .items()
      .filter((i) => i.slots.includes(slot) && canWear(i, c.cls, c.race) && (!i.twoHand || id === 'primary'))
      .filter((i) => {
        const n = i.name.toLowerCase();
        return words.every((word) => n.includes(word));
      })
      .map((i) => ({ item: i, score: itemScore(i, w, slot), starts: i.name.toLowerCase().startsWith(q) }))
      .sort((a, b) => Number(b.starts) - Number(a.starts) || b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, SUGGESTIONS)
      .map((s) => ({ ...s, gain: Math.round((s.score - current) * 100) / 100 }));
  });

  protected equip(item: GearItem): void {
    const id = this.selected();
    if (!id) return;
    const clear: PositionId[] = [];
    if (item.twoHand) clear.push('offhand');
    if (id === 'offhand' && this.twoHanded()) clear.push('primary');
    this.store.setGear(this.character().id, id, item, clear);
    this.query.set('');
  }

  private readonly editor = inject(ItemEditorService);

  /** "Create … as your own item": opens 🛠 My items with the name and slot filled in, and wears it once saved. */
  protected async create(id: PositionId): Promise<void> {
    const slot = this.pos(id).slot;
    const saved = await this.editor.open({ name: this.query().trim(), slot });
    if (!saved || !saved.slots.includes(slot) || this.selected() !== id) return;
    const item = this.data.byId().get(saved.id);
    if (item) this.equip(item);
  }

  protected takeOff(id: PositionId): void {
    this.store.setGear(this.character().id, id, null);
  }

  protected upgradesFor(id: PositionId): void {
    this.store.setGearFinder({ slot: this.pos(id).slot });
    this.findUpgrades.emit();
  }

  /** Adds to the Wishlist and shows the Wishlist panel if it's hidden. */
  protected wish(name: string): void {
    this.store.addWish(name);
    if (!this.store.wishlistPanel().shown) this.store.toggleWishlist();
  }

  // ---------- the middle: themed by class and race ----------

  /** The chosen race's portrait from the official races page (hidden if it fails to load). */
  protected readonly portrait = computed(() => raceArt(this.character().race, this.character().look));
  protected readonly portraitFailed = signal<string | null>(null);

  protected readonly raceLabel = computed(() => {
    const r = this.character().race;
    return r ? raceName(r) : '';
  });

  /** The class theme's accent colour and glyph, behind the portrait. */
  protected readonly classArt = computed(() => {
    const cls = this.character().cls;
    const theme = cls ? THEMES.find((t) => gearClassName(t.id) === cls) : undefined;
    if (!theme) return null;
    const accent = theme.colors.accent;
    return {
      accent,
      glyph: `url("data:image/svg+xml,${encodeURIComponent(glyphSvg(theme, accent, 1.6))}")`,
    };
  });

  protected toggleLook(): void {
    this.store.updateGearCharacter(this.character().id, { look: this.character().look === 'f' ? 'm' : 'f' });
  }

  // ---------- weights ----------

  protected readonly defaults = computed(() => defaultWeights(this.character().cls));

  protected readonly changedWeights = computed(() => Object.keys(this.character().weights).length);

  protected setWeight(key: WeightKey, box: HTMLInputElement): void {
    const v = parseFloat(box.value);
    const weights = { ...this.character().weights };
    if (!Number.isFinite(v) || v === this.defaults()[key]) delete weights[key];
    else weights[key] = Math.max(-100, Math.min(100, v));
    this.store.updateGearCharacter(this.character().id, { weights });
  }

  protected resetWeights(): void {
    this.store.updateGearCharacter(this.character().id, { weights: {} });
  }

  protected fmt(n: number): string {
    return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0';
  }
}
