import { Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { LevelPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { LEVEL_CAP, LEVEL_CHART, LevelRow, highestPartner, lowestPartner } from './level-range';

/** The group level range chart, plus a box that shows who a given level can group with. */
@Component({
  selector: 'app-level-range-card',
  templateUrl: './level-range-card.html',
  styleUrl: './level-range-card.scss',
})
export class LevelRangeCard {
  readonly panel = input.required<LevelPanel>();
  protected readonly store = inject(TrackerStore);
  private readonly chart = viewChild<ElementRef<HTMLElement>>('chart');

  protected readonly CAP = LEVEL_CAP;
  protected readonly rows = LEVEL_CHART;
  protected readonly level = computed(() => this.panel().level);

  protected readonly range = computed(() => {
    const l = this.level();
    return l === null ? null : { low: lowestPartner(l), high: highestPartner(l) };
  });

  constructor() {
    // Keep the entered level's row (or, above the chart, its lowest partner's row) in view.
    effect(() => {
      const l = this.level();
      const r = this.range();
      const el = this.chart()?.nativeElement;
      if (!el || l === null || !r) return;
      const target = Math.min(l, this.rows.length);
      setTimeout(() => {
        const row = el.querySelector<HTMLElement>(`tr[data-min="${target}"]`);
        if (!row) return;
        const head = el.querySelector('thead')?.getBoundingClientRect().height ?? 0;
        const top = row.offsetTop - head;
        const bottom = row.offsetTop + row.offsetHeight;
        if (top < el.scrollTop) el.scrollTop = top - 4;
        else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight + 4;
      });
    });
  }

  protected onInput(box: HTMLInputElement): void {
    const n = parseInt(box.value, 10);
    if (n > LEVEL_CAP) box.value = String(LEVEL_CAP);
    this.store.setLevel(Number.isFinite(n) && n >= 1 ? Math.min(n, LEVEL_CAP) : null);
  }

  protected step(dir: -1 | 1): void {
    const l = this.level() ?? (dir > 0 ? 0 : LEVEL_CAP + 1);
    this.store.setLevel(Math.min(LEVEL_CAP, Math.max(1, l + dir)));
  }

  protected pick(row: LevelRow): void {
    this.store.setLevel(row.min);
  }

  /** How a chart row relates to the entered level. */
  protected rowState(row: LevelRow): 'you' | 'low' | 'in' | '' {
    const l = this.level();
    const r = this.range();
    if (l === null || !r) return '';
    if (row.min === l) return 'you';
    if (row.min === r.low) return 'low';
    // Rows between your lowest partner and you: a group led by that level still reaches you.
    return row.min > r.low && row.min < l ? 'in' : '';
  }

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
