import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog #dlg (close)="confirm.answer(false)">
      @if (confirm.pending(); as p) {
        <h3>{{ p.title }}</h3>
        <p>{{ p.message }}</p>
        <div class="dialog-actions">
          <button (click)="confirm.answer(false)">Cancel</button>
          <button [class]="p.tone" (click)="confirm.answer(true)" autofocus>{{ p.confirmText }}</button>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.confirm.pending()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }
}
