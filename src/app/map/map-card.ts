import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MapPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { ATLAS_MAPS, ATLAS_URL, atlasEmbedUrl, atlasFullUrl } from './atlas-maps';

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
