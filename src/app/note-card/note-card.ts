import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { CheckItem, NoteItem } from '../models';
import { PanelTitle } from '../panel-title';
import { NOTE_FONT, TrackerStore } from '../tracker.store';
import { formatItem, parseChecklist, parseLine } from './checklist-parse';

/** A note panel: free text, or a checklist (shopping list) with adjustable text size. */
@Component({
  selector: 'app-note-card',
  imports: [PanelTitle],
  templateUrl: './note-card.html',
  styleUrl: './note-card.scss',
})
export class NoteCard {
  readonly note = input.required<NoteItem>();
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected readonly FONT = NOTE_FONT;
  protected readonly isList = computed(() => this.note().type === 'checklist');
  protected readonly done = computed(() => this.note().items.filter((i) => i.done).length);

  protected onText(e: Event): void {
    this.store.updateNote(this.note().id, { text: (e.target as HTMLTextAreaElement).value });
  }

  protected font(dir: -1 | 1): void {
    this.store.stepNoteFont(this.note().id, dir);
  }

  // ---------- checklist ----------

  /** Short message under the add box ("Added 8 items"), or an undo offer. */
  protected readonly flash = signal<{ text: string; undo?: CheckItem[] } | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  private say(text: string, undo?: CheckItem[]): void {
    clearTimeout(this.flashTimer);
    this.flash.set({ text, undo });
    this.flashTimer = setTimeout(() => this.flash.set(null), undo ? 8000 : 2500);
  }

  /** Enter in the add box: one line, or several if the box holds a pasted list. */
  protected add(input: HTMLInputElement): void {
    const n = this.store.addCheckItems(this.note().id, parseChecklist(input.value));
    if (n > 1) this.say(`Added ${n} items`);
    input.value = '';
  }

  /** Pasting a multi-line list (or the wiki's tradeskill table) adds every line at once. */
  protected onPaste(e: ClipboardEvent, input: HTMLInputElement): void {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!/[\n\t]/.test(text.trim())) return; // a single line: let it paste normally
    e.preventDefault();
    const n = this.store.addCheckItems(this.note().id, parseChecklist(text));
    this.say(n ? `Added ${n} item${n === 1 ? '' : 's'} from the paste` : 'Nothing to add in that paste');
    input.value = '';
  }

  protected toggle(i: CheckItem): void {
    if (this.editing() !== i.id) this.store.toggleCheckItem(this.note().id, i.id);
  }

  protected remove(i: CheckItem): void {
    const before = this.note().items;
    if (this.store.removeCheckItem(this.note().id, i.id)) this.say(`Removed “${i.text}”`, before);
  }

  protected clearChecked(): void {
    const before = this.note().items;
    const n = this.done();
    if (!n) return;
    this.store.clearCheckedItems(this.note().id);
    this.say(`Removed ${n} checked item${n === 1 ? '' : 's'}`, before);
  }

  protected uncheckAll(): void {
    const before = this.note().items;
    if (!this.done()) return;
    this.store.uncheckAllItems(this.note().id);
    this.say('Unchecked everything', before);
  }

  protected undo(): void {
    const f = this.flash();
    if (f?.undo) this.store.restoreCheckItems(this.note().id, f.undo);
    this.flash.set(null);
  }

  /** Line being edited inline (right-click or double-click a line). */
  protected readonly editing = signal<string | null>(null);

  protected edit(i: CheckItem, e: Event): void {
    e.preventDefault();
    this.editing.set(i.id);
    setTimeout(() => this.host.querySelector<HTMLInputElement>('.line-edit')?.select());
  }

  protected editText(i: CheckItem): string {
    return formatItem(i);
  }

  protected commitEdit(i: CheckItem, value: string): void {
    if (this.editing() !== i.id) return;
    this.editing.set(null);
    const parsed = parseLine(value);
    if (!parsed) this.remove(i);
    else this.store.updateCheckItem(this.note().id, i.id, { text: parsed.text, qty: parsed.qty });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  // ---------- settings ----------

  protected openEdit(): void {
    this.dlg().nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.dlg().nativeElement.close();
  }

  protected rename(e: Event): void {
    const name = (e.target as HTMLInputElement).value.trim();
    if (name) this.store.updateNote(this.note().id, { name });
  }

  protected async removeNote(e?: MouseEvent): Promise<void> {
    const n = this.note();
    const what = this.isList() ? 'checklist' : 'note';
    const hasContent = this.isList() ? n.items.length > 0 : n.text.trim() !== '';
    const msg = hasContent ? `Delete "${n.name}" and its ${this.isList() ? 'items' : 'text'}?` : `Delete "${n.name}"?`;
    if (e?.shiftKey || (await this.confirm.ask(`Delete ${what}?`, msg))) {
      this.closeEdit();
      this.store.removeNote(n.id);
    }
  }
}
