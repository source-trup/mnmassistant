import { Component, DestroyRef, computed, Directive, ElementRef, Injectable, afterRenderEffect, inject, input, signal, viewChild } from '@angular/core';
import { GearItem } from '../gear/gear';
import { GearDataService } from '../gear/gear-data.service';
import { PriceItem } from '../prices/price.service';
import { CardData, cardFromGear, cardFromMnmdb } from './card-data';
import { ItemCard } from './item-card';
import { ItemLookupService } from './item-lookup';

/**
 * An item from either source (Worth the Camp's for the Gear Planner, MnMdb's for the Price Checker), or just a name
 * to look up (the Wishlist), which shows a "no item data" card when nothing knows it.
 */
export type TipItem = GearItem | PriceItem | string;

/** How long the pointer rests on an item name before its card shows (moving to another name while one shows is instant). */
const SHOW_DELAY_MS = 350;

/** The item card being shown, the element it belongs to, and the panel it sits beside. */
interface Tip {
  item: TipItem;
  anchor: HTMLElement;
  frame: HTMLElement;
}

/** The one item card at a time: which item, next to which element. */
@Injectable({ providedIn: 'root' })
export class ItemTipService {
  readonly tip = signal<Tip | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Shows an item's card after a short rest, or straight away if a card is already showing. */
  request(item: TipItem, anchor: HTMLElement): void {
    this.cancel();
    // Beside the whole panel, so the card never covers the list it came from.
    const tip = { item, anchor, frame: anchor.closest<HTMLElement>('.panel') ?? anchor };
    if (this.tip()) this.tip.set(tip);
    else this.timer = setTimeout(() => this.tip.set(tip), SHOW_DELAY_MS);
  }

  /** Hides the card (only if it's this element's, when one is given). */
  release(anchor?: HTMLElement): void {
    this.cancel();
    if (!anchor || this.tip()?.anchor === anchor) this.tip.set(null);
  }

  /**
   * Hides a card that's showing but lets one that's waiting go ahead: a panel scrolling a little as you type (or as
   * the doll slides away) mustn't cancel the card the pointer is resting on.
   */
  hideShown(): void {
    if (this.tip()) this.tip.set(null);
  }

  /** Whether this element's card is showing. */
  showing(anchor: HTMLElement): boolean {
    return this.tip()?.anchor === anchor;
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

/**
 * Put on an item's name or row: resting the pointer on it (or focusing it) shows the item's card. Pass null or
 * undefined when there's no item, or an MnMdb item without details (nothing shows).
 */
@Directive({
  selector: '[appItemTip]',
  host: {
    '(mouseenter)': 'show()',
    '(mousemove)': 'moved()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class ItemTip {
  readonly appItemTip = input<TipItem | null | undefined>();
  private readonly tips = inject(ItemTipService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    // A name that goes away (the doll sliding up, a list redrawn) takes its card with it.
    inject(DestroyRef).onDestroy(() => this.tips.release(this.el));
  }

  protected show(): void {
    const item = this.appItemTip();
    if (item && (typeof item === 'string' || !('listings' in item && !item.info))) this.tips.request(item, this.el);
  }

  /** The card shows once the pointer rests; moving on the name starts the wait again (and brings back a hidden card). */
  protected moved(): void {
    if (!this.tips.showing(this.el)) this.show();
  }

  protected hide(): void {
    this.tips.release(this.el);
  }
}

/**
 * Shows the item card. It sits in the browser's top layer (a popover), so a panel's edges never clip it, beside the
 * panel (to the right if there's room, otherwise to the left) and level with the name, kept inside the window.
 * Scrolling, clicking or Escape hides it. One in the app shell serves every panel.
 */
@Component({
  selector: 'app-item-tip-layer',
  imports: [ItemCard],
  template: `
    <div #pop popover="manual" class="item-tip" role="tooltip" [style.left.px]="pos().left" [style.top.px]="pos().top" [class.placed]="pos().placed">
      @if (card(); as c) {
        <app-item-card [card]="c" />
      }
    </div>
  `,
  styles: `
    .item-tip {
      position: fixed;
      inset: auto;
      margin: 0;
      padding: 0;
      border: none;
      background: none;
      overflow: visible;
      pointer-events: none;
      opacity: 0;
    }
    .item-tip.placed {
      opacity: 1;
      transition: opacity 0.12s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .item-tip.placed {
        transition: none;
      }
    }
  `,
})
export class ItemTipLayer {
  protected readonly tips = inject(ItemTipService);
  private readonly gear = inject(GearDataService);
  private readonly lookup = inject(ItemLookupService);
  private readonly pop = viewChild.required<ElementRef<HTMLElement>>('pop');
  protected readonly pos = signal({ left: 0, top: 0, placed: false });

  /** The card for the item shown, from whichever source it came from. */
  protected readonly card = computed<CardData | null>(() => {
    const item = this.tips.tip()?.item;
    if (!item) return null;
    if (typeof item === 'string') return this.lookup.cardFor(item);
    return 'listings' in item ? cardFromMnmdb(item) : cardFromGear(item, this.gear.npcs());
  });

  constructor() {
    const hide = () => this.tips.release();
    const hideShown = () => this.tips.hideShown();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('scroll', hideShown, true);
    window.addEventListener('pointerdown', hide, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', hide);
    inject(DestroyRef).onDestroy(() => {
      hide();
      window.removeEventListener('scroll', hideShown, true);
      window.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', hide);
    });

    // After the card renders: open the popover, measure the card, then place it beside the name.
    afterRenderEffect(() => {
      const t = this.tips.tip();
      const el = this.pop().nativeElement;
      if (!t || !t.anchor.isConnected) {
        if (el.matches(':popover-open')) el.hidePopover();
        if (this.pos().placed) this.pos.set({ left: 0, top: 0, placed: false });
        return;
      }
      if (!el.matches(':popover-open')) el.showPopover();
      const a = t.anchor.getBoundingClientRect();
      const f = t.frame.getBoundingClientRect();
      const card = el.getBoundingClientRect();
      const gap = 10;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = f.right + gap;
      if (left + card.width > vw - 8) left = f.left - gap - card.width;
      // No room on either side of the panel: beside the name instead.
      if (left < 8) left = a.right + gap + card.width <= vw - 8 ? a.right + gap : a.left - gap - card.width;
      left = Math.max(8, Math.min(left, vw - card.width - 8));
      const top = Math.max(8, Math.min(a.top - 6, vh - card.height - 8));
      const next = { left: Math.round(left), top: Math.round(top), placed: true };
      const cur = this.pos();
      if (cur.left !== next.left || cur.top !== next.top || !cur.placed) this.pos.set(next);
    });
  }
}
