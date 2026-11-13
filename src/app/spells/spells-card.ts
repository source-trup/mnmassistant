import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { SpellPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { Spell, SpellService, formatCoin, spellKey } from './spell.service';

/** Rows drawn before "Show all" is needed (keeps the all-classes, all-levels view fast). */
const PAGE = 150;

interface Group {
  level: number;
  spells: Spell[];
  /** Total price of the group's spells still to buy, in copper. */
  total: number;
}

/** Spell list: filter by class and level, see what a level costs, search, and open a spell for its details. */
@Component({
  selector: 'app-spells-card',
  templateUrl: './spells-card.html',
  styleUrl: './spells-card.scss',
})
export class SpellsCard {
  readonly panel = input.required<SpellPanel>();
  protected readonly store = inject(TrackerStore);
  protected readonly data = inject(SpellService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly confirm = inject(ConfirmService);
  private readonly settings = viewChild.required<ElementRef<HTMLDialogElement>>('settings');

  // ---------- bought spells ----------

  private readonly bought = computed(() => new Set(this.panel().bought));

  protected isBought(s: Spell): boolean {
    return this.bought().has(spellKey(s));
  }

  /** What a spell still costs you: nothing once bought. */
  private cost(s: Spell): number {
    return this.isBought(s) ? 0 : (s.price ?? 0);
  }

  /** Right-click a spell to mark it bought (or not). */
  protected markBought(s: Spell, e?: Event): void {
    e?.preventDefault();
    this.store.toggleSpellBought(spellKey(s));
  }

  protected openSettings(): void {
    this.settings().nativeElement.showModal();
  }

  protected closeSettings(): void {
    this.settings().nativeElement.close();
  }

  /** Bought spells by class, for the settings dialog. */
  protected readonly boughtByClass = computed(() => {
    const counts = new Map<string, number>();
    const all = this.data.spells();
    for (const key of this.panel().bought) {
      const s = all.find((x) => spellKey(x) === key);
      const cls = s ? (s.classes.length === 1 ? s.classes[0] : 'Several classes') : 'No longer listed';
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  protected async clearBought(): Promise<void> {
    const n = this.panel().bought.length;
    if (!n) return;
    const ok = await this.confirm.ask(
      'Clear bought spells?',
      `Unmark all ${n} bought spell${n === 1 ? '' : 's'}? Their prices count toward the totals again.`,
      'Clear',
    );
    if (ok) this.store.clearBoughtSpells();
  }

  protected readonly query = signal('');
  protected readonly openId = signal<number | null>(null);
  protected readonly showAll = signal(false);

  protected readonly cls = computed(() => this.panel().cls);
  protected readonly level = computed(() => this.panel().level);
  protected readonly searching = computed(() => this.query().trim().length > 0);

  constructor() {
    void this.data.load();
  }

  /** Every spell the selected class gets (or all spells). */
  protected readonly pool = computed(() => {
    const cls = this.cls();
    const all = this.data.spells();
    return cls ? all.filter((s) => s.classes.includes(cls)) : all;
  });

  /** Levels at which the selected class gets something. */
  protected readonly levels = computed(() => [...new Set(this.pool().map((s) => s.level))].sort((a, b) => a - b));

  private matches(list: Spell[], q: string): Spell[] {
    const byName = list.filter((s) => s.nameKey.includes(q));
    // Longer searches also look in the effect text ("underwater", "attack speed"); name matches come first.
    const byEffect = q.length >= 3 ? list.filter((s) => !s.nameKey.includes(q) && s.effectKey.includes(q)) : [];
    return [...byName, ...byEffect];
  }

  /** What the list shows: search results (any level), or the class's spells at the chosen level. */
  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (q) return this.matches(this.pool(), q);
    const level = this.level();
    return level === null ? this.pool() : this.pool().filter((s) => s.level === level);
  });

  /** While searching one class: how many more matches the other classes have. */
  protected readonly elsewhere = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q || !this.cls()) return 0;
    return this.matches(this.data.spells(), q).length - this.results().length;
  });

  protected readonly visible = computed(() => (this.showAll() ? this.results() : this.results().slice(0, PAGE)));
  protected readonly hidden = computed(() => this.results().length - this.visible().length);

  /** Visible rows grouped by level, each with its cost. Group totals always cover the whole level, not just the visible rows. */
  protected readonly groups = computed<Group[]>(() => {
    const totals = new Map<number, number>();
    for (const s of this.results()) totals.set(s.level, (totals.get(s.level) ?? 0) + this.cost(s));
    // Search results are ranked (name matches first), so they aren't split up by level.
    if (this.searching()) return this.visible().length ? [{ level: -1, spells: this.visible(), total: 0 }] : [];
    const out: Group[] = [];
    for (const s of this.visible()) {
      let g = out[out.length - 1];
      if (!g || g.level !== s.level) out.push((g = { level: s.level, spells: [], total: totals.get(s.level) ?? 0 }));
      g.spells.push(s);
    }
    return out;
  });

  /** Cost summary for the filter (not shown while searching). */
  protected readonly summary = computed(() => {
    const list = this.results();
    const level = this.level();
    const sum = (xs: Spell[]) => xs.reduce((n, s) => n + this.cost(s), 0);
    const upTo = level === null ? null : this.pool().filter((s) => s.level <= level);
    return {
      count: list.length,
      total: formatCoin(sum(list)),
      bought: list.filter((s) => this.isBought(s)).length,
      unpriced: list.filter((s) => s.price === null && !this.isBought(s)).length,
      upTo: upTo && level !== null && level > (this.levels()[0] ?? 1) ? { total: formatCoin(sum(upTo)), count: upTo.length } : null,
    };
  });

  /** Nearest levels with spells, for the "nothing at this level" hint. */
  protected readonly nearby = computed(() => {
    const level = this.level();
    if (level === null) return [];
    const ls = this.levels();
    const below = [...ls].reverse().find((l) => l < level);
    const above = ls.find((l) => l > level);
    return [below, above].filter((l): l is number => l !== undefined);
  });

  // ---------- filters ----------

  protected setClass(value: string): void {
    this.showAll.set(false);
    this.store.updateSpellPanel({ cls: value || null });
  }

  protected setLevel(value: string | number | null): void {
    const n = value === null || value === '' ? null : Number(value);
    this.showAll.set(false);
    this.store.updateSpellPanel({ level: n !== null && Number.isFinite(n) ? n : null });
  }

  /** Previous / next level at which this class gets spells. */
  protected stepLevel(dir: -1 | 1): void {
    const ls = this.levels();
    const cur = this.level();
    const next = cur === null ? (dir > 0 ? ls[0] : ls[ls.length - 1]) : dir > 0 ? ls.find((l) => l > cur) : [...ls].reverse().find((l) => l < cur);
    if (next !== undefined) this.setLevel(next);
  }

  protected canStep(dir: -1 | 1): boolean {
    const ls = this.levels();
    const cur = this.level();
    if (!ls.length) return false;
    return cur === null || (dir > 0 ? cur < ls[ls.length - 1] : cur > ls[0]);
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    this.showAll.set(false);
  }

  protected toggle(s: Spell): void {
    this.openId.update((id) => (id === s.id ? null : s.id));
    // Bring the opened spell's details fully into the list's view.
    setTimeout(() => {
      const list = this.host.querySelector<HTMLElement>('.list');
      const open = list?.querySelector<HTMLElement>('.spell.open');
      if (!list || !open) return;
      const top = open.offsetTop - list.offsetTop;
      const bottom = top + open.offsetHeight;
      if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = Math.min(top, bottom - list.clientHeight + 4);
    });
  }

  // ---------- display ----------

  protected coin(price: number | null): string {
    return price === null ? '–' : formatCoin(price);
  }

  protected mana(m: Spell['mana']): string {
    return m === null ? '–' : String(m);
  }
}
