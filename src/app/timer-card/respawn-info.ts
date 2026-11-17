import { Component, computed, inject, input } from '@angular/core';
import { estimateRespawn } from '../counter-card/respawn';
import { NamedPhCounter } from '../models';
import { formatDuration } from '../time';
import { TrackerStore } from '../tracker.store';

/**
 * On a Named / PH timer: the estimated time between spawns, from the camp's kill log. Shows nothing until the camp
 * has a few respawns logged.
 */
@Component({
  selector: 'app-respawn-info',
  template: `
    @if (info(); as i) {
      <div class="respawn" [title]="i.tip">⟳ est. respawn {{ i.interval }}</div>
    }
  `,
  styles: `
    .respawn {
      text-align: center;
      font-size: 0.72rem;
      line-height: 1.25;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class RespawnInfo {
  readonly camp = input.required<NamedPhCounter>();
  private readonly store = inject(TrackerStore);

  protected readonly info = computed(() => {
    const est = estimateRespawn(this.store.historyOf(this.camp()).map((e) => e.t));
    if (!est) return null;
    const interval = formatDuration(est.interval, false);
    const tip =
      `Estimated time between spawns: ${interval}, from ${est.cycles} respawns in this camp's kill log.\n` +
      `Fitted across whole runs of kills, so a late press barely moves it. A gap of two or three respawns counts as ` +
      `spawns not logged` +
      (est.outliers ? `; ${est.outliers} odd gap${est.outliers === 1 ? '' : 's'} (late presses, breaks) left out or discounted.` : '.') +
      (est.spread >= 1000 ? `\nSingle respawns are usually within ${formatDuration(est.spread, false)} of it.` : '');
    return { interval, tip };
  });
}
