import { Injectable, computed, signal } from '@angular/core';

/** One line of the spell list. A spell shared by several classes at the same price is one entry. */
export interface Spell {
  id: number;
  name: string;
  /** Damage, Heal, Buff, … (may be empty when unknown). */
  kinds: string[];
  level: number;
  school: string | null;
  /** A number, "Innate" / "None", or null when unknown. */
  mana: number | string | null;
  /** Vendor price in copper, or null when no price is listed. */
  price: number | null;
  classes: string[];
  effect: string;
  /** Lower-case name / effect, for searching. */
  nameKey: string;
  effectKey: string;
}

interface SpellFile {
  kinds: string[];
  schools: string[];
  classes: string[];
  spells: [string, number[], number, number, number | string | null, number | null, number[], string][];
}

/** A stable id for a spell entry (survives rebuilding the spell list): name, level and classes. */
export function spellKey(s: { name: string; level: number; classes: string[] }): string {
  return `${s.name}|${s.level}|${s.classes.join(',')}`;
}

/** "1g 4s 50c" from a copper amount (100c = 1s, 100s = 1g). */
export function formatCoin(copper: number): string {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  const parts = [g ? `${g}g` : '', s ? `${s}s` : '', c ? `${c}c` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0c';
}

/**
 * The spell list (public/spells.json, generated from data/spells.txt by tools/build-spells.mjs).
 * It's only downloaded the first time the Spells panel is shown.
 */
@Injectable({ providedIn: 'root' })
export class SpellService {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly spells = signal<Spell[]>([]);
  /** Class names, A–Z. */
  readonly classes = computed(() => [...new Set(this.spells().flatMap((s) => s.classes))].sort());

  async load(): Promise<void> {
    if (this.status() === 'loading' || this.status() === 'ready') return;
    this.status.set('loading');
    try {
      const res = await fetch(new URL('spells.json', document.baseURI));
      if (!res.ok) throw new Error(String(res.status));
      const file = (await res.json()) as SpellFile;
      this.spells.set(
        file.spells.map(([name, kinds, level, school, mana, price, classes, effect], id) => ({
          id,
          name,
          kinds: kinds.map((k) => file.kinds[k]),
          level,
          school: school >= 0 ? file.schools[school] : null,
          mana,
          price,
          classes: classes.map((c) => file.classes[c]),
          effect,
          nameKey: name.toLowerCase(),
          effectKey: effect.toLowerCase(),
        })),
      );
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
