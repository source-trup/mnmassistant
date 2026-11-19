import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { LEVEL_CAP } from '../level-range/level-range';
import { GearCharacter, GearPanel } from '../models';
import { formatAgo } from '../time';
import { TrackerStore } from '../tracker.store';
import { GEAR_CLASSES, RACES, weightsFor } from './gear';
import { GearDataService } from './gear-data.service';
import { GearDoll } from './gear-doll';
import { GearUpgrades } from './gear-upgrades';

/**
 * Gear Planner: a paper doll per character (what you wear, saved), an upgrade finder (filter by slot, mob level and
 * how you get it) and recommended upgrades around your level. Item data from Worth the Camp (CC BY-SA 4.0).
 */
@Component({
  selector: 'app-gear-card',
  imports: [GearDoll, GearUpgrades],
  templateUrl: './gear-card.html',
  styleUrl: './gear-card.scss',
})
export class GearCard {
  readonly panel = input.required<GearPanel>();
  protected readonly store = inject(TrackerStore);
  protected readonly data = inject(GearDataService);
  private readonly confirm = inject(ConfirmService);

  protected readonly CAP = LEVEL_CAP;
  protected readonly CLASSES = GEAR_CLASSES;
  protected readonly RACES = RACES;
  protected readonly TABS = [
    { id: 'doll', label: 'Paper doll', hint: 'What this character wears: click a slot to pick an item' },
    { id: 'finder', label: 'Upgrades', hint: 'Every upgrade, filtered by slot, mob level and how you get it' },
    { id: 'recommended', label: 'Recommended', hint: 'The biggest upgrades you can get around your level' },
  ] as const;

  constructor() {
    void this.data.load();
  }

  protected readonly character = computed<GearCharacter | null>(() => {
    const p = this.panel();
    return p.characters.find((c) => c.id === p.active) ?? p.characters[0] ?? null;
  });

  protected readonly weights = computed(() => {
    const c = this.character();
    return weightsFor(c?.cls ?? null, c?.weights);
  });

  protected readonly updated = computed(() => {
    const t = this.data.fetchedAt();
    return t ? formatAgo(this.store.now() - t) : '';
  });

  /** Renaming the character (the name box is showing, focused and selected). */
  protected readonly renaming = signal(false);
  private readonly nameBox = viewChild<ElementRef<HTMLInputElement>>('nameBox');

  protected startRename(): void {
    this.renaming.set(true);
    setTimeout(() => this.nameBox()?.nativeElement.select());
  }

  protected pick(id: string): void {
    this.renaming.set(false);
    this.store.updateGearPanel({ active: id });
  }

  protected add(): void {
    if (this.store.addGearCharacter()) this.startRename();
  }

  protected rename(box: HTMLInputElement): void {
    const c = this.character();
    const name = box.value.trim().slice(0, 40);
    if (c && name) this.store.updateGearCharacter(c.id, { name });
    this.renaming.set(false);
  }

  protected async remove(e: MouseEvent): Promise<void> {
    const c = this.character();
    if (!c) return;
    const worn = Object.keys(c.gear).length;
    const extra = worn ? ` Their ${worn} worn item${worn === 1 ? '' : 's'} will be forgotten.` : '';
    if (e.shiftKey || (await this.confirm.ask('Delete character?', `Delete "${c.name}" from the Gear Planner?${extra}`))) {
      this.store.removeGearCharacter(c.id);
      this.renaming.set(false);
    }
  }

  protected set(patch: Partial<Omit<GearCharacter, 'id'>>): void {
    const c = this.character();
    if (c) this.store.updateGearCharacter(c.id, patch);
  }

  protected setLevel(box: HTMLInputElement): void {
    const n = parseInt(box.value, 10);
    const level = Number.isFinite(n) && n >= 1 ? Math.min(n, LEVEL_CAP) : null;
    if (level !== null && String(level) !== box.value) box.value = String(level);
    this.set({ level });
  }

  protected setView(view: GearPanel['view']): void {
    this.store.updateGearPanel({ view });
  }
}
