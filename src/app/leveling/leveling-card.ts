import { Component, computed, inject, input } from '@angular/core';
import { LEVEL_CAP } from '../level-range/level-range';
import { LevelingPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { HUNTING_GUIDE, HuntingSpot, LEVELING_COLUMNS, LEVELING_ZONES, LevelingCamp, LevelingZone } from './leveling-data';

export const LEVELING_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1z3O-QkdgvAwUXrCVF3fRQRBGxXxDq6FcoipuA52sdl0/edit?gid=1120375141#gid=1120375141';

interface ZoneMatch {
  zone: LevelingZone;
  camps: LevelingCamp[];
  spots: HuntingSpot[];
}

/** Where to level: pick a level or a level range and see the zones and camps that suit it. */
@Component({
  selector: 'app-leveling-card',
  templateUrl: './leveling-card.html',
  styleUrl: './leveling-card.scss',
})
export class LevelingCard {
  readonly panel = input.required<LevelingPanel>();
  protected readonly store = inject(TrackerStore);

  protected readonly CAP = LEVEL_CAP;
  protected readonly SHEET = LEVELING_SHEET_URL;
  protected readonly GUIDE = HUNTING_GUIDE.url;
  protected readonly columns = LEVELING_COLUMNS;
  protected readonly regions = [...new Set(LEVELING_ZONES.map((z) => z.region))];

  /** The chosen range, low to high; null until a level is picked. */
  protected readonly range = computed(() => {
    const { from, to } = this.panel();
    if (from === null) return null;
    const hi = to ?? from;
    return { lo: Math.min(from, hi), hi: Math.max(from, hi) };
  });

  protected readonly label = computed(() => {
    const r = this.range();
    if (!r) return '';
    return r.lo === r.hi ? `Level ${r.lo}` : `Levels ${r.lo}–${r.hi}`;
  });

  protected readonly matches = computed<ZoneMatch[]>(() => {
    const r = this.range();
    if (!r) return [];
    const { region, raids, source } = this.panel();
    const fits = (x: { min: number; max: number }) => x.min <= r.hi && x.max >= r.lo;
    return LEVELING_ZONES.filter((z) => !region || z.region === region)
      .map((zone) => ({
        zone,
        camps: source === 'guide' ? [] : zone.camps.filter((c) => fits(c) && (raids || !c.raid)),
        spots: source === 'sheet' ? [] : zone.spots.filter(fits),
      }))
      .filter((m) => m.camps.length || m.spots.length);
  });

  protected readonly campCount = computed(() => this.matches().reduce((n, m) => n + m.camps.length, 0));
  protected readonly spotCount = computed(() => this.matches().reduce((n, m) => n + m.spots.length, 0));

  protected setSource(value: string): void {
    this.store.updateLevelingPanel({ source: value === 'sheet' || value === 'guide' ? value : 'both' });
  }

  /** "Solo 17+ · Group 10-15" from the guide's own level text. */
  protected spotLevels(s: HuntingSpot): string {
    const parts = [s.solo && `Solo ${s.solo}`, s.group && `Group ${s.group}`].filter(Boolean);
    return parts.length ? parts.join(' · ') : `Levels ${s.min}–${s.max}`;
  }

  // ---------- filters ----------

  private parse(value: string): number | null {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, LEVEL_CAP) : null;
  }

  protected setFrom(box: HTMLInputElement): void {
    const n = this.parse(box.value);
    if (n !== null && String(n) !== box.value) box.value = String(n);
    this.store.updateLevelingPanel({ from: n, ...(n === null ? { to: null } : {}) });
  }

  protected setTo(box: HTMLInputElement): void {
    const n = this.parse(box.value);
    if (n !== null && String(n) !== box.value) box.value = String(n);
    this.store.updateLevelingPanel({ to: n });
  }

  /** One of the sheet's level columns: that whole bracket (e.g. 15 → 15–19). */
  protected pickColumn(col: number): void {
    const next = this.columns.find((c) => c > col);
    this.store.updateLevelingPanel({ from: col, to: next ? next - 1 : null });
  }

  protected isColumn(col: number): boolean {
    const r = this.range();
    const next = this.columns.find((c) => c > col);
    return !!r && r.lo === col && r.hi === (next ? next - 1 : col);
  }

  /** −1 / +1 moves a single level, or slides a whole range. */
  protected step(dir: -1 | 1): void {
    const { from, to } = this.panel();
    if (from === null) {
      this.store.updateLevelingPanel({ from: dir > 0 ? 1 : LEVEL_CAP });
      return;
    }
    const clamp = (n: number) => Math.min(LEVEL_CAP, Math.max(1, n));
    const r = this.range()!;
    if ((dir < 0 && r.lo <= 1) || (dir > 0 && r.hi >= LEVEL_CAP)) return;
    this.store.updateLevelingPanel({ from: clamp(from + dir), to: to === null ? null : clamp(to + dir) });
  }

  protected setRegion(value: string): void {
    this.store.updateLevelingPanel({ region: value || null });
  }

  protected bracket(c: LevelingCamp): string {
    return c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`;
  }
}
