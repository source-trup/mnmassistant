import { Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MapPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { ATLAS_MAPS, ATLAS_URL, AtlasMap, atlasEmbedUrl, atlasFullUrl } from './atlas-maps';

/** A row in the map picker: a map, or (when the text matched a floor's name) one of its floors. */
interface MapOption {
  map: AtlasMap;
  level: { id: string; name: string } | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, '');

/** Zone maps from MnM Atlas, shown with the atlas's own embed (https://www.mnmatlas.com/embed/). */
@Component({
  selector: 'app-map-card',
  templateUrl: './map-card.html',
  styleUrl: './map-card.scss',
})
export class MapCard {
  readonly panel = input.required<MapPanel>();
  protected readonly store = inject(TrackerStore);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly ATLAS = ATLAS_URL;
  /** World map first, then the zones A–Z. */
  protected readonly maps = [
    ...ATLAS_MAPS.filter((m) => m.id === 'world'),
    ...ATLAS_MAPS.filter((m) => m.id !== 'world').sort((a, b) => a.name.localeCompare(b.name)),
  ];

  protected readonly current = computed(() => ATLAS_MAPS.find((m) => m.id === this.panel().map) ?? ATLAS_MAPS[0]);

  /** The embed address. It's built only from the atlas's own address, a known map id and URL-encoded text. */
  protected readonly src = computed<SafeResourceUrl>(() => {
    const { level, find } = this.panel();
    const url = atlasEmbedUrl(this.current().id, level, find);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  protected readonly fullUrl = computed(() => atlasFullUrl(this.current().id, this.panel().level, this.panel().find));

  protected readonly title = computed(() => {
    const find = this.panel().find;
    return find ? `“${find}” · MnM Atlas` : `${this.current().name} · MnM Atlas`;
  });

  protected setMap(id: string): void {
    this.store.updateMapPanel({ map: id, level: null, find: null });
  }

  // ---------- the searchable map picker ----------

  /** Text typed into the picker; null when it isn't being typed in (it then shows the current map). */
  protected readonly typed = signal<string | null>(null);
  protected readonly pickerOpen = signal(false);
  protected readonly highlighted = signal(0);

  /** Maps whose name matches (starts with, then a word starting with, then anywhere), then floors that match. */
  protected readonly options = computed<MapOption[]>(() => {
    const q = norm((this.typed() ?? '').trim());
    if (!q) return this.maps.map((map) => ({ map, level: null }));
    const rank = (name: string) => {
      const n = norm(name);
      if (n.startsWith(q)) return 0;
      if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
      return n.includes(q) ? 2 : -1;
    };
    const byName = this.maps
      .map((map) => ({ map, r: rank(map.name) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .map((x) => ({ map: x.map, level: null }));
    const named = new Set(byName.map((o) => o.map.id));
    const byFloor: MapOption[] = [];
    for (const map of this.maps) {
      if (named.has(map.id)) continue;
      for (const level of map.levels) if (rank(level.name) >= 0) byFloor.push({ map, level });
    }
    return [...byName, ...byFloor];
  });

  /** What the picker box shows. */
  protected readonly pickerText = computed(() => this.typed() ?? (this.panel().find ? '' : this.current().name));

  protected onPickerFocus(box: HTMLInputElement): void {
    this.pickerOpen.set(true);
    this.highlighted.set(Math.max(0, this.options().findIndex((o) => o.map.id === this.current().id && !o.level)));
    setTimeout(() => box.select());
    this.scrollHighlight();
  }

  protected onPickerInput(value: string): void {
    this.typed.set(value);
    this.pickerOpen.set(true);
    this.highlighted.set(0);
  }

  protected onPickerKey(e: KeyboardEvent, box: HTMLInputElement): void {
    const n = this.options().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.pickerOpen.set(true);
      if (n) this.highlighted.set((this.highlighted() + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
      this.scrollHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = this.options()[this.highlighted()];
      if (o) this.pickOption(o, box);
    } else if (e.key === 'Escape') {
      this.closePicker(box);
      box.blur();
    }
  }

  protected pickOption(o: MapOption, box: HTMLInputElement): void {
    this.store.updateMapPanel({ map: o.map.id, level: o.level?.id ?? null, find: null });
    this.closePicker(box);
    box.blur();
  }

  protected closePicker(box?: HTMLInputElement): void {
    this.typed.set(null);
    this.pickerOpen.set(false);
    if (box) box.value = this.pickerText();
  }

  private scrollHighlight(): void {
    setTimeout(() => document.getElementById(`map-opt-${this.highlighted()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  protected setLevel(id: string): void {
    this.store.updateMapPanel({ level: id || null, find: null });
  }

  /** Looks a place or NPC up on every map ("Night Terror", "enchanter trainer", "bank"). */
  protected find(box: HTMLInputElement): void {
    const text = box.value.trim();
    if (!text) return;
    this.store.updateMapPanel({ find: text.slice(0, 100) });
    box.select();
  }

  protected clearFind(box: HTMLInputElement): void {
    box.value = '';
    this.store.updateMapPanel({ find: null });
  }
}
