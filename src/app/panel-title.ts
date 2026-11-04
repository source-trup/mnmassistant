import { Component, input, output, signal } from '@angular/core';
import { NameInput, NameSuggestion } from './name-input';

/**
 * A panel's title in its header. Right-click it to rename in place: Enter or clicking away saves, Esc cancels.
 * Optional `suggestions` appear in a dropdown (all of them at first, narrowing as you type).
 */
@Component({
  selector: 'app-panel-title',
  imports: [NameInput],
  template: `
    @if (editing()) {
      <app-name-input
        inputClass="title-edit"
        [value]="name()"
        [suggestions]="suggestions()"
        [forgettable]="forgettable()"
        [autofocus]="true"
        (committed)="commit($event)"
        (cancelled)="editing.set(false)"
        (forget)="forget.emit($event)"
      />
    } @else {
      <span class="name" [title]="name() + ' — right-click to rename'" (contextmenu)="start($event)">
        {{ name() }}
      </span>
    }
  `,
  styles: `
    :host {
      flex: 1;
      min-width: 0;
      display: flex;
    }
    .name {
      flex: 1;
      min-width: 0;
    }
    :host ::ng-deep .title-edit {
      padding: 0 4px;
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--bone);
      border-color: var(--spirit-line);
    }
  `,
})
export class PanelTitle {
  readonly name = input.required<string>();
  /** Names offered while renaming. */
  readonly suggestions = input<NameSuggestion[]>([]);
  /** Show a ✕ next to each suggestion (emits `forget`). */
  readonly forgettable = input(false);
  readonly renamed = output<string>();
  readonly forget = output<string>();

  protected readonly editing = signal(false);

  protected start(e: MouseEvent): void {
    e.preventDefault();
    this.editing.set(true);
  }

  protected commit(name: string): void {
    this.editing.set(false);
    if (name && name !== this.name()) this.renamed.emit(name);
  }
}
