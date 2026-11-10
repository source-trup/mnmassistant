import { Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
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

  constructor() {
    afterNextRender(() => {
      if (this.store.firstVisit) this.open();
    });
  }

  open(): void {
    const d = this.dlg().nativeElement;
    if (!d.open) d.showModal();
  }

  protected close(): void {
    this.dlg().nativeElement.close();
  }
}
