import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { WikiIcon, CommunityWikiService } from '../community-wiki/community-wiki.service';
import { ConfirmService } from '../confirm.service';
import { GearDataService } from '../gear/gear-data.service';
import { SLOT_LABEL, SLOT_TYPES, STAT_LABEL, SlotType, Stat, customToGear } from '../gear/gear';
import { CustomItem } from '../models';
import { PriceService } from '../prices/price.service';
import { TrackerStore } from '../tracker.store';
import { cardFromGear } from './card-data';
import { ItemCard } from './item-card';
import { ItemEditorService } from './item-editor.service';

const HEADLINE: Stat[] = ['ac', 'hp', 'mana'];
const ATTRS: Stat[] = ['str', 'sta', 'agi', 'dex', 'int', 'wis', 'cha'];
const RESISTS: Stat[] = ['sv_magic', 'sv_fire', 'sv_cold', 'sv_poison', 'sv_disease', 'sv_corruption', 'sv_electric', 'sv_holy'];
const WEAPON_SLOTS: SlotType[] = ['primary', 'offhand', 'ranged', 'ammo'];
/** Icons drawn at once in the picker; type to narrow the rest down. */
const ICONS_SHOWN = 240;

interface Draft {
  id?: number;
  name: string;
  icon: string | null;
  slots: SlotType[];
  stats: Partial<Record<Stat, number>>;
  dmg: number;
  delay: number;
  twoHand: boolean;
  source: string;
}

function blank(name = '', slot?: SlotType): Draft {
  return { name, icon: null, slots: slot ? [slot] : [], stats: {}, dmg: 0, delay: 0, twoHand: false, source: '' };
}

function fromItem(c: CustomItem): Draft {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    slots: c.slots.filter((s): s is SlotType => (SLOT_TYPES as readonly string[]).includes(s)),
    stats: { ...c.stats } as Partial<Record<Stat, number>>,
    dmg: c.dmg,
    delay: c.delay,
    twoHand: c.twoHand,
    source: c.source,
  };
}

/** "…/thumb/a/a4/Itemicon0106AA.png/64px-Itemicon0106AA.png" → "itemicon0106aa.png". */
function iconFile(url: string): string {
  const last = decodeURIComponent(url.split('/').pop() ?? '');
  return last.replace(/^\d+px-/, '').toLowerCase();
}

/**
 * 🛠 My items: make an item of your own, or change or delete one. Name, icon (any of the wiki's item icons), slots,
 * weapon damage and delay, AC, HP, Mana, attributes, resists and where it comes from, with its item card as you type.
 * Saved items join the Gear Planner and the Wishlist like any other.
 */
@Component({
  selector: 'app-item-editor',
  imports: [ItemCard],
  templateUrl: './item-editor.html',
  styleUrl: './item-editor.scss',
})
export class ItemEditor {
  protected readonly store = inject(TrackerStore);
  private readonly editor = inject(ItemEditorService);
  private readonly wiki = inject(CommunityWikiService);
  private readonly prices = inject(PriceService);
  private readonly gear = inject(GearDataService);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly SLOT_TYPES = SLOT_TYPES;
  protected readonly SLOT_LABEL = SLOT_LABEL;
  protected readonly STAT_LABEL = STAT_LABEL;
  protected readonly HEADLINE = HEADLINE;
  protected readonly ATTRS = ATTRS;
  protected readonly RESISTS = RESISTS;

  protected readonly draft = signal<Draft>(blank());
  protected readonly error = signal('');

  constructor() {
    // Open (or switch item) when someone asks.
    effect(() => {
      const r = this.editor.request();
      untracked(() => {
        const el = this.dlg().nativeElement;
        if (!r) {
          if (el.open) el.close();
          return;
        }
        const mine = r.id !== undefined ? this.store.customItems().find((c) => c.id === r.id) : undefined;
        this.draft.set(mine ? fromItem(mine) : blank(r.name?.trim() ?? '', r.slot));
        this.error.set('');
        this.picking.set(false);
        if (!el.open) el.showModal();
        setTimeout(() => el.querySelector<HTMLInputElement>('.name-box')?.focus());
      });
    });
  }

  /** The form is only drawn while the dialog is open. */
  protected readonly isOpen = computed(() => !!this.editor.request());

  protected readonly isNew = computed(() => this.draft().id === undefined);

  protected readonly isWeapon = computed(() => this.draft().slots.some((s) => WEAPON_SLOTS.includes(s)));

  /** The card as it will look. */
  protected readonly preview = computed(() => {
    const d = this.draft();
    const item = customToGear({ ...d, id: d.id ?? -1, name: d.name.trim() || 'New item', added: 0 });
    return cardFromGear(item, new Map());
  });

  protected update(patch: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
    this.error.set('');
  }

  protected toggleSlot(s: SlotType): void {
    const slots = this.draft().slots;
    this.update({ slots: slots.includes(s) ? slots.filter((x) => x !== s) : SLOT_TYPES.filter((x) => x === s || slots.includes(x)) });
  }

  protected stat(k: Stat): number | '' {
    return this.draft().stats[k] ?? '';
  }

  protected setStat(k: Stat, box: HTMLInputElement): void {
    const v = Number(box.value);
    const stats = { ...this.draft().stats };
    if (box.value.trim() === '' || !Number.isFinite(v) || v === 0) delete stats[k];
    else stats[k] = Math.round(v * 100) / 100;
    this.update({ stats });
  }

  protected setNumber(field: 'dmg' | 'delay', box: HTMLInputElement): void {
    const v = Number(box.value);
    this.update({ [field]: Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0 });
  }

  /** Switch to another of your items (or a new one) from the list at the top. */
  protected pickItem(value: string): void {
    const mine = this.store.customItems().find((c) => String(c.id) === value);
    this.draft.set(mine ? fromItem(mine) : blank());
    this.error.set('');
    this.picking.set(false);
  }

  protected save(): void {
    const d = this.draft();
    const name = d.name.trim();
    if (!name) {
      this.error.set('Give it a name.');
      return;
    }
    if (this.store.customItems().some((c) => c.id !== d.id && c.name.toLowerCase() === name.toLowerCase())) {
      this.error.set(`You already have an item called "${name}".`);
      return;
    }
    const saved = this.store.saveCustomItem({ ...d, name, source: d.source.trim() });
    if (!saved) {
      this.error.set("Couldn't save it (you have the most items allowed).");
      return;
    }
    this.editor.finish(saved);
  }

  protected async remove(e: MouseEvent): Promise<void> {
    const d = this.draft();
    if (d.id === undefined) return;
    if (e.shiftKey || (await this.confirm.ask('Delete item?', `Delete your item "${d.name}"? Characters wearing it keep its name.`))) {
      this.store.removeCustomItem(d.id);
      this.editor.finish(null);
    }
  }

  protected cancel(): void {
    this.editor.finish(null);
  }

  // ---------- the icon picker ----------

  protected readonly picking = signal(false);
  protected readonly icons = signal<WikiIcon[] | null>(null);
  protected readonly iconsFailed = signal(false);
  protected readonly iconQuery = signal('');

  protected async openPicker(): Promise<void> {
    this.picking.set(!this.picking());
    if (!this.picking() || this.icons()) return;
    this.iconsFailed.set(false);
    if (this.prices.status() === 'idle') void this.prices.load();
    try {
      this.icons.set(await this.wiki.itemIcons());
    } catch {
      this.iconsFailed.set(true);
    }
  }

  /** Which items use each icon (from MnMdb and Worth the Camp, whichever is loaded), so you can find one by item name. */
  private readonly usedBy = computed(() => {
    const m = new Map<string, string[]>();
    const add = (file: string, name: string) => {
      const list = m.get(file) ?? [];
      if (list.length < 4 && !list.includes(name)) list.push(name);
      m.set(file, list);
    };
    for (const it of this.prices.items().values()) if (it.info?.icon) add(iconFile(it.info.icon), it.name);
    for (const it of this.gear.wtcItems()) if (it.icon) add(it.icon.toLowerCase(), it.name);
    return m;
  });

  protected readonly shownIcons = computed(() => {
    const all = this.icons() ?? [];
    const q = this.iconQuery().trim().toLowerCase();
    const used = this.usedBy();
    const list = all
      .map((i) => ({ ...i, items: used.get(i.name.toLowerCase()) ?? [] }))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.items.some((n) => n.toLowerCase().includes(q)));
    return { total: list.length, icons: list.slice(0, ICONS_SHOWN) };
  });

  protected pickIcon(url: string | null): void {
    this.update({ icon: url });
    this.picking.set(false);
  }
}
