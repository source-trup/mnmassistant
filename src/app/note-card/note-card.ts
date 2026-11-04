import { Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { NoteItem } from '../models';
import { PanelTitle } from '../panel-title';
import { NOTE_FONT, TrackerStore } from '../tracker.store';

/** A free-text note with adjustable text size. */
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

  protected readonly FONT = NOTE_FONT;

  protected onText(e: Event): void {
    this.store.updateNote(this.note().id, { text: (e.target as HTMLTextAreaElement).value });
  }

  protected font(dir: -1 | 1): void {
    this.store.stepNoteFont(this.note().id, dir);
  }

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

  protected async remove(e?: MouseEvent): Promise<void> {
    const n = this.note();
    const msg = n.text.trim() ? `Delete "${n.name}" and its text?` : `Delete "${n.name}"?`;
    if (e?.shiftKey || (await this.confirm.ask('Delete note?', msg))) {
      this.closeEdit();
      this.store.removeNote(n.id);
    }
  }
}
