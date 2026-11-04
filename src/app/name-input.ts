import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface NameSuggestion {
  name: string;
  /** Small text on the right, e.g. "12 kills · 2 named". */
  detail?: string;
}

/**
 * Text box with a suggestion list. Unlike a native <datalist>, the list shows *every* suggestion when the box opens
 * (even though the box already holds the current name) and narrows as you type.
 * Enter or clicking away commits; Esc cancels. ↑/↓ pick a suggestion.
 */
@Component({
  selector: 'app-name-input',
  template: `
    <input
      #box
      [class]="inputClass()"
      [value]="value()"
      [placeholder]="placeholder()"
      (focus)="onFocus()"
      (click)="open()"
      (input)="onInput()"
      (keydown)="onKey($event)"
      (blur)="onBlur()"
      (pointerdown)="$event.stopPropagation()"
      autocomplete="off"
      spellcheck="false"
    />
    <ul #list class="suggest" popover="manual" [class.empty]="!shown().length">
      @for (s of shown(); track s.name; let i = $index) {
        <li>
          <button
            type="button"
            [class.active]="i === highlighted()"
            (mousedown)="$event.preventDefault()"
            (click)="pick(s)"
          >
            <span class="nm">{{ s.name }}</span>
            @if (s.detail) {
              <span class="dt">{{ s.detail }}</span>
            }
          </button>
          @if (forgettable()) {
            <button
              type="button"
              class="forget"
              title="Forget this NPC and its history"
              (mousedown)="$event.preventDefault()"
              (click)="forget.emit(s.name)"
            >
              ✕
            </button>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: flex; flex: 1; min-width: 0; }
    input { flex: 1; min-width: 0; }
    .suggest {
      position: fixed;
      inset: auto;
      margin: 0;
      padding: 4px;
      list-style: none;
      max-height: 240px;
      overflow-y: auto;
      background: var(--dialog-bg);
      color: var(--text);
      border: 1px solid var(--spirit-line);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 0.85rem;
      font-weight: 400;
      &.empty { display: none; }
    }
    li { display: flex; }
    li > button:first-child {
      flex: 1;
      min-width: 0;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 8px;
      text-align: left;
      background: none;
      border: none;
      &.active, &:hover { background: var(--spirit-soft); filter: none; }
    }
    .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--bone); }
    .dt { color: var(--muted); font-size: 0.75rem; white-space: nowrap; }
    .forget { background: none; border: none; padding: 0 6px; font-size: 0.7rem; color: var(--muted); }
  `,
})
export class NameInput {
  readonly value = input.required<string>();
  readonly suggestions = input<NameSuggestion[]>([]);
  readonly placeholder = input('');
  readonly inputClass = input('');
  /** Show a ✕ on each suggestion (emits `forget`). */
  readonly forgettable = input(false);
  /** Focus and select the text as soon as it appears. */
  readonly autofocus = input(false);

  readonly committed = output<string>();
  readonly cancelled = output<void>();
  readonly forget = output<string>();

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** What's typed; null until the user edits (then the list narrows). */
  private readonly typed = signal<string | null>(null);
  protected readonly highlighted = signal(-1);
  private done = false;

  protected readonly shown = computed(() => {
    const q = this.typed()?.trim().toLowerCase();
    const all = this.suggestions();
    if (!q) return all.slice(0, 50);
    return all.filter((s) => s.name.toLowerCase().includes(q) && s.name.toLowerCase() !== q).slice(0, 50);
  });

  constructor() {
    afterNextRender(() => {
      if (!this.autofocus()) return;
      const el = this.box().nativeElement;
      el.focus();
      el.select();
      this.open();
    });
  }

  /** Focus alone doesn't open the list (dialogs auto-focus their first field); click, typing or ↓ does. */
  protected onFocus(): void {
    this.done = false;
    this.typed.set(null);
    this.highlighted.set(-1);
  }

  protected onInput(): void {
    this.typed.set(this.box().nativeElement.value);
    this.highlighted.set(-1);
    this.open();
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.shown().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.open();
      this.highlighted.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.highlighted.update((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = this.shown()[this.highlighted()];
      if (s) this.pick(s);
      else this.commit(this.box().nativeElement.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't also close a surrounding dialog
      this.done = true;
      this.close();
      this.box().nativeElement.value = this.value(); // undo what was typed
      this.cancelled.emit();
    }
  }

  protected onBlur(): void {
    this.commit(this.box().nativeElement.value);
  }

  protected pick(s: NameSuggestion): void {
    this.box().nativeElement.value = s.name;
    this.commit(s.name);
  }

  private commit(text: string): void {
    if (this.done) return;
    this.done = true;
    this.close();
    if (!text.trim()) this.box().nativeElement.value = this.value(); // an empty name isn't allowed
    this.committed.emit(text.trim());
  }

  protected open(): void {
    const list = this.list().nativeElement;
    const r = this.box().nativeElement.getBoundingClientRect();
    list.style.top = `${r.bottom + 4}px`;
    list.style.left = `${r.left}px`;
    list.style.minWidth = `${Math.max(r.width, 200)}px`;
    if (!list.matches(':popover-open') && this.host.nativeElement.isConnected) list.showPopover();
  }

  private close(): void {
    const list = this.list().nativeElement;
    if (list.matches(':popover-open')) list.hidePopover();
  }
}
