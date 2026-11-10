import { Component, computed, inject, input, signal } from '@angular/core';
import { atlasMapForZone, ATLAS_MAPS } from '../map/atlas-maps';
import { ClassPanel } from '../models';
import { TrackerStore } from '../tracker.store';
import { CLASS_LIST, CLASS_SOURCE, ClassInfo } from './class-data';
import { ClassService } from './class.service';

type Tab = ClassPanel['tab'];
type Category = ClassInfo['category'];

const ROLE_LABEL: Record<Category, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS', support: 'Support', hybrid: 'Hybrid' };
const FACT_ORDER = ['armor', 'key stats', 'solo', 'group demand', 'difficulty'];

/** How to play each class: a quick snapshot, then build, abilities, leveling and gear, with links to the full guides. */
@Component({
  selector: 'app-classes-card',
  templateUrl: './classes-card.html',
  styleUrl: './classes-card.scss',
})
export class ClassesCard {
  readonly panel = input.required<ClassPanel>();
  protected readonly store = inject(TrackerStore);
  protected readonly data = inject(ClassService);

  protected readonly SOURCE = CLASS_SOURCE;
  protected readonly ROLE_LABEL = ROLE_LABEL;
  protected readonly roles = Object.keys(ROLE_LABEL) as Category[];
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'build', label: 'Build' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'leveling', label: 'Leveling' },
    { id: 'gear', label: 'Gear' },
    { id: 'more', label: 'More' },
  ];

  /** Role filter for the class picker (not saved). */
  protected readonly role = signal<Category | null>(null);

  constructor() {
    void this.data.load();
  }

  /** The class shown: the one picked, or the class of the current theme (Shaman by default). */
  protected readonly clsId = computed(() => {
    const picked = this.panel().cls;
    if (picked) return picked;
    const theme = this.store.theme() === 'shadowknight' ? 'shadow-knight' : this.store.theme();
    return CLASS_LIST.some((c) => c.id === theme) ? theme : 'shaman';
  });

  protected readonly cls = computed(() => this.data.classes().find((c) => c.id === this.clsId()) ?? null);

  protected readonly pickable = computed(() => {
    const r = this.role();
    return CLASS_LIST.filter((c) => !r || c.category === r);
  });

  protected readonly facts = computed(() => {
    const c = this.cls();
    if (!c) return [];
    return FACT_ORDER.filter((k) => c.facts[k]).map((k) => ({ key: k === 'group demand' ? 'Group' : k[0].toUpperCase() + k.slice(1), ...c.facts[k] }));
  });

  /** Best value in each stat column of the race table (highlighted). */
  protected readonly bestStat = computed(() => {
    const c = this.cls();
    const best: Record<string, number> = {};
    for (const s of c?.statCols ?? []) {
      best[s] = Math.max(...(c?.races ?? []).map((r) => Number(r.stats[s]) || 0));
    }
    return best;
  });

  // ---------- picking ----------

  protected pick(id: string): void {
    this.store.updateClassPanel({ cls: id });
  }

  protected setRole(r: Category | null): void {
    this.role.set(this.role() === r ? null : r);
    const list = this.pickable();
    if (list.length && !list.some((c) => c.id === this.clsId())) this.pick(list[0].id);
  }

  protected setTab(tab: Tab): void {
    this.store.updateClassPanel({ tab });
  }

  // ---------- links ----------

  protected sectionUrl(c: ClassInfo, id: string): string {
    return `${c.guideUrl}#${id}`;
  }

  /** The guide section about a topic, if it has one (e.g. "group", "solo", "mistakes"). */
  protected section(c: ClassInfo, ...ids: string[]): { id: string; title: string } | undefined {
    return c.sections.find((s) => ids.includes(s.id));
  }

  /** Class-specific sections (e.g. "Slows, Debuffs and Mana") beyond the common ones. */
  protected readonly extraSections = computed(() => {
    const common = new Set(['overview', 'fit', 'races', 'traits', 'start', 'toolkit', 'leveling', 'group', 'solo', 'path', 'gear', 'mistakes', 'faq']);
    return this.cls()?.sections.filter((s) => !common.has(s.id)) ?? [];
  });

  protected showSpells(c: ClassInfo): void {
    this.store.showSpellsFor(c.name);
  }

  /** "1–5" / "12-16" / "30+" -> the Leveling panel on that range. */
  protected levelRange(levels: string): { from: number; to: number | null } | null {
    const m = levels.match(/(\d+)\s*[–-]\s*(\d+)/);
    if (m) return { from: +m[1], to: +m[2] };
    const one = levels.match(/(\d+)/);
    return one ? { from: +one[1], to: null } : null;
  }

  protected showLeveling(levels: string): void {
    const r = this.levelRange(levels);
    if (r) this.store.showLevelingFor(r.from, r.to);
  }

  /** The first atlas map named in a "Where" cell ("Night Harbor newbie yards" -> night-harbor). */
  protected mapFor(where: string): string | null {
    const text = where.toLowerCase().replace(/[’'`]/g, '');
    const hit = ATLAS_MAPS.filter((m) => m.id !== 'world')
      .map((m) => ({ m, i: text.indexOf(m.name.toLowerCase().replace(/[’'`]/g, '')) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)[0];
    if (hit) return hit.m.id;
    return atlasMapForZone(where.split(/[,(]/)[0])?.id ?? null;
  }

  protected showMap(id: string): void {
    this.store.showMap({ map: id, level: null, find: null });
  }

  /** "Omen of Lethargy (10%) → Greater Omen 16 (20%)" -> steps. */
  protected steps(progression: string): string[] {
    return progression.split(/\s*→\s*/).filter(Boolean);
  }
}
