import { Component, ElementRef, inject, signal } from '@angular/core';
import { BuffCard } from '../buff-card/buff-card';
import { ConfirmDialog } from '../confirm-dialog';
import { CounterCard } from '../counter-card/counter-card';
import { LootPrompt } from '../loot/loot-prompt';
import { TimerCard } from '../timer-card/timer-card';
import { CampPopCard } from './camp-pop-card';
import { PopoutService } from './popout.service';

const HINT_KEY = 'mnm-assistant.popout-hint-hidden';

/**
 * What the pop-out window shows. This element lives in the main page until a panel is popped out, then
 * PopoutService moves it into the pop-out window's document (and back again when that closes).
 */
@Component({
  selector: 'app-popout-host',
  imports: [TimerCard, CounterCard, BuffCard, CampPopCard, ConfirmDialog, LootPrompt],
  template: `
    @if (popout.mode(); as mode) {
      @if (mode === 'window' && showHint()) {
        <div class="pop-hint">
          <span>
            📌 To keep this window on top:
            @if (windows) {
              click it and press <kbd>Win</kbd>+<kbd>Ctrl</kbd>+<kbd>T</kbd>
              (<a href="https://learn.microsoft.com/windows/powertoys/always-on-top" target="_blank" rel="noopener">PowerToys Always On Top</a>).
            } @else {
              use your system's "always on top" window option.
            }
          </span>
          <button class="icon" (click)="hideHint()" title="Got it, hide this">✕</button>
        </div>
      }
      <div class="list">
        @for (u of popout.units(); track u.kind + u.id) {
          @if (u.kind === 'camp') {
            <app-camp-pop-card [camp]="u.camp" />
          } @else {
            <div class="pop-panel" [style.height.px]="u.height">
              @switch (u.panel.kind) {
                @case ('timer') {
                  <app-timer-card [timer]="u.panel.item" />
                }
                @case ('counter') {
                  @if (u.panel.item.kind === 'standard') {
                    <app-counter-card [counter]="u.panel.item" />
                  }
                }
                @case ('buffs') {
                  <app-buff-card [panel]="u.panel.item" />
                }
              }
            </div>
          }
        }
      </div>
      <app-loot-prompt place="popout" />
    }
    <app-confirm-dialog place="popout" />
  `,
  styles: `
    :host {
      display: block;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }
    .pop-panel {
      flex: none;
      width: 100%;
    }
    .pop-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 8px 0;
      padding: 4px 6px 4px 10px;
      font-size: 0.78rem;
      color: var(--muted);
      background: var(--panel);
      border: 1px dashed var(--border);
      border-radius: 6px;
      span {
        flex: 1;
      }
      a {
        color: var(--spirit);
      }
      kbd {
        padding: 0 4px;
        border: 1px solid var(--border);
        border-radius: 3px;
        font: inherit;
        color: var(--text);
      }
    }
  `,
})
export class PopoutHost {
  protected readonly popout = inject(PopoutService);
  protected readonly windows = /Windows/i.test(navigator.userAgent);
  protected readonly showHint = signal(readHintShown());

  constructor() {
    this.popout.register(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  }

  protected hideHint(): void {
    this.showHint.set(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Shown again next time.
    }
  }
}

function readHintShown(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) !== '1';
  } catch {
    return true;
  }
}
