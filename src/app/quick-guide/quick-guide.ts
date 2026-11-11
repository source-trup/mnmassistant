import { Component, ElementRef, afterNextRender, inject, output, viewChild } from '@angular/core';
import { TrackerStore } from '../tracker.store';

/** The full README on GitHub (the quick guide is the short version). */
export const README_URL = 'https://github.com/source-trup/mnmassistant#readme';

/**
 * "How to use" in a dialog: opened from the ? button or the ☰ menu, and once by itself on a first visit
 * (a browser with no saved board yet).
 */
@Component({
  selector: 'app-quick-guide',
  templateUrl: './quick-guide.html',
  styleUrl: './quick-guide.scss',
})
export class QuickGuide {
  private readonly store = inject(TrackerStore);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly README = README_URL;
  /** Fires when the guide that opened by itself on a first visit is closed (the app then offers a theme). */
  readonly firstVisitClosed = output<void>();
  private firstVisitOpen = false;

  constructor() {
    afterNextRender(() => {
      if (this.store.firstVisit) {
        this.firstVisitOpen = true;
        this.open();
      }
    });
  }

  /** However the dialog closes (Got it, Esc). */
  protected onClose(): void {
    if (!this.firstVisitOpen) return;
    this.firstVisitOpen = false;
    this.firstVisitClosed.emit();
  }

  open(): void {
    const d = this.dlg().nativeElement;
    if (!d.open) d.showModal();
  }

  protected close(): void {
    this.dlg().nativeElement.close();
  }
}
