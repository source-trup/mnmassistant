import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { ItemSearch } from '../loot/item-search';
import { CampEvent, LootItem, NamedPhCounter } from '../models';
import { formatAgo, formatClock, formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';

const MAX_ROWS = 300;

/** Stats, loot summary and kill log for one Named/PH camp. Shown inside the counter's history dialog. */
@Component({
  selector: 'app-camp-history',
  imports: [ItemSearch],
  templateUrl: './camp-history.html',
  styleUrl: './camp-history.scss',
})
export class CampHistory {
  readonly counter = input.required<NamedPhCounter>();
  readonly closed = output<void>();

  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);

  protected readonly scope = signal<'session' | 'all'>('session');

  protected readonly events = computed<CampEvent[]>(() => {
    const c = this.counter();
    return this.scope() === 'session' ? c.history.filter((e) => e.t >= c.since) : c.history;
  });

  protected readonly stats = computed(() => {
    const ev = this.events();
    const now = this.store.now();
    const ph = ev.filter((e) => e.type === 'ph').length;
    const named = ev.length - ph;

    const gaps: number[] = [];
    for (let i = 1; i < ev.length; i++) gaps.push(ev[i].t - ev[i - 1].t);
    const median = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : null;

    let streak = 0;
    let longest = 0;
    for (const e of ev) {
      streak = e.type === 'ph' ? streak + 1 : 0;
      longest = Math.max(longest, streak);
    }

    const lastNamed = [...this.counter().history].reverse().find((e) => e.type === 'named');
    const hours = ev.length ? Math.max((now - ev[0].t) / 3_600_000, 1 / 60) : 0;

    return {
      ph,
      named,
      odds: named ? `1 in ${((ph + named) / named).toFixed(1)}` : '—',
      median: median !== null ? formatDuration(median, false) : '—',
      last: gaps.length ? formatDuration(gaps[gaps.length - 1], false) : '—',
      longest,
      lastNamed: lastNamed ? `${formatAgo(now - lastNamed.t)} ago` : 'never',
      namedPerHour: hours ? (named / hours).toFixed(2) : '—',
      killsPerHour: hours ? (ev.length / hours).toFixed(1) : '—',
    };
  });

  /** Drop counts per item, most common first. */
  protected readonly loot = computed(() => {
    const ev = this.events();
    const named = ev.filter((e) => e.type === 'named').length;
    const counts = new Map<string, { name: string; url?: string; count: number }>();
    for (const e of ev) {
      for (const item of e.loot) {
        const key = item.name.toLowerCase();
        const row = counts.get(key) ?? { name: item.name, url: item.url, count: 0 };
        row.count++;
        row.url ??= item.url;
        counts.set(key, row);
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((r) => ({ ...r, pct: named ? Math.round((r.count / named) * 100) : 0 }));
  });

  protected readonly rows = computed(() => [...this.events()].reverse().slice(0, MAX_ROWS));
  protected readonly truncated = computed(() => this.events().length > MAX_ROWS);

  protected clock(t: number): string {
    return formatClock(t);
  }

  /** Kill whose loot is being edited inline. */
  protected readonly editing = signal<string | null>(null);

  protected toggleLoot(e: CampEvent): void {
    this.editing.update((id) => (id === e.id ? null : e.id));
  }

  protected addLoot(e: CampEvent, item: LootItem): void {
    this.store.addLoot(this.counter().id, e.id, item);
  }

  protected async deleteEvent(e: CampEvent, ev: MouseEvent): Promise<void> {
    const what = e.type === 'named' ? 'named kill' : 'placeholder kill';
    if (ev.shiftKey || (await this.confirm.ask('Delete entry?', `Remove this ${what} at ${formatClock(e.t)} from the log?`))) {
      this.store.deleteEvent(this.counter().id, e.id);
    }
  }

  protected async clearAll(): Promise<void> {
    const c = this.counter();
    if (await this.confirm.ask('Clear history?', `Erase all ${c.history.length} logged kills for "${c.name}"? Counts are not changed.`, 'Clear')) {
      this.store.clearHistory(c.id);
    }
  }
}
