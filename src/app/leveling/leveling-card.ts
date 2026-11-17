import { Component, computed, inject, input, signal } from '@angular/core';
import { LEVEL_CAP } from '../level-range/level-range';
import { atlasMapForZone } from '../map/atlas-maps';
import { LevelingPanel } from '../models';
import { formatAgo } from '../time';
import { TrackerStore } from '../tracker.store';
import { WTC_URL, WorthTheCampService } from './worth-the-camp.service';
import {
  CON_LABEL,
  Con,
  LevelingMode,
  SoloTier,
  ZoneMatch,
  conOf,
  levelingPlan,
  targetFor,
  wtcLevelingUrl,
  wtcNpcUrl,
  wtcZoneUrl,
} from './wtc-leveling';

/** NPC lines shown per zone before "+N more". */
const SHOWN = 6;

const TIER_TEXT: Record<SoloTier, string> = {
  S: 'solos very well',
  A: 'solos well',
  B: 'solos fairly well',
  C: 'finds soloing hard',
  D: 'finds soloing very hard',
};

/**
 * Leveling Spots: pick your class, level and solo or group, and see the zones whose mobs con right for you, from
 * Worth the Camp's NPC data (adapted from the community wiki, CC BY-SA 4.0).
 */
@Component({
  selector: 'app-leveling-card',
  templateUrl: './leveling-card.html',
  styleUrl: './leveling-card.scss',
})
export class LevelingCard {
  readonly panel = input.required<LevelingPanel>();
  protected readonly store = inject(TrackerStore);
  protected readonly wtc = inject(WorthTheCampService);

  protected readonly CAP = LEVEL_CAP;
  protected readonly WTC = WTC_URL;
  protected readonly SHOWN = SHOWN;
  protected readonly conLabel = CON_LABEL;

  constructor() {
    void this.wtc.load();
  }

  protected readonly classes = computed(() => this.wtc.data()?.classes ?? []);

  /** The class picked, or the theme's class when none is. */
  protected readonly cls = computed(() => {
    const list = this.classes();
    const want = (this.panel().cls ?? this.store.theme()).toLowerCase();
    return list.find((c) => c.name.toLowerCase() === want) ?? null;
  });

  protected readonly mode = computed<LevelingMode>(() => this.panel().mode);
  protected readonly level = computed(() => this.panel().level);

  /** Group targets don't depend on the class; solo needs its tier. */
  protected readonly tier = computed<SoloTier | null>(() => (this.mode() === 'group' ? 'B' : (this.cls()?.tier ?? null)));

  protected readonly target = computed(() => {
    const lvl = this.level();
    const tier = this.tier();
    return lvl !== null && tier ? targetFor(lvl, this.mode(), tier) : null;
  });

  protected readonly zones = computed<ZoneMatch[]>(() => {
    const data = this.wtc.data();
    const lvl = this.level();
    const tier = this.tier();
    return data && lvl !== null && tier ? levelingPlan(data.npcs, lvl, this.mode(), tier) : [];
  });

  protected readonly mobCount = computed(() => this.zones().reduce((n, z) => n + z.npcs.length, 0));

  /** The level strip: from 6 below to 4 above your level, each with its con colour; the target ones are marked. */
  protected readonly strip = computed(() => {
    const lvl = this.level();
    const t = this.target();
    if (lvl === null || !t) return [];
    const out: { level: number; con: Con; target: boolean; named: boolean }[] = [];
    for (let l = Math.max(1, lvl - 6); l <= Math.min(LEVEL_CAP + 5, lvl + 4); l++) {
      out.push({ level: l, con: conOf(l, lvl), target: l >= t.lo && l <= t.hi, named: l >= t.namedLo && l <= t.namedHi });
    }
    return out;
  });

  protected readonly tierText = computed(() => {
    const c = this.cls();
    return c ? `${c.name} ${TIER_TEXT[c.tier]} (solo tier ${c.tier})` : '';
  });

  protected readonly wtcPageUrl = computed(() => wtcLevelingUrl(this.cls()?.name ?? null, this.level(), this.mode()));

  protected readonly updated = computed(() => {
    const d = this.wtc.data();
    return d ? formatAgo(this.store.now() - d.fetchedAt) : '';
  });

  /** Zones opened past their first few NPCs. */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(zone: string): boolean {
    return this.expanded().has(zone);
  }

  protected toggleZone(zone: string): void {
    const next = new Set(this.expanded());
    if (!next.delete(zone)) next.add(zone);
    this.expanded.set(next);
  }

  // ---------- inputs ----------

  protected setClass(value: string): void {
    this.store.updateLevelingPanel({ cls: value || null });
  }

  protected setMode(mode: LevelingMode): void {
    this.store.updateLevelingPanel({ mode });
  }

  protected setLevel(box: HTMLInputElement): void {
    const n = parseInt(box.value, 10);
    const level = Number.isFinite(n) && n >= 1 ? Math.min(n, LEVEL_CAP) : null;
    if (level !== null && String(level) !== box.value) box.value = String(level);
    this.store.updateLevelingPanel({ level });
  }

  protected step(dir: -1 | 1): void {
    const lvl = this.level();
    const next = lvl === null ? (dir > 0 ? 1 : LEVEL_CAP) : Math.min(LEVEL_CAP, Math.max(1, lvl + dir));
    this.store.updateLevelingPanel({ level: next });
  }

  // ---------- display ----------

  protected levels(lo: number, hi: number): string {
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  }

  protected atlasId(zone: string): string | null {
    return atlasMapForZone(zone)?.id ?? null;
  }

  protected zoneUrl(zone: string): string {
    return wtcZoneUrl(zone, this.wtc.data()?.zones ?? []);
  }

  protected npcUrl(id: string): string {
    return wtcNpcUrl(id);
  }
}
