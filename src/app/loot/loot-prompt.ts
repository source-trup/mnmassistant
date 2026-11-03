import { Component, computed, effect, inject } from '@angular/core';
import { LootItem } from '../models';
import { formatClock } from '../time';
import { TrackerStore } from '../tracker.store';
import { ItemSearch } from './item-search';

/**
 * Non-modal drawer on the right that appears after a named kill so you can (optionally) record what
 * dropped. The linked timer has already restarted by the time this shows; nothing here blocks it.
 */
@Component({
  selector: 'app-loot-prompt',
  imports: [ItemSearch],
  template: `
    @for (r of current(); track r.event.id) {
      <aside class="drawer">
        <div class="top">
          <span class="title">Named down!</span>
          @if (store.lootQueue().length > 1) {
            <span class="more" title="More named kills waiting">+{{ store.lootQueue().length - 1 }} more</span>
          }
        </div>
        <div class="where">{{ r.camp }} · {{ clock(r.event.t) }}</div>
        <label class="ask">What dropped? <em>(optional)</em></label>
        <app-item-search (picked)="add(r.counterId, r.event.id, $event)" />
        @if (r.event.loot.length) {
          <div class="chips">
            @for (item of r.event.loot; track $index) {
              <span class="chip">
                @if (item.url) {
                  <a [href]="item.url" target="_blank" rel="noopener">{{ item.name }}</a>
                } @else {
                  {{ item.name }}
                }
                <button class="x" (click)="store.removeLoot(r.counterId, r.event.id, $index)" title="Remove">✕</button>
              </span>
            }
          </div>
        }
        <div class="actions">
          <button [class.primary]="r.event.loot.length" (click)="store.dismissLoot()">
            {{ r.event.loot.length ? 'Done' : 'Skip' }}
          </button>
        </div>
      </aside>
    }
  `,
  styles: `
    .drawer {
      position: fixed;
      top: 76px;
      right: 16px;
      z-index: 30;
      width: 300px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--dialog-bg);
      border: 1px solid var(--spirit-line);
      border-left: 4px solid var(--named);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.5), 0 0 24px var(--card-glow);
      animation: slide-in 0.2s ease-out;
    }
    @keyframes slide-in {
      from { transform: translateX(24px); opacity: 0; }
    }
    .top { display: flex; align-items: baseline; justify-content: space-between; }
    .title { font-family: var(--font-display); font-weight: 700; color: var(--named); font-size: 1.05rem; }
    .more { font-size: 0.75rem; color: var(--muted); }
    .where { font-size: 0.8rem; color: var(--muted); margin-top: -6px; }
    .ask { font-size: 0.85rem; em { color: var(--muted); } }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 8px;
      border-radius: 12px;
      background: var(--named-bg);
      border: 1px solid var(--named);
      font-size: 0.85rem;
      a { color: var(--named); text-decoration: none; }
      a:hover { text-decoration: underline; }
    }
    .x { background: none; border: none; padding: 0 4px; font-size: 0.75rem; color: var(--muted); }
    .actions { display: flex; justify-content: flex-end; }
  `,
})
export class LootPrompt {
  protected readonly store = inject(TrackerStore);

  /** The request at the front of the queue, resolved to its camp and event (as a 0/1 list so it re-renders per event). */
  protected readonly current = computed(() => {
    const req = this.store.lootQueue()[0];
    if (!req) return [];
    const c = this.store.counters().find((x) => x.id === req.counterId);
    if (!c || c.kind !== 'namedPh') return [];
    const event = c.history.find((e) => e.id === req.eventId);
    return event ? [{ counterId: c.id, camp: c.name, event }] : [];
  });

  constructor() {
    // Drop requests whose camp or kill no longer exists.
    effect(() => {
      if (this.store.lootQueue().length && !this.current().length) this.store.dismissLoot();
    });
  }

  protected clock(t: number): string {
    return formatClock(t);
  }

  protected add(counterId: string, eventId: string, item: LootItem): void {
    this.store.addLoot(counterId, eventId, item);
  }
}
