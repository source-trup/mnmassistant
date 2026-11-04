import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { PlayerEntry, PlayerListKind, PlayerListPanel } from '../models';
import { TrackerStore, playerKey } from '../tracker.store';

const INFO: Record<PlayerListKind, { title: string; icon: string; other: PlayerListKind }> = {
  naughty: { title: 'Naughty list', icon: '😈', other: 'nice' },
  nice: { title: 'Nice list', icon: '😇', other: 'naughty' },
};

/**
 * The Naughty or Nice list: players you'd rather avoid, or would happily group with again.
 * One box both searches and adds: type to filter (and to check a name against both lists), Enter to add.
 */
@Component({
  selector: 'app-player-list-card',
  templateUrl: './player-list-card.html',
  styleUrl: './player-list-card.scss',
})
export class PlayerListCard {
  readonly panel = input.required<PlayerListPanel>();
  protected readonly store = inject(TrackerStore);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly kind = computed(() => this.panel().kind);
  protected readonly info = computed(() => INFO[this.kind()]);
  protected readonly otherInfo = computed(() => INFO[this.info().other]);

  protected readonly query = signal('');
  /** Last removal, for Undo. */
  protected readonly undo = signal<PlayerEntry | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | undefined;
  /** Name whose note is being edited. */
  protected readonly editing = signal<string | null>(null);
  /** Brief confirmation after adding/moving. */
  protected readonly flash = signal('');
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly entries = computed(() =>
    [...this.store.players()[this.kind()]].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  );

  /** Entries matching what's typed (partial, case-insensitive). */
  protected readonly shown = computed(() => {
    const q = playerKey(this.query());
    return q ? this.entries().filter((p) => playerKey(p.name).includes(q)) : this.entries();
  });

  /** Exact-name check against both lists for the typed name. */
  protected readonly check = computed(() => {
    const q = this.query().trim();
    if (!q) return null;
    const found = this.store.findPlayer(q);
    if (!found) return { state: 'none' as const, name: q, note: '' };
    return { state: found.kind === this.kind() ? ('here' as const) : ('other' as const), name: found.entry.name, note: found.entry.note };
  });

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const c = this.check();
      if (c?.state === 'none') this.add();
    } else if (e.key === 'Escape') {
      this.query.set('');
    }
  }

  /** Adds what's typed (or moves it here from the other list). */
  protected add(): void {
    const name = this.query().trim();
    const result = this.store.addPlayer(this.kind(), name);
    if (result === 'added' || result === 'moved') {
      this.query.set('');
      this.box().nativeElement.value = '';
      const shown = this.store.findPlayer(name)?.entry.name ?? name;
      this.showFlash(result === 'moved' ? `Moved ${shown} here from your ${this.otherInfo().title}` : `Added ${shown}`);
    }
    this.box().nativeElement.focus();
  }

  protected remove(p: PlayerEntry): void {
    const entry = this.store.removePlayer(this.kind(), p.name);
    if (!entry) return;
    if (this.editing() === p.name) this.editing.set(null);
    this.undo.set(entry);
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => this.undo.set(null), 8000);
  }

  protected undoRemove(): void {
    const entry = this.undo();
    if (entry) this.store.restorePlayer(this.kind(), entry);
    this.undo.set(null);
    clearTimeout(this.undoTimer);
  }

  protected editNote(p: PlayerEntry): void {
    this.editing.set(p.name);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`#note-${this.kind()}`);
      el?.focus();
      el?.select();
    });
  }

  protected saveNote(p: PlayerEntry, input: HTMLInputElement): void {
    if (this.editing() !== p.name) return;
    this.store.setPlayerNote(this.kind(), p.name, input.value);
    this.editing.set(null);
  }

  protected added(p: PlayerEntry): string {
    return 'Added ' + new Date(p.added).toLocaleDateString();
  }

  private showFlash(text: string): void {
    this.flash.set(text);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flash.set(''), 3000);
  }
}
