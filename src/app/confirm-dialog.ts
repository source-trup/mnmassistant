import { Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog #dlg (close)="mine() && confirm.answer(false)">
      @if (mine(); as p) {
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
  /** The main page's dialog, or the pop-out window's. */
  readonly place = input<'main' | 'popout'>('main');
  protected readonly mine = computed(() => {
    const p = this.confirm.pending();
    return p && p.place === this.place() ? p : null;
  });
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.mine()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }
}
